import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");

test("desktop updater is configured for signed Windows updates", () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, "src-tauri", "tauri.conf.json"), "utf8"));
  assert.equal(config.version, "0.30.0");
  assert.equal(config.bundle.createUpdaterArtifacts, true);
  assert.ok(config.plugins?.updater?.pubkey);
  assert.ok(Array.isArray(config.plugins?.updater?.endpoints));
  assert.ok(config.plugins.updater.endpoints[0].includes("latest.json"));
  assert.equal(config.plugins.updater.windows.installMode, "passive");
});

test("desktop settings expose an in-place update action", () => {
  const settings = fs.readFileSync(path.join(root, "views", "settingsView.js"), "utf8");
  assert.match(settings, /Download &amp; Install Update/);
  assert.match(settings, /installAppUpdate/);
  assert.match(settings, /0\.30\.0/);
});

test("native updater commands are registered", () => {
  const source = fs.readFileSync(path.join(root, "src-tauri", "src", "lib.rs"), "utf8");
  assert.match(source, /async fn check_for_app_update/);
  assert.match(source, /async fn install_app_update/);
  assert.match(source, /check_for_app_update, install_app_update/);
});
