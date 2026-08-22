import test from 'node:test';
import assert from 'node:assert/strict';
import { getWorkspaceAIContract } from '../workspaceAI.js';

test('workspace AI contract provides contextual prompts', () => {
  const c = getWorkspaceAIContract('sermons');
  assert.equal(c.route, 'sermons');
  assert.ok(c.capabilities.length >= 3);
  assert.match(c.instruction, /current.*workspace/i);
});
