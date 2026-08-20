import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../views/workWorkspaceView.js', import.meta.url), 'utf8');

test('expository workspace exposes the integrated study desk', () => {
  assert.match(source, /Integrated study desk/);
  assert.match(source, /getPassage/);
  assert.match(source, /searchConfession/);
  assert.match(source, /listCrossReferences/);
  assert.match(source, /Insert into current step/);
});
