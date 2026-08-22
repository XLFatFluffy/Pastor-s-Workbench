import test from 'node:test';
import assert from 'node:assert/strict';
import { getConnectedEntities, getConnectedEntityRecords } from '../connectedKnowledgeService.js';
import { extractActions, buildSystemPrompt } from '../aiService.js';

test('v0.26 connected project APIs are exposed for reusable relationships', () => {
  assert.equal(typeof getConnectedEntities, 'function');
  assert.equal(typeof getConnectedEntityRecords, 'function');
});

test('v0.26 AI action schema supports project-linked knowledge captures', () => {
  const prompt = buildSystemPrompt();
  assert.match(prompt, /project_id/);
  const parsed = extractActions('Save this.\n```pwb-action\n{"type":"note","title":"Test","content":"Body","project_id":"project-1"}\n```');
  assert.equal(parsed.actions[0].project_id, 'project-1');
});
