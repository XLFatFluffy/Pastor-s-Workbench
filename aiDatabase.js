// Dedicated AI persistence layer.
// Desktop: authoritative storage is a separate SQLite file (ai.db).
// Browser/dev fallback: legacy IndexedDB is retained for tests only.
import { isDesktop } from './desktopBridge.js';
import { sqliteGet, sqliteAll, sqlitePut, sqliteRemove, sqliteBulk, sqliteMeta } from './sqliteBridge.js';

const DB_NAME='pastors-workbench-ai'; const DB_VERSION=1;
export const AI_STORE_NAMES=Object.freeze(['conversations','messages','sessions','responses','memory','sources','actions','meta']);
let legacyDbPromise; let migrationPromise;
function openLegacy(){
  if(legacyDbPromise) return legacyDbPromise;
  if(typeof indexedDB==='undefined') throw new Error('IndexedDB is unavailable in this environment.');
  legacyDbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{const db=r.result;for(const n of AI_STORE_NAMES)if(!db.objectStoreNames.contains(n))db.createObjectStore(n,{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('Unable to open legacy AI database.'));});
  return legacyDbPromise;
}
async function legacyAll(name){const db=await openLegacy();const s=db.transaction(name,'readonly').objectStore(name);return new Promise((res,rej)=>{const r=s.getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error);});}
async function legacyGet(name,id){const db=await openLegacy();const s=db.transaction(name,'readonly').objectStore(name);return new Promise((res,rej)=>{const r=s.get(id);r.onsuccess=()=>res(r.result??null);r.onerror=()=>rej(r.error);});}
async function legacyPut(name,record){const db=await openLegacy();const s=db.transaction(name,'readwrite').objectStore(name);return new Promise((res,rej)=>{const r=s.put(record);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
async function legacyRemove(name,id){const db=await openLegacy();const s=db.transaction(name,'readwrite').objectStore(name);return new Promise((res,rej)=>{const r=s.delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error);});}
async function migrate(){
  if(!isDesktop()) return; if(migrationPromise) return migrationPromise;
  migrationPromise=(async()=>{const marker=await sqliteMeta('ai','migration_v1');if(marker==='complete')return;for(const n of AI_STORE_NAMES){const rows=await legacyAll(n);if(rows.length)await sqliteBulk('ai',n,rows);}await sqliteMeta('ai','migration_v1','complete');})().catch(e=>{migrationPromise=null;throw e;});
  return migrationPromise;
}
async function ensure(){if(isDesktop())await migrate();}
const uid=p=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
export async function get(n,id){if(!AI_STORE_NAMES.includes(n))throw new Error(`Unknown AI store: ${n}`);await ensure();return isDesktop()?sqliteGet('ai',n,id):legacyGet(n,id);}
export async function all(n){if(!AI_STORE_NAMES.includes(n))throw new Error(`Unknown AI store: ${n}`);await ensure();return isDesktop()?sqliteAll('ai',n):legacyAll(n);}
export async function put(n,r){if(!AI_STORE_NAMES.includes(n))throw new Error(`Unknown AI store: ${n}`);await ensure();return isDesktop()?sqlitePut('ai',n,r):legacyPut(n,r);}
export async function remove(n,id){if(!AI_STORE_NAMES.includes(n))throw new Error(`Unknown AI store: ${n}`);await ensure();return isDesktop()?sqliteRemove('ai',n,id):legacyRemove(n,id);}
export async function saveMemory(input={}){const record={id:input.id||uid('ai-memory'),category:input.category||'general',key:input.key||null,content:String(input.content||''),source:input.source||'user',confidence:Number.isFinite(input.confidence)?input.confidence:1,active:input.active!==false,created_at:input.created_at||new Date().toISOString(),updated_at:new Date().toISOString()};await put('memory',record);return record;}
export async function listMemory({activeOnly=true}={}){return (await all('memory')).filter(r=>!activeOnly||r.active!==false).sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)));}
export async function saveSource(input={}){const record={id:input.id||uid('ai-source'),source_type:input.source_type||'document',source_id:input.source_id||null,title:String(input.title||''),locator:input.locator||null,checksum:input.checksum||null,chunk_count:Number(input.chunk_count||0),metadata:input.metadata||{},created_at:input.created_at||new Date().toISOString(),updated_at:new Date().toISOString()};await put('sources',record);return record;}
export async function recordAction(input={}){const record={id:input.id||uid('ai-action'),type:input.type||'unknown',status:input.status||'completed',target_type:input.target_type||null,target_id:input.target_id||null,conversation_id:input.conversation_id||null,details:input.details||{},created_at:input.created_at||new Date().toISOString()};await put('actions',record);return record;}
export const databaseInfo=Object.freeze({name:DB_NAME,version:DB_VERSION,stores:AI_STORE_NAMES,desktop:'SQLite'});
