import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlanningProposal, summarizePlanningProposal } from '../planningService.js';
import { extractActions, buildSystemPrompt } from '../aiService.js';

test('v0.27 planning proposal validates tasks and calendar blocks', () => {
  const plan = normalizePlanningProposal({
    title: 'Finish Romans 8 sermon', goal: 'Prepare the sermon by Sunday.', project_id: 'p1',
    tasks: [{ title: 'Study Romans 8', due_date: '2026-08-21', priority: 'high', project_id: 'p1' }],
    events: [{ title: 'Sermon preparation', start_at: '2026-08-21T09:00:00', end_at: '2026-08-21T10:30:00', project_id: 'p1' }]
  });
  assert.equal(plan.tasks.length, 1);
  assert.equal(plan.events.length, 1);
  assert.deepEqual(summarizePlanningProposal(plan), { title: 'Finish Romans 8 sermon', goal: 'Prepare the sermon by Sunday.', taskCount: 1, eventCount: 1, tasks: [{ title: 'Study Romans 8', due_date: '2026-08-21', priority: 'high' }], events: [{ title: 'Sermon preparation', start_at: '2026-08-21T09:00:00', end_at: '2026-08-21T10:30:00' }] });
});

test('v0.27 planning is represented as an approval-gated AI action', () => {
  const prompt = buildSystemPrompt();
  assert.match(prompt, /"type":"plan"/);
  assert.match(prompt, /A plan is always approval-gated/);
  const parsed = extractActions('Plan it.\n```pwb-action\n{"type":"plan","title":"Finish sermon","goal":"By Sunday","tasks":[{"title":"Study text","due_date":"2026-08-21","priority":"high"}],"events":[]}\n```');
  assert.equal(parsed.actions[0].type, 'plan');
  assert.equal(parsed.actions[0].tasks.length, 1);
});
