import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getRecommendedAIModel } from '../aiService.js';

const root = path.resolve(new URL('..', import.meta.url).pathname);

test('Gemma 3 4B is the recommended local model', () => {
  assert.equal(getRecommendedAIModel(), 'gemma3:4b');
});

test('AI Settings prepares Ollama for Gemma 3 4B', () => {
  const view = fs.readFileSync(path.join(root, 'views', 'settingsView.js'), 'utf8');
  assert.match(view, /Gemma 3 4B/);
  assert.match(view, /gemma3:4b/);
  assert.match(view, /Check connection/);
});
