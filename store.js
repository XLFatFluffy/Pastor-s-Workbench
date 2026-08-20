// store.js — Phase 1 persistence layer.
// Pure IndexedDB wrapper. It does not validate, index, sync, or apply business rules.

const DB_NAME = "pastors-workbench";
const DB_VERSION = 6;

export const STORE_NAMES = Object.freeze([
  "profiles", "workspaces", "projects", "sermons", "sermon_stages", "sermon_points",
  "lessons", "lesson_teaching_sections", "studies", "notes", "research_items", "topics",
  "collections", "sources", "resources", "library_items", "documents", "templates", "tags",
  "ai_sessions", "ai_responses", "ai_conversations", "ai_messages", "versions", "changes",
  "bible_translations", "bible_books", "bible_chapters", "bible_verses", "bible_text",
  "concordance_entries", "cross_references", "bible_annotations", "bible_history", "confessions", "confession_chapters",
  "confession_paragraphs", "relationships", "cross_reference_index", "book_chunks"
]);

let dbPromise;

function assertIndexedDB() {
  if (typeof indexedDB === "undefined") throw new Error("IndexedDB is unavailable in this environment.");
}

function openDatabase() {
  assertIndexedDB();
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const storeName of STORE_NAMES) {
        if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Unable to open Workbench database."));
  });

  return dbPromise;
}

async function objectStore(storeName, mode) {
  if (!STORE_NAMES.includes(storeName)) throw new Error(`Unknown Workbench store: ${storeName}`);
  const db = await openDatabase();
  return db.transaction(storeName, mode).objectStore(storeName);
}

export async function get(storeName, id) {
  const store = await objectStore(storeName, "readonly");
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function put(storeName, record) {
  const store = await objectStore(storeName, "readwrite");
  return new Promise((resolve, reject) => {
    const request = store.put(record);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function all(storeName) {
  const store = await objectStore(storeName, "readonly");
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function remove(storeName, id) {
  const store = await objectStore(storeName, "readwrite");
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function bulk(storeName, records) {
  const store = await objectStore(storeName, "readwrite");
  return new Promise((resolve, reject) => {
    const keys = [];
    if (records.length === 0) return resolve(keys);
    let remaining = records.length;
    let failed = false;
    for (const record of records) {
      const request = store.put(record);
      request.onsuccess = () => {
        keys.push(request.result);
        remaining -= 1;
        if (remaining === 0 && !failed) resolve(keys);
      };
      request.onerror = () => {
        failed = true;
        reject(request.error);
      };
    }
  });
}

export async function clear(storeName) {
  const store = await objectStore(storeName, "readwrite");
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export const databaseInfo = Object.freeze({ name: DB_NAME, version: DB_VERSION, stores: STORE_NAMES });
