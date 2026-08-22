import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProject, normalizeSermon, normalizeSermonStage, normalizeSermonPoint, normalizeLesson, normalizeLessonSection, normalizeStudy } from '../sermonService.js';

test('Phase 7 project normalization creates a draft project', () => {
  const p = normalizeProject({ title: '1 John', project_type: 'sermon' });
  assert.equal(p.project_type, 'sermon'); assert.equal(p.status, 'draft'); assert.match(p.id, /^project:/);
});

test('Phase 7 rejects invalid project type', () => assert.throws(() => normalizeProject({ title: 'x', project_type: 'banana' }), /Invalid project type/));

test('Phase 7 sermon requires project and title', () => {
  const s = normalizeSermon({ project_id: 'project:1', title: 'Christ Our Life' });
  assert.equal(s.project_id, 'project:1'); assert.equal(s.status, 'draft');
});

test('Phase 7 sermon stage and point validate structure', () => {
  const stage = normalizeSermonStage({ sermon_id: 'sermon:1', stage_key: 'text_analysis', content: 'Observe the text.' });
  const point = normalizeSermonPoint({ sermon_id: 'sermon:1', position: 1, title: 'The Word of Life' });
  assert.equal(stage.stage_key, 'text_analysis'); assert.equal(point.position, 1);
  assert.throws(() => normalizeSermonStage({ sermon_id: 'sermon:1', stage_key: 'bad' }), /Invalid sermon stage/);
});

test('Phase 7 lesson and study records normalize into their domain schemas', () => {
  const lesson = normalizeLesson({ project_id: 'project:2', title: 'Week One' });
  const section = normalizeLessonSection({ lesson_id: lesson.id, position: 1, title: 'The Bible' });
  const study = normalizeStudy({ project_id: 'project:3', title: 'Romans 9' });
  assert.equal(section.lesson_id, lesson.id); assert.equal(study.project_id, 'project:3');
});


test('Phase 7 project-linked knowledge keeps the project id available to the domain record', async () => {
  const { normalizeResearchItem } = await import('../researchService.js');
  const { normalizeNote } = await import('../researchService.js');
  assert.equal(normalizeResearchItem({ project_id: 'project:sermon', title: 'Observation', content: 'Text', origin: 'personal' }).project_id, 'project:sermon');
  assert.equal(normalizeNote({ project_id: 'project:sermon', title: 'Note', content: 'Remember this', origin: 'personal' }).project_id, 'project:sermon');
});
