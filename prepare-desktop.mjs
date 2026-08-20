import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const frontend = path.join(root, 'frontend');

const files = [
  'index.html', 'styles.css', 'main.js',
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
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(frontend, file));
}

for (const dir of dirs) {
  const src = path.join(root, dir);
  const dest = path.join(frontend, dir);
  if (fs.existsSync(src)) fs.cpSync(src, dest, { recursive: true });
}

console.log(`Desktop frontend prepared at ${frontend}`);
