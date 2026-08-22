import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_STORE_NAMES, databaseInfo } from '../aiDatabase.js';

test('AI database has an independent name and schema boundary', () => {
  assert.equal(databaseInfo.name, 'pastors-workbench-ai');
  assert.ok(databaseInfo.name !== 'pastors-workbench');
  assert.deepEqual(AI_STORE_NAMES, ['conversations','messages','sessions','responses','memory','sources','actions','meta']);
});

test('AI database includes memory and source indexes for future retrieval', () => {
  assert.ok(AI_STORE_NAMES.includes('memory'));
  assert.ok(AI_STORE_NAMES.includes('sources'));
  assert.ok(AI_STORE_NAMES.includes('actions'));
});
