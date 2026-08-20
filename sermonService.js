// Phase 7 — Sermon, Lesson, Study, and Project domain service.
// Project containers own the workflow; specialized records hold domain content.
// UI never accesses IndexedDB directly.

import { all, get, put, remove } from "./store.js";
import { createRecord, PROJECT_TYPES, PROJECT_STATUSES, SERMON_STAGE_KEYS, EXPOSITORY_STAGE_KEYS, SERMON_STAGE_META } from "./dataModel.js";
import { detachKnowledgeFromProject } from "./researchService.js";

const STORES = Object.freeze({
  project: "projects",
  sermon: "sermons",
  stage: "sermon_stages",
  point: "sermon_points",
  lesson: "lessons",
  lessonSection: "lesson_teaching_sections",
  study: "studies"
});

const SPECIALIZED = Object.freeze({ sermon: "Sermon", lesson: "Lesson", study: "Study" });

function uid(prefix) {
  return `${prefix}:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}
function now() { return new Date().toISOString(); }
function clean(v) { return String(v ?? "").trim(); }
function required(v, name) { const value = clean(v); if (!value) throw new TypeError(`${name} is required.`); return value; }

export function normalizeProject(input = {}) {
  const projectType = clean(input.project_type).toLowerCase() || "general";
  const status = clean(input.status).toLowerCase() || "draft";
  if (!PROJECT_TYPES.includes(projectType)) throw new TypeError(`Invalid project type: ${projectType}`);
  if (!PROJECT_STATUSES.includes(status)) throw new TypeError(`Invalid project status: ${status}`);
  const record = {
    id: clean(input.id) || uid("project"),
    workspace_id: clean(input.workspace_id) || "default",
    user_id: clean(input.user_id) || "local-user",
    project_type: projectType,
    title: required(input.title, "Project.title"),
    description: clean(input.description),
    status,
    created_at: input.created_at || now(),
    updated_at: now(),
    archived_at: input.archived_at ?? null
  };
  return createRecord("Project", record);
}

export function normalizeSermon(input = {}) {
  return createRecord("Sermon", {
    id: clean(input.id) || uid("sermon"), project_id: required(input.project_id, "Sermon.project_id"),
    title: required(input.title, "Sermon.title"), primary_text: clean(input.primary_text),
    sermon_intent: clean(input.sermon_intent), text_intent: clean(input.text_intent),
    structure: input.structure && typeof input.structure === "object" ? { ...input.structure } : {},
    manuscript: clean(input.manuscript), status: clean(input.status).toLowerCase() || "draft",
    preached_at: input.preached_at ?? null, created_at: input.created_at || now(), updated_at: now()
  });
}

export function normalizeSermonStage(input = {}) {
  const stageKey = clean(input.stage_key);
  if (!SERMON_STAGE_KEYS.includes(stageKey)) throw new TypeError(`Invalid sermon stage: ${stageKey}`);
  return createRecord("SermonStage", {
    id: clean(input.id) || uid("sermon-stage"), sermon_id: required(input.sermon_id, "SermonStage.sermon_id"),
    stage_key: stageKey, content: clean(input.content), created_at: input.created_at || now(), updated_at: now()
  });
}

export function normalizeSermonPoint(input = {}) {
  const position = Number(input.position ?? 0);
  if (!Number.isFinite(position)) throw new TypeError("SermonPoint.position must be a number.");
  return createRecord("SermonPoint", {
    id: clean(input.id) || uid("sermon-point"), sermon_id: required(input.sermon_id, "SermonPoint.sermon_id"),
    parent_point_id: clean(input.parent_point_id) || "", position,
    title: required(input.title, "SermonPoint.title"), explanation: clean(input.explanation),
    illustration: clean(input.illustration), application: clean(input.application),
    created_at: input.created_at || now(), updated_at: now()
  });
}

export function normalizeLesson(input = {}) {
  return createRecord("Lesson", {
    id: clean(input.id) || uid("lesson"), project_id: required(input.project_id, "Lesson.project_id"),
    title: required(input.title, "Lesson.title"), subtitle: clean(input.subtitle), purpose: clean(input.purpose),
    overview: clean(input.overview), key_truth: clean(input.key_truth), key_scripture: clean(input.key_scripture),
    personal_application: clean(input.personal_application), memory_verse: clean(input.memory_verse),
    takeaway: clean(input.takeaway), created_at: input.created_at || now(), updated_at: now()
  });
}

export function normalizeLessonSection(input = {}) {
  const position = Number(input.position ?? 0);
  if (!Number.isFinite(position)) throw new TypeError("LessonTeachingSection.position must be a number.");
  return createRecord("LessonTeachingSection", {
    id: clean(input.id) || uid("lesson-section"), lesson_id: required(input.lesson_id, "LessonTeachingSection.lesson_id"),
    position, title: required(input.title, "LessonTeachingSection.title"), content: clean(input.content),
    scripture_references: Array.isArray(input.scripture_references) ? [...input.scripture_references] : [],
    created_at: input.created_at || now(), updated_at: now()
  });
}

export function normalizeStudy(input = {}) {
  return createRecord("Study", {
    id: clean(input.id) || uid("study"), project_id: required(input.project_id, "Study.project_id"),
    title: required(input.title, "Study.title"), description: clean(input.description),
    primary_question: clean(input.primary_question), conclusion: clean(input.conclusion),
    created_at: input.created_at || now(), updated_at: now()
  });
}

async function save(store, record) { await put(store, record); return record; }

export async function saveProject(input) { return save(STORES.project, normalizeProject(input)); }
export async function saveSermon(input) { return save(STORES.sermon, normalizeSermon(input)); }
export async function saveSermonStage(input) { return save(STORES.stage, normalizeSermonStage(input)); }
export async function saveSermonPoint(input) { return save(STORES.point, normalizeSermonPoint(input)); }
export async function saveLesson(input) { return save(STORES.lesson, normalizeLesson(input)); }
export async function saveLessonSection(input) { return save(STORES.lessonSection, normalizeLessonSection(input)); }
export async function saveStudy(input) { return save(STORES.study, normalizeStudy(input)); }

export async function getProject(id) { return get(STORES.project, id); }
export async function getSermon(id) { return get(STORES.sermon, id); }
export async function getLesson(id) { return get(STORES.lesson, id); }
export async function getStudy(id) { return get(STORES.study, id); }

export async function listProjects({ type = null, status = null, search = "" } = {}) {
  const needle = clean(search).toLowerCase();
  return (await all(STORES.project)).filter((p) =>
    (!type || p.project_type === type) && (!status || p.status === status) &&
    (!needle || `${p.title} ${p.description}`.toLowerCase().includes(needle))
  ).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
}

export function getSermonStageMeta(stageKey) { return SERMON_STAGE_META[stageKey] || null; }

export async function initializeSermonWorkflow(sermonId) {
  const existing = await all(STORES.stage);
  for (const stageKey of SERMON_STAGE_KEYS) {
    if (!existing.some(row => row.sermon_id === sermonId && row.stage_key === stageKey)) {
      await saveSermonStage({ sermon_id: sermonId, stage_key: stageKey, content: "" });
    }
  }
  return getSermonWorkspace(sermonId);
}

export async function getSermonProgress(sermonId) {
  const workspace = await getSermonWorkspace(sermonId);
  if (!workspace) return null;
  const completed = new Set(workspace.stages.filter(s => s.content.trim()).map(s => s.stage_key));
  const preparationComplete = EXPOSITORY_STAGE_KEYS.filter(k => completed.has(k)).length;
  return { total: EXPOSITORY_STAGE_KEYS.length, completed: preparationComplete, percent: Math.round(preparationComplete / EXPOSITORY_STAGE_KEYS.length * 100), completedKeys: [...completed] };
}

export async function getSermonWorkspace(sermonId) {
  const sermon = await getSermon(sermonId);
  if (!sermon) return null;
  const [stages, points] = await Promise.all([
    all(STORES.stage).then(rows => rows.filter(r => r.sermon_id === sermonId).sort((a,b) => a.stage_key.localeCompare(b.stage_key))),
    all(STORES.point).then(rows => rows.filter(r => r.sermon_id === sermonId).sort((a,b) => a.position - b.position))
  ]);
  return { sermon, stages, points };
}

export async function getLessonWorkspace(lessonId) {
  const lesson = await getLesson(lessonId);
  if (!lesson) return null;
  const sections = (await all(STORES.lessonSection)).filter(r => r.lesson_id === lessonId).sort((a,b) => a.position - b.position);
  return { lesson, sections };
}

export async function getStudyWorkspace(studyId) { const study = await getStudy(studyId); return study ? { study } : null; }

export async function listSpecialized(type) {
  const store = STORES[type];
  if (!store || !SPECIALIZED[type]) throw new TypeError(`Unsupported project type: ${type}`);
  const rows = await all(store);
  return rows.sort((a,b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)));
}

export async function deleteProject(projectId) {
  const project = await getProject(projectId);
  if (!project) return false;
  const [sermons, lessons, studies] = await Promise.all([
    all(STORES.sermon).then(rows => rows.filter(r => r.project_id === projectId)),
    all(STORES.lesson).then(rows => rows.filter(r => r.project_id === projectId)),
    all(STORES.study).then(rows => rows.filter(r => r.project_id === projectId))
  ]);
  for (const sermon of sermons) {
    for (const row of await all(STORES.stage)) if (row.sermon_id === sermon.id) await remove(STORES.stage, row.id);
    for (const row of await all(STORES.point)) if (row.sermon_id === sermon.id) await remove(STORES.point, row.id);
    await remove(STORES.sermon, sermon.id);
  }
  for (const lesson of lessons) {
    for (const row of await all(STORES.lessonSection)) if (row.lesson_id === lesson.id) await remove(STORES.lessonSection, row.id);
    await remove(STORES.lesson, lesson.id);
  }
  for (const study of studies) await remove(STORES.study, study.id);
  await detachKnowledgeFromProject(projectId);
  await remove(STORES.project, projectId);
  return true;
}

export async function deleteSermon(sermonId) {
  for (const row of await all(STORES.stage)) if (row.sermon_id === sermonId) await remove(STORES.stage, row.id);
  for (const row of await all(STORES.point)) if (row.sermon_id === sermonId) await remove(STORES.point, row.id);
  await remove(STORES.sermon, sermonId);
}
export async function deleteLesson(lessonId) {
  for (const row of await all(STORES.lessonSection)) if (row.lesson_id === lessonId) await remove(STORES.lessonSection, row.id);
  await remove(STORES.lesson, lessonId);
}
export async function deleteStudy(studyId) { await remove(STORES.study, studyId); }

export const phase7Stores = STORES;
