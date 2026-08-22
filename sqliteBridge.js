// Native SQLite bridge for the Windows desktop build.
// The browser fallback remains available only for development/tests; the installed
// desktop app stores authoritative Workbench and AI data in separate SQLite files.
import { isDesktop } from './desktopBridge.js';

let core = null;
try { core = globalThis.__TAURI__?.core || null; } catch { core = null; }

export const sqliteAvailable = () => Boolean(core && isDesktop());

async function invoke(command, args = {}) {
  if (!core) throw new Error('Native SQLite is unavailable outside the desktop application.');
  return core.invoke(command, args);
}

export async function sqliteStatus(database = 'workbench') {
  return invoke('sqlite_status', { database });
}
export async function sqliteGet(database, store, id) {
  return invoke('sqlite_get', { database, store, id });
}
export async function sqliteAll(database, store) {
  return invoke('sqlite_all', { database, store });
}
export async function sqlitePut(database, store, record) {
  return invoke('sqlite_put', { database, store, record });
}
export async function sqliteRemove(database, store, id) {
  return invoke('sqlite_remove', { database, store, id });
}
export async function sqliteBulk(database, store, records) {
  return invoke('sqlite_bulk', { database, store, records });
}
export async function sqliteClear(database, store) {
  return invoke('sqlite_clear', { database, store });
}
export async function sqliteMeta(database, key, value) {
  return invoke('sqlite_meta', { database, key, value });
}
