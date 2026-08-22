import assert from 'node:assert/strict';
import {
  getRelatedDomains,
  getRelatedNotes,
  getRelatedResearch,
  getRelatedSermons,
  getRelatedLessons,
  getRelatedStudies,
  getRelatedTopics,
  linkParagraphToEntity,
  unlinkParagraphFromEntity,
  search
} from '../confessionService.js';

const domains = getRelatedDomains();
assert.deepEqual(domains.map(d => d.targetType), ['Note','ResearchItem','Sermon','Lesson','Study','Topic']);
assert.deepEqual(domains.map(d => d.relationshipType), ['note','research','sermon','lesson','study','topic']);
for (const fn of [getRelatedNotes,getRelatedResearch,getRelatedSermons,getRelatedLessons,getRelatedStudies,getRelatedTopics,linkParagraphToEntity,unlinkParagraphFromEntity,search]) {
  assert.equal(typeof fn, 'function');
}
assert.equal(typeof search, 'function');
console.log('phase3WorkbenchRelationships.test.mjs: PASS — six Workbench relationship domains exposed through ConfessionService');
