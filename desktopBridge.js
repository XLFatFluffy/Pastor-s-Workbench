// Desktop bridge: keeps the Workbench frontend usable in a normal browser while
// exposing a small, safe native surface when running inside Tauri.
let tauriCore = null;
try {
  if (globalThis.__TAURI__?.core) tauriCore = globalThis.__TAURI__.core;
} catch { /* browser */ }

export const isDesktop = () => Boolean(tauriCore);
export const invokeDesktop = async (command, args = {}) => {
  if (!tauriCore) throw new Error('Native desktop bridge is unavailable.');
  return tauriCore.invoke(command, args);
};

export async function desktopInfo() {
  if (!tauriCore) return { desktop: false, platform: 'browser', arch: '', appDataDir: '' };
  try { return await tauriCore.invoke('desktop_info'); }
  catch (error) { return { desktop: true, platform: 'unknown', arch: '', appDataDir: '', error: String(error) }; }
}

export async function openAppDataFolder() {
  if (!tauriCore) return false;
  try { await tauriCore.invoke('open_app_data_folder'); return true; }
  catch { return false; }
}

export async function desktopHealth() {
  if (!tauriCore) return { desktop: false, ready: false, message: 'Running in a browser.' };
  try { return await tauriCore.invoke('desktop_health'); }
  catch (error) { return { desktop: true, ready: false, message: String(error) }; }
}


export async function ollamaTags() {
  if (!tauriCore) return null;
  return await tauriCore.invoke('ollama_tags');
}

export async function ollamaChat({ model, messages, temperature = 0.2 } = {}) {
  if (!tauriCore) return null;
  return await tauriCore.invoke('ollama_chat', { request: { model, messages, temperature } });
}

export async function ollamaEmbed({ model, input } = {}) {
  if (!tauriCore) return null;
  return await tauriCore.invoke('ollama_embed', { request: { model, input: Array.isArray(input) ? input : [input] } });
}

const UPDATE_MANIFEST_URL = globalThis.__PWB_UPDATE_MANIFEST_URL || "";

export async function checkForAppUpdate(currentVersion = "0.30.0") {
  if (tauriCore) {
    try {
      return await tauriCore.invoke("check_for_app_update");
    } catch (error) {
      return { configured: true, updateAvailable: false, error: String(error?.message || error) };
    }
  }
  if (!UPDATE_MANIFEST_URL) return { configured: false, updateAvailable: false };
  const response = await fetch(UPDATE_MANIFEST_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`Update service returned HTTP ${response.status}.`);
  const manifest = await response.json();
  return {
    configured: true,
    updateAvailable: String(manifest.version || "") !== currentVersion && compareVersions(String(manifest.version || "0.0.0"), currentVersion) > 0,
    version: manifest.version, notes: manifest.notes || "", url: manifest.url || manifest.releaseUrl || ""
  };
}

export async function installAppUpdate() {
  if (!tauriCore) throw new Error("Automatic installation is only available in the Windows desktop app.");
  return await tauriCore.invoke("install_app_update");
}

export async function openUpdatePage(url) {
  if (!url) return false;
  if (tauriCore) { try { await tauriCore.invoke('open_update_page', { url }); return true; } catch {} }
  window.open(url, '_blank', 'noopener,noreferrer'); return true;
}

function compareVersions(a, b) {
  const pa=a.split(/\D/).filter(Boolean).map(Number), pb=b.split(/\D/).filter(Boolean).map(Number);
  for(let i=0;i<Math.max(pa.length,pb.length);i++){ const x=pa[i]||0,y=pb[i]||0; if(x!==y)return x-y; } return 0;
}
