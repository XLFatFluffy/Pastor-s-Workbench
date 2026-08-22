import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const frontend = path.join(root, 'frontend');

// The desktop build packages the generated frontend directory. Copy every
// browser-side JavaScript module at the repository root instead of maintaining
// a fragile hand-written allowlist. A missing transitive module produces a
// valid Tauri window containing only the static HTML shell.
const requiredFiles = [
  'index.html',
  'styles.css'
];
const dirs = ['views', 'data'];

fs.rmSync(frontend, { recursive: true, force: true });
fs.mkdirSync(frontend, { recursive: true });

for (const file of requiredFiles) {
  const src = path.join(root, file);
  if (!fs.existsSync(src)) {
    throw new Error(`Required desktop frontend file is missing: ${file}`);
  }
  fs.copyFileSync(src, path.join(frontend, file));
}

for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
  const src = path.join(root, entry.name);
  fs.copyFileSync(src, path.join(frontend, entry.name));
}

for (const dir of dirs) {
  const src = path.join(root, dir);
  const dest = path.join(frontend, dir);
  if (fs.existsSync(src)) fs.cpSync(src, dest, { recursive: true });
}

console.log(`Desktop frontend prepared at ${frontend}`);
