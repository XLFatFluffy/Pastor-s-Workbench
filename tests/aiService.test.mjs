import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemPrompt } from '../aiService.js';

test('AI system prompt establishes source-aware Workbench behavior', () => {
  const prompt = buildSystemPrompt({ userAbout: 'Pastor who prefers careful expository work', instructions: 'Do not invent citations.' });
  assert.match(prompt, /Pastor's Workbench/);
  assert.match(prompt, /Do not invent quotations/);
  assert.match(prompt, /Pastor who prefers careful expository work/);
  assert.match(prompt, /Do not invent citations/);
});
