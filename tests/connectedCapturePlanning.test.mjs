import test from 'node:test';
import assert from 'node:assert/strict';
import { extractActions } from '../aiService.js';

test('AI extracts approval-based task actions', () => {
  const { answer, actions } = extractActions('I can add this.\n```pwb-action\n{"type":"task","title":"Finish 1 John outline","due_date":"2026-08-21","priority":"high","project_id":"project:1"}\n```');
  assert.equal(answer, 'I can add this.');
  assert.deepEqual(actions[0], { type:'task', title:'Finish 1 John outline', due_date:'2026-08-21', priority:'high', project_id:'project:1' });
});

test('AI extracts approval-based calendar actions', () => {
  const { actions } = extractActions('```pwb-action\n{"type":"calendar_event","title":"Sermon preparation","start_at":"2026-08-21T09:00:00","end_at":"2026-08-21T10:30:00","all_day":false}\n```');
  assert.equal(actions[0].type, 'calendar_event');
  assert.equal(actions[0].start_at, '2026-08-21T09:00:00');
});
