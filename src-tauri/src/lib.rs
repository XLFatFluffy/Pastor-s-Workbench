use serde::{Deserialize, Serialize};
use std::net::TcpStream;
use std::process::Command;
use std::time::Duration;
use tauri::Manager;

#[derive(Debug, Serialize)]
struct DesktopInfo { desktop: bool, platform: String, arch: String, app_data_dir: String }

#[derive(Debug, Serialize)]
struct DesktopHealth { desktop: bool, ready: bool, platform: String, webview: String, ollama_reachable: bool, message: String }

#[derive(Debug, Deserialize)]
struct OllamaChatRequest { model: String, messages: Vec<OllamaMessage>, temperature: Option<f32> }
#[derive(Debug, Serialize, Deserialize, Clone)]
struct OllamaMessage { role: String, content: String }

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![desktop_info, open_app_data_folder, desktop_health, ollama_tags, ollama_chat, open_update_page])
        .run(tauri::generate_context!())
        .expect("error while running Pastor's Workbench");
}
