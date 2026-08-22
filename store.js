// Workbench persistence layer.
// Desktop: authoritative data lives in %APPDATA%/Pastors Workbench/workbench.db.
// Browser/dev fallback: legacy IndexedDB remains available for automated tests.
import { isDesktop } from './desktopBridge.js';
import { sqliteGet, sqliteAll, sqlitePut, sqliteRemove, sqliteBulk, sqliteClear, sqliteMeta } from './sqliteBridge.js';

const DB_NAME = 'pastors-workbench';
const DB_VERSION = 9;
export const STORE_NAMES = Object.freeze([
  'profiles','workspaces','projects','sermons','sermon_stages','sermon_points','lessons','lesson_teaching_sections','studies','notes','research_items','topics','collections','sources','resources','library_items','documents','templates','tags','ai_sessions','ai_responses','ai_conversations','ai_messages','versions','changes','bible_translations','bible_books','bible_chapters','bible_verses','bible_text','concordance_entries','cross_references','bible_annotations','bible_history','confessions','confession_chapters','confession_paragraphs','calendar_events','daily_tasks','relationships','cross_reference_index','book_chunks','document_chunks','knowledge_sources','knowledge_chunks'
]);

let legacyDbPromise;
let migrationPromise;
function assertIndexedDB(){ if(typeof indexedDB==='undefined') throw new Error('IndexedDB is unavailable in this environment.'); }
function openLegacyDatabase(){
  assertIndexedDB(); if(legacyDbPromise) return legacyDbPromise;
  legacyDbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{ const db=req.result; for(const n of STORE_NAMES) if(!db.objectStoreNames.contains(n)) db.createObjectStore(n,{keyPath:'id'}); };
    req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error||new Error('Unable to open legacy Workbench database.'));
  }); return legacyDbPromise;
}
async function legacyAll(name){ const db=await openLegacyDatabase(); const s=db.transaction(name,'readonly').objectStore(name); return new Promise((resolve,reject)=>{const r=s.getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error);}); }
async function migrateLegacyIfNeeded(){
  if(!isDesktop()) return;
  if(migrationPromise) return migrationPromise;
  migrationPromise=(async()=>{
    const marker=await sqliteMeta('workbench','migration_v1');
    if(marker==='complete') return;
    for(const name of STORE_NAMES){ const rows=await legacyAll(name); if(rows.length) await sqliteBulk('workbench',name,rows); }
    await sqliteMeta('workbench','migration_v1','complete');
  })().catch(error=>{ migrationPromise=null; throw error; });
  return migrationPromise;
}
async function ensure(){ if(isDesktop()) await migrateLegacyIfNeeded(); }
export async function get(storeName,id){ if(!STORE_NAMES.includes(storeName)) throw new Error(`Unknown Workbench store: ${storeName}`); await ensure(); return isDesktop()?sqliteGet('workbench',storeName,id):legacyGet(storeName,id); }
export async function put(storeName,record){ if(!STORE_NAMES.includes(storeName)) throw new Error(`Unknown Workbench store: ${storeName}`); await ensure(); return isDesktop()?sqlitePut('workbench',storeName,record):legacyPut(storeName,record); }
export async function all(storeName){ if(!STORE_NAMES.includes(storeName)) throw new Error(`Unknown Workbench store: ${storeName}`); await ensure(); return isDesktop()?sqliteAll('workbench',storeName):legacyAll(storeName); }
export async function remove(storeName,id){ if(!STORE_NAMES.includes(storeName)) throw new Error(`Unknown Workbench store: ${storeName}`); await ensure(); return isDesktop()?sqliteRemove('workbench',storeName,id):legacyRemove(storeName,id); }
export async function bulk(storeName,records){ if(!STORE_NAMES.includes(storeName)) throw new Error(`Unknown Workbench store: ${storeName}`); await ensure(); return isDesktop()?sqliteBulk('workbench',storeName,records):legacyBulk(storeName,records); }
export async function clear(storeName){ if(!STORE_NAMES.includes(storeName)) throw new Error(`Unknown Workbench store: ${storeName}`); await ensure(); return isDesktop()?sqliteClear('workbench',storeName):legacyClear(storeName); }

async function legacyStore(name,mode='readonly'){ const db=await openLegacyDatabase(); return db.transaction(name,mode).objectStore(name); }
async function legacyGet(n,id){const s=await legacyStore(n);return new Promise((res,rej)=>{const r=s.get(id);r.onsuccess=()=>res(r.result??null);r.onerror=()=>rej(r.error);});}
async function legacyPut(n,x){const s=await legacyStore(n,'readwrite');return new Promise((res,rej)=>{const r=s.put(x);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
async function legacyRemove(n,id){const s=await legacyStore(n,'readwrite');return new Promise((res,rej)=>{const r=s.delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error);});}
async function legacyBulk(n,rows){const s=await legacyStore(n,'readwrite');return Promise.all(rows.map(x=>new Promise((res,rej)=>{const r=s.put(x);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);})));}
async function legacyClear(n){const s=await legacyStore(n,'readwrite');return new Promise((res,rej)=>{const r=s.clear();r.onsuccess=()=>res();r.onerror=()=>rej(r.error);});}
export const databaseInfo=Object.freeze({name:DB_NAME,version:DB_VERSION,stores:STORE_NAMES,desktop:'SQLite'});
