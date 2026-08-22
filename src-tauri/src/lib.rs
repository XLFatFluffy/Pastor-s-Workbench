use serde::{Deserialize, Serialize};
use std::net::TcpStream;
use std::process::Command;
use std::time::Duration;
use std::path::PathBuf;
use rusqlite::{params, Connection};
use tauri::Manager;
use tauri_plugin_updater::UpdaterExt;

#[derive(Debug, Serialize)]
struct DesktopInfo { desktop: bool, platform: String, arch: String, app_data_dir: String }

#[derive(Debug, Serialize)]
struct DesktopHealth { desktop: bool, ready: bool, platform: String, webview: String, ollama_reachable: bool, message: String }

#[derive(Debug, Deserialize)]
struct OllamaChatRequest { model: String, messages: Vec<OllamaMessage>, temperature: Option<f32> }
#[derive(Debug, Serialize, Deserialize, Clone)]
struct OllamaMessage { role: String, content: String }
#[derive(Debug, Deserialize)]
struct OllamaEmbedRequest { model: String, input: Vec<String> }


fn database_path(app: &tauri::AppHandle, database: &str) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let filename = match database { "ai" => "ai.db", "workbench" => "workbench.db", _ => return Err("Unknown database. Use 'workbench' or 'ai'.".into()) };
    Ok(dir.join(filename))
}

fn open_sqlite(app: &tauri::AppHandle, database: &str) -> Result<Connection, String> {
    let path = database_path(app, database)?;
    let conn = Connection::open(path).map_err(|e| e.to_string())?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA synchronous=NORMAL;")
        .map_err(|e| e.to_string())?;
    conn.execute_batch("CREATE TABLE IF NOT EXISTS records (store_name TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(store_name,id)); CREATE INDEX IF NOT EXISTS idx_records_store_updated ON records(store_name,updated_at); CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);")
        .map_err(|e| e.to_string())?;
    Ok(conn)
}

#[tauri::command]
fn sqlite_status(app: tauri::AppHandle, database: String) -> Result<serde_json::Value, String> {
    let path = database_path(&app, &database)?;
    let conn = open_sqlite(&app, &database)?;
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM records", [], |row| row.get(0)).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({"database": database, "path": path.display().to_string(), "records": count}))
}

#[tauri::command]
fn sqlite_get(app: tauri::AppHandle, database: String, store: String, id: String) -> Result<Option<serde_json::Value>, String> {
    let conn = open_sqlite(&app, &database)?;
    let mut stmt = conn.prepare("SELECT data FROM records WHERE store_name=?1 AND id=?2").map_err(|e| e.to_string())?;
    let mut rows = stmt.query(params![store, id]).map_err(|e| e.to_string())?;
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let data: String = row.get(0).map_err(|e| e.to_string())?;
        serde_json::from_str(&data).map(Some).map_err(|e| e.to_string())
    } else { Ok(None) }
}

#[tauri::command]
fn sqlite_all(app: tauri::AppHandle, database: String, store: String) -> Result<Vec<serde_json::Value>, String> {
    let conn = open_sqlite(&app, &database)?;
    let mut stmt = conn.prepare("SELECT data FROM records WHERE store_name=?1 ORDER BY updated_at DESC").map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![store], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?;
    rows.map(|r| { let data=r.map_err(|e| e.to_string())?; serde_json::from_str(&data).map_err(|e| e.to_string()) }).collect()
}

fn record_id(record: &serde_json::Value) -> Result<String, String> {
    record.get("id").and_then(|v| v.as_str()).filter(|v| !v.is_empty()).map(ToOwned::to_owned).ok_or_else(|| "SQLite records require a non-empty string id.".into())
}

#[tauri::command]
fn sqlite_put(app: tauri::AppHandle, database: String, store: String, record: serde_json::Value) -> Result<String, String> {
    let id=record_id(&record)?; let data=serde_json::to_string(&record).map_err(|e| e.to_string())?; let now=chrono_like_now();
    let conn=open_sqlite(&app,&database)?;
    conn.execute("INSERT INTO records(store_name,id,data,updated_at) VALUES(?1,?2,?3,?4) ON CONFLICT(store_name,id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at",params![store,id,data,now]).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
fn sqlite_bulk(app: tauri::AppHandle, database: String, store: String, records: Vec<serde_json::Value>) -> Result<usize, String> {
    let mut conn=open_sqlite(&app,&database)?; let tx=conn.transaction().map_err(|e| e.to_string())?; let now=chrono_like_now();
    { let mut stmt=tx.prepare("INSERT INTO records(store_name,id,data,updated_at) VALUES(?1,?2,?3,?4) ON CONFLICT(store_name,id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at").map_err(|e| e.to_string())?;
      for record in &records { let id=record_id(record)?; let data=serde_json::to_string(record).map_err(|e| e.to_string())?; stmt.execute(params![store,id,data,now]).map_err(|e| e.to_string())?; }
    }
    tx.commit().map_err(|e| e.to_string())?; Ok(records.len())
}

#[tauri::command]
fn sqlite_remove(app: tauri::AppHandle, database: String, store: String, id: String) -> Result<(), String> { let conn=open_sqlite(&app,&database)?; conn.execute("DELETE FROM records WHERE store_name=?1 AND id=?2",params![store,id]).map_err(|e| e.to_string())?; Ok(()) }
#[tauri::command]
fn sqlite_clear(app: tauri::AppHandle, database: String, store: String) -> Result<(), String> { let conn=open_sqlite(&app,&database)?; conn.execute("DELETE FROM records WHERE store_name=?1",params![store]).map_err(|e| e.to_string())?; Ok(()) }
#[tauri::command]
fn sqlite_meta(app: tauri::AppHandle, database: String, key: String, value: Option<String>) -> Result<Option<String>, String> { let conn=open_sqlite(&app,&database)?; if let Some(v)=value { conn.execute("INSERT INTO meta(key,value) VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value",params![key,v]).map_err(|e| e.to_string())?; return Ok(Some(v)); } let mut stmt=conn.prepare("SELECT value FROM meta WHERE key=?1").map_err(|e| e.to_string())?; let mut rows=stmt.query(params![key]).map_err(|e| e.to_string())?; if let Some(row)=rows.next().map_err(|e| e.to_string())? { Ok(Some(row.get(0).map_err(|e| e.to_string())?)) } else { Ok(None) } }


#[tauri::command]
async fn check_for_app_update(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let update = app.updater().map_err(|e| e.to_string())?.check().await.map_err(|e| e.to_string())?;
    if let Some(update) = update {
        Ok(serde_json::json!({
            "configured": true,
            "updateAvailable": true,
            "version": update.version,
            "notes": update.body.unwrap_or_default()
        }))
    } else {
        Ok(serde_json::json!({ "configured": true, "updateAvailable": false }))
    }
}

#[tauri::command]
async fn install_app_update(app: tauri::AppHandle) -> Result<(), String> {
    let update = app.updater().map_err(|e| e.to_string())?.check().await.map_err(|e| e.to_string())?
        .ok_or_else(|| "No update is currently available.".to_string())?;
    update.download_and_install(|_, _| {}, || {}).await.map_err(|e| e.to_string())?;
    Ok(())
}

fn chrono_like_now() -> String { use std::time::{SystemTime,UNIX_EPOCH}; format!("{}",SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis()) }

#[tauri::command]
fn open_update_page(url: String) -> Result<(), String> {
    if !(url.starts_with("https://") || url.starts_with("http://")) { return Err("Only http(s) update URLs are allowed.".into()); }
    #[cfg(target_os = "windows")]
    { Command::new("cmd").args(["/C", "start", "", &url]).spawn().map_err(|e| e.to_string())?; }
    #[cfg(target_os = "macos")]
    { Command::new("open").arg(&url).spawn().map_err(|e| e.to_string())?; }
    #[cfg(target_os = "linux")]
    { Command::new("xdg-open").arg(&url).spawn().map_err(|e| e.to_string())?; }
    Ok(())
}

#[tauri::command]
fn desktop_info(app: tauri::AppHandle) -> DesktopInfo {
    let app_data = app.path().app_data_dir().ok().map(|p| p.display().to_string()).unwrap_or_default();
    DesktopInfo { desktop: true, platform: std::env::consts::OS.to_string(), arch: std::env::consts::ARCH.to_string(), app_data_dir: app_data }
}

#[tauri::command]
fn open_app_data_folder(app: tauri::AppHandle) -> Result<(), String> {
    let path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    #[cfg(target_os = "windows")]
    { Command::new("explorer").arg(&path).spawn().map_err(|e| e.to_string())?; }
    #[cfg(target_os = "macos")]
    { Command::new("open").arg(&path).spawn().map_err(|e| e.to_string())?; }
    #[cfg(target_os = "linux")]
    { Command::new("xdg-open").arg(&path).spawn().map_err(|e| e.to_string())?; }
    Ok(())
}

#[tauri::command]
fn desktop_health() -> DesktopHealth {
    let ollama = TcpStream::connect_timeout(&"127.0.0.1:11434".parse().expect("valid Ollama address"), Duration::from_millis(900)).is_ok();
    DesktopHealth { desktop: true, ready: true, platform: std::env::consts::OS.to_string(), webview: "Microsoft Edge WebView2".to_string(), ollama_reachable: ollama, message: if ollama { "Desktop shell is ready and Ollama is reachable." } else { "Desktop shell is ready. Ollama is not currently reachable." }.to_string() }
}

#[tauri::command]
async fn ollama_tags() -> Result<serde_json::Value, String> {
    reqwest::Client::new().get("http://127.0.0.1:11434/api/tags").send().await.map_err(|e| format!("Ollama connection failed: {e}"))?.error_for_status().map_err(|e| format!("Ollama returned an error: {e}"))?.json::<serde_json::Value>().await.map_err(|e| format!("Invalid Ollama response: {e}"))
}

#[tauri::command]
async fn ollama_chat(request: OllamaChatRequest) -> Result<serde_json::Value, String> {
    if request.model.trim().is_empty() { return Err("No Ollama model was selected.".into()); }
    let body = serde_json::json!({
        "model": request.model,
        "messages": request.messages,
        "stream": false,
        "options": { "temperature": request.temperature.unwrap_or(0.2) }
    });
    reqwest::Client::new().post("http://127.0.0.1:11434/api/chat").json(&body).send().await.map_err(|e| format!("Ollama connection failed: {e}"))?.error_for_status().map_err(|e| format!("Ollama returned an error: {e}"))?.json::<serde_json::Value>().await.map_err(|e| format!("Invalid Ollama response: {e}"))
}

#[tauri::command]
async fn ollama_embed(request: OllamaEmbedRequest) -> Result<serde_json::Value, String> {
    if request.model.trim().is_empty() { return Err("No Ollama embedding model was selected.".into()); }
    if request.input.is_empty() { return Err("No text was provided to embed.".into()); }
    let body = serde_json::json!({ "model": request.model, "input": request.input });
    reqwest::Client::new().post("http://127.0.0.1:11434/api/embed").json(&body).send().await
        .map_err(|e| format!("Ollama connection failed: {e}"))?
        .error_for_status().map_err(|e| format!("Ollama returned an error: {e}. Make sure the model is pulled: ollama pull {}", request.model))?
        .json::<serde_json::Value>().await.map_err(|e| format!("Invalid Ollama response: {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![desktop_info, open_app_data_folder, desktop_health, ollama_tags, ollama_chat, ollama_embed, open_update_page, check_for_app_update, install_app_update, sqlite_status, sqlite_get, sqlite_all, sqlite_put, sqlite_bulk, sqlite_remove, sqlite_clear, sqlite_meta])
        .run(tauri::generate_context!())
        .expect("error while running Pastor's Workbench");
}
