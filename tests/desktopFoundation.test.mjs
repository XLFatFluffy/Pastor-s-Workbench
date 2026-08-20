import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('.');
const config = JSON.parse(fs.readFileSync(path.join(root, 'src-tauri', 'tauri.conf.json'), 'utf8'));

test('Tauri desktop configuration embeds the existing frontend', () => {
  assert.equal(config.productName, "Pastor's Workbench");
  assert.equal(config.build.frontendDist, '../frontend');
  assert.equal(config.app.windows[0].title, "Pastor's Workbench");
  assert.deepEqual(config.bundle.targets, ['msi']);
  assert.equal(config.app.withGlobalTauri, true);
});

test('desktop build has no localhost production URL requirement', () => {
  assert.equal('devUrl' in config.build, false);
});

test('desktop Rust entrypoint exists', () => {
  assert.ok(fs.existsSync(path.join(root, 'src-tauri', 'src', 'main.rs')));
  assert.ok(fs.existsSync(path.join(root, 'src-tauri', 'src', 'lib.rs')));
  assert.ok(fs.existsSync(path.join(root, 'src-tauri', 'Cargo.toml')));
});


test('desktop native integration bridge is present', () => {
  const bridge = fs.readFileSync(path.join(root, 'desktopBridge.js'), 'utf8');
  assert.match(bridge, /desktop_info/);
  assert.match(bridge, /desktop_health/);
  assert.match(bridge, /open_app_data_folder/);
});

test('desktop build scripts include environment diagnostics', () => {
  const check = fs.readFileSync(path.join(root, 'CHECK DESKTOP REQUIREMENTS.bat'), 'utf8');
  const build = fs.readFileSync(path.join(root, "BUILD PASTORS WORKBENCH DESKTOP.bat"), 'utf8');
  assert.match(check, /rustc/);
  assert.match(check, /ollama/);
  assert.match(build, /desktop:build/);
});
