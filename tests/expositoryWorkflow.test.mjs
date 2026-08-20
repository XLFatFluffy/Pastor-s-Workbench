import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPOSITORY_STAGE_KEYS, SERMON_STAGE_META } from '../dataModel.js';

test('expository workflow is explicitly eight preparation steps', () => {
  assert.equal(EXPOSITORY_STAGE_KEYS.length, 8);
  assert.deepEqual(EXPOSITORY_STAGE_KEYS.map(k => SERMON_STAGE_META[k].number), [1,2,3,4,5,6,7,8]);
  assert.equal(SERMON_STAGE_META.text_structure.number, 3);
  assert.equal(SERMON_STAGE_META.text_intent.number, 4);
  assert.equal(SERMON_STAGE_META.sermon_intent.number, 5);
  assert.equal(SERMON_STAGE_META.personal_assimilation.number, 8);
});
