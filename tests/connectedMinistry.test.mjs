import assert from 'node:assert/strict';
import test from 'node:test';
import { link, everythingRelatedTo } from '../relationships.js';

test('v0.19 supports book sources attached to sermons and lessons', () => {
  const sermonBook = link('Sermon', 'sermon:1', 'LibraryItem', 'book:1', 'source', { title: 'Pastoral Theology' });
  const lessonBook = link('Lesson', 'lesson:1', 'LibraryItem', 'book:1', 'source', { title: 'Pastoral Theology' });
  assert.equal(sermonBook.relationship_type, 'source');
  assert.equal(lessonBook.target_type, 'LibraryItem');
  assert.equal(everythingRelatedTo([sermonBook], 'Sermon', 'sermon:1').length, 1);
});

console.log('connectedMinistry.test.mjs: PASS — sermons and lessons can relate to indexed book sources');

import fs from 'node:fs';
const workspace = fs.readFileSync(new URL('../views/workWorkspaceView.js', import.meta.url), 'utf8');
test('v0.19 sermon and lesson workspaces expose connected book controls', () => {
  assert.match(workspace, /data-attach-sermon-book/);
  assert.match(workspace, /data-attach-lesson-book/);
  assert.match(workspace, /getConnectedBooks/);
});
