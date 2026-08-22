import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemPrompt, extractActions } from '../aiService.js';

test('AI prompt requires an explicit note action when asked to save or capture', () => {
  const prompt = buildSystemPrompt();
  assert.match(prompt, /save, keep, capture, add, record, or make a note/);
  assert.match(prompt, /MUST emit a note action/);
});

test('AI note actions support the Workbench note schema', () => {
  const parsed = extractActions('I will save this.\n```pwb-action\n{"type":"note","title":"Romans 8 observation","content":"God works all things together for good.","note_type":"observation"}\n```');
  assert.equal(parsed.actions.length, 1);
  assert.equal(parsed.actions[0].type, 'note');
  assert.equal(parsed.actions[0].note_type, 'observation');
});

test('AI note action schema accepts an omitted project so current workspace can supply it', () => {
  const parsed = extractActions('```pwb-action\n{"type":"note","title":"Saved note","content":"Important observation.","note_type":"general"}\n```');
  assert.equal(parsed.actions[0].project_id, undefined);
});
