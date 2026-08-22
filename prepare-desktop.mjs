import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const frontend = path.join(root, 'frontend');

// The desktop build packages the generated frontend directory. Keep this list
// complete for every browser-side root module referenced by index.html or the
// application shell. Missing one of these files produces a valid Tauri window
// that contains only the static HTML shell because JavaScript module loading
// fails at runtime.
const files = [
  'index.html', 'styles.css', 'main.js', 'theme.js', 'workspaceAI.js',
  'aiService.js', 'bibleService.js', 'concordanceService.js',
  'confessionService.js', 'contextService.js', 'crossReferenceService.js',
  'dataModel.js', 'desktopBridge.js', 'documentService.js', 'globalAI.js',
  'libraryService.js', 'relationships.js', 'researchService.js',
  'sermonService.js', 'store.js'
];
const dirs = ['views', 'data'];

fs.rmSync(frontend, { recursive: true, force: true });
fs.mkdirSync(frontend, { recursive: true });

for (const file of files) {
  const src = path.join(root, file);
  if (!fs.existsSync(src)) {
    throw new Error(`Required desktop frontend file is missing: ${file}`);
  }
  fs.copyFileSync(src, path.join(frontend, file));
}

for (const dir of dirs) {
  const src = path.join(root, dir);
  const dest = path.join(frontend, dir);
  if (fs.existsSync(src)) fs.cpSync(src, dest, { recursive: true });
}

console.log(`Desktop frontend prepared at ${frontend}`);
