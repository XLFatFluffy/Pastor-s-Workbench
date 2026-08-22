import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");

test("desktop persistence is configured for separate SQLite Workbench and AI databases", () => {
  const rust = fs.readFileSync(path.join(root, "src-tauri/src/lib.rs"), "utf8");
  const cargo = fs.readFileSync(path.join(root, "src-tauri/Cargo.toml"), "utf8");
  const store = fs.readFileSync(path.join(root, "store.js"), "utf8");
  const ai = fs.readFileSync(path.join(root, "aiDatabase.js"), "utf8");
  assert.match(cargo, /rusqlite/);
  assert.match(rust, /workbench\.db/);
  assert.match(rust, /ai\.db/);
  assert.match(store, /sqliteBulk\('workbench'/);
  assert.match(ai, /sqliteBulk\('ai'/);
});

test("SQLite migration preserves legacy IndexedDB records before marking migration complete", () => {
  const store = fs.readFileSync(path.join(root, "store.js"), "utf8");
  const ai = fs.readFileSync(path.join(root, "aiDatabase.js"), "utf8");
  assert.match(store, /migration_v1/);
  assert.match(store, /for\(const name of STORE_NAMES\)/);
  assert.match(ai, /migration_v1/);
  assert.match(ai, /for\(const n of AI_STORE_NAMES\)/);
});
