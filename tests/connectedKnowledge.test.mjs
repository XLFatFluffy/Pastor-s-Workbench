import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRelationship } from '../relationships.js';
import { linkScripture } from '../connectedKnowledgeService.js';

test('v0.18 relationship model supports study-to-scripture links', () => {
  const r = normalizeRelationship({ id:'r1', source_type:'Study', source_id:'study:1', target_type:'BibleVerse', target_id:'KJV:1-john-1-1', relationship_type:'scripture' });
  assert.equal(r.relationship_type, 'scripture');
  assert.equal(r.source_type, 'Study');
  assert.equal(r.target_type, 'BibleVerse');
});

test('v0.18 connected knowledge exposes scripture linking API', () => {
  assert.equal(typeof linkScripture, 'function');
});
