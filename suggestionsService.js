// v0.22 — Proactive suggestion engine.
// Deterministic (non-AI) scan of the pastor's active work for useful connections
// that already exist in the Workbench but have not been linked yet: Scripture
// references mentioned in text, available cross references, and research/notes
// that share a project's title/topic wording. Nothing here writes anything —
// every suggestion is surfaced as a dismissible card and only applied when the
// pastor clicks "Add to Workbench," using the same relationship engine the rest
// of the app uses.
import { listProjects, getSermonWorkspace, getLessonWorkspace, getStudyWorkspace } from './sermonService.js';
import { getBookList, canonicalVerseId } from './bibleService.js';
import { listKnowledge } from './researchService.js';
import { getEntityConnections, getProjectKnowledge } from './connectedKnowledgeService.js';

const DISMISS_KEY = 'pwb-suggestions-dismissed';
const clean = v => String(v ?? '').trim();

function loadDismissed() {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]')); }
  catch { return new Set(); }
}
export function dismissSuggestion(id) {
  const set = loadDismissed();
  set.add(id);
  localStorage.setItem(DISMISS_KEY, JSON.stringify([...set]));
}

let bookPattern = null;
function referencePattern() {
  if (bookPattern) return bookPattern;
  const names = getBookList().map(b => b.name).sort((a, b) => b.length - a.length);
  const escaped = names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  bookPattern = new RegExp(`\\b((?:[1-3]\\s)?(?:${escaped.join('|')}))\\s+(\\d{1,3}):(\\d{1,3})(?:[-–](\\d{1,3}))?`, 'g');
  return bookPattern;
}

/** Scan free text for Scripture references, deduped by normalized reference string. */
export function findReferencesInText(text) {
  const source = clean(text);
  if (!source) return [];
  const re = referencePattern();
  re.lastIndex = 0;
  const found = new Map();
  let match;
  while ((match = re.exec(source))) {
    const [, book, chapter, start, end] = match;
    const reference = `${book} ${chapter}:${start}${end ? `-${end}` : ''}`;
    if (!found.has(reference)) found.set(reference, { book, chapter: Number(chapter), start: Number(start), end: end ? Number(end) : Number(start), reference });
  }
  return [...found.values()];
}

async function linkedReferenceSet(entityType, entityId) {
  const connections = await getEntityConnections(entityType, entityId);
  const set = new Set();
  for (const c of connections) {
    if (c.relationship_type === 'scripture' && c.metadata?.reference) set.add(clean(c.metadata.reference).toLowerCase());
  }
  return set;
}

function entityText(kind, workspace) {
  if (kind === 'sermon') {
    const { sermon, stages, points } = workspace;
    return [sermon.primary_text, sermon.manuscript, ...(stages || []).map(s => s.content), ...(points || []).map(p => `${p.explanation} ${p.illustration} ${p.application}`)].join(' ');
  }
  if (kind === 'lesson') return [workspace.lesson.description, ...(workspace.sections || []).map(s => s.content)].join(' ');
  if (kind === 'study') return workspace.study.description || '';
  return '';
}

/** Suggestions for a single project's linked entity: unlinked Scripture references. */
export async function getScriptureSuggestions(project, { cap = 6 } = {}) {
  let workspace = null, entityType = null, entityId = null;
  if (project.project_type === 'sermon') { workspace = await getSermonWorkspace(project.id); entityType = 'Sermon'; entityId = workspace?.sermon.id; }
  else if (project.project_type === 'lesson') { workspace = await getLessonWorkspace(project.id); entityType = 'Lesson'; entityId = workspace?.lesson.id; }
  else if (project.project_type === 'study') { workspace = await getStudyWorkspace(project.id); entityType = 'Study'; entityId = workspace?.study.id; }
  if (!workspace || !entityId) return [];
  const text = entityText(project.project_type, workspace);
  const mentioned = findReferencesInText(text);
  if (!mentioned.length) return [];
  const linked = await linkedReferenceSet(entityType, entityId);
  const unlinked = mentioned.filter(ref => !linked.has(ref.reference.toLowerCase()));
  return (cap ? unlinked.slice(0, cap) : unlinked)
    .map(ref => ({
      id: `scripture:${entityType}:${entityId}:${ref.reference}`,
      kind: 'scripture',
      projectId: project.id,
      projectTitle: project.title,
      entityType, entityId,
      label: `${ref.reference} is mentioned but not linked`,
      detail: `Found in “${project.title}.” Linking it keeps the passage attached to this ${project.project_type} for later reference and cross-reference lookups.`,
      apply: { type: 'link-scripture', entityType, entityId, reference: ref.reference }
    }));
}

/** Suggestions across a project's linked verses: available cross references not yet noted. */
export async function getCrossReferenceSuggestions(project, { cap = 4, refCap = 3, perRefCap = 2 } = {}) {
  let entityType = null, entityId = null;
  if (project.project_type === 'sermon') { entityType = 'Sermon'; entityId = (await getSermonWorkspace(project.id))?.sermon.id; }
  else if (project.project_type === 'lesson') { entityType = 'Lesson'; entityId = (await getLessonWorkspace(project.id))?.lesson.id; }
  else if (project.project_type === 'study') { entityType = 'Study'; entityId = (await getStudyWorkspace(project.id))?.study.id; }
  if (!entityId) return [];
  const connections = await getEntityConnections(entityType, entityId);
  const linkedRefs = connections.filter(c => c.relationship_type === 'scripture' && c.metadata?.reference).map(c => c.metadata.reference);
  if (!linkedRefs.length) return [];
  const { listCrossReferences } = await import('./crossReferenceService.js');
  const { getVerse } = await import('./bibleService.js');
  const suggestions = [];
  for (const reference of (refCap ? linkedRefs.slice(0, refCap) : linkedRefs)) {
    const parsed = findReferencesInText(reference)[0];
    if (!parsed) continue;
    const verseId = canonicalVerseId(parsed.book, parsed.chapter, parsed.start);
    const records = await listCrossReferences({ verseId }).catch(() => []);
    for (const record of (perRefCap ? records.slice(0, perRefCap) : records)) {
      const targetId = record.source_verse_id === verseId ? record.target_verse_id : record.source_verse_id;
      if (!targetId) continue;
      const [, bookSlug, chapter, verseNum] = String(targetId).match(/^(.*)-(\d+)-(\d+)$/) || [];
      const targetVerse = bookSlug ? await getVerse(bookSlug.replace(/-/g, ' '), Number(chapter), Number(verseNum)).catch(() => null) : null;
      const targetRef = targetVerse ? `${targetVerse.book} ${targetVerse.chapter}:${targetVerse.verse}` : targetId;
      if (linkedRefs.some(r => r.toLowerCase() === targetRef.toLowerCase())) continue;
      suggestions.push({
        id: `crossref:${entityType}:${entityId}:${reference}:${targetRef}`,
        kind: 'crossref',
        projectId: project.id,
        projectTitle: project.title,
        entityType, entityId,
        label: `${targetRef} cross-references your linked ${reference}`,
        detail: `The cross-reference dataset connects ${reference} to ${targetRef}. Worth a look while preparing “${project.title}.”`,
        apply: { type: 'link-scripture', entityType, entityId, reference: targetRef }
      });
    }
  }
  return cap ? suggestions.slice(0, cap) : suggestions;
}

/** Suggestions for research/notes with matching title wording not yet attached to the project. */
export async function getResearchSuggestions(project, { cap = 3 } = {}) {
  const titleWords = clean(project.title).toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (!titleWords.length) return [];
  const [attached, all] = await Promise.all([getProjectKnowledge(project.id), listKnowledge({ type: 'all' })]);
  const attachedIds = new Set(attached.map(r => r.id));
  const matches = all
    .filter(item => !item.project_id && !attachedIds.has(item.id))
    .filter(item => {
      const hay = `${item.title || item.name || ''} ${item.content || ''}`.toLowerCase();
      return titleWords.some(w => hay.includes(w));
    });
  return (cap ? matches.slice(0, cap) : matches)
    .map(item => ({
      id: `research:${project.id}:${item.id}`,
      kind: 'research',
      projectId: project.id,
      projectTitle: project.title,
      label: `“${item.title || item.name}” looks related to “${project.title}”`,
      detail: 'Unattached research/notes item with overlapping wording. Attaching keeps it visible from this project.',
      apply: { type: 'attach-knowledge', recordType: item._store === 'notes' ? 'Note' : 'ResearchItem', recordId: item.id, projectId: project.id }
    }));
}

/** Aggregate proactive suggestions across active projects (capped preview for the Dashboard), minus dismissed ones. */
export async function getWorkbenchSuggestions({ limit = 8 } = {}) {
  const dismissed = loadDismissed();
  const projects = (await listProjects()).filter(p => p.status !== 'archived' && ['sermon', 'lesson', 'study'].includes(p.project_type)).slice(0, 12);
  const batches = await Promise.all(projects.map(async project => {
    const [scripture, crossrefs, research] = await Promise.all([
      getScriptureSuggestions(project).catch(() => []),
      getCrossReferenceSuggestions(project).catch(() => []),
      getResearchSuggestions(project).catch(() => [])
    ]);
    return [...scripture, ...crossrefs, ...research];
  }));
  return batches.flat().filter(s => !dismissed.has(s.id)).slice(0, limit);
}

/**
 * Full, uncapped scan across every active project (sermons, lessons, studies) — Scripture
 * references, cross references, and research/notes connections alike. This is the "map my
 * Workbench" pass: nothing is limited to a preview count, and nothing is written; it only
 * returns what could be linked, grouped by project, for review and bulk or individual approval.
 */
export async function getWorkbenchMap({ onProgress = () => {} } = {}) {
  const dismissed = loadDismissed();
  const projects = (await listProjects()).filter(p => p.status !== 'archived' && ['sermon', 'lesson', 'study'].includes(p.project_type));
  const groups = [];
  let done = 0;
  for (const project of projects) {
    const [scripture, crossrefs, research] = await Promise.all([
      getScriptureSuggestions(project, { cap: 0 }).catch(() => []),
      getCrossReferenceSuggestions(project, { cap: 0, refCap: 0, perRefCap: 0 }).catch(() => []),
      getResearchSuggestions(project, { cap: 0 }).catch(() => [])
    ]);
    const suggestions = [...scripture, ...crossrefs, ...research].filter(s => !dismissed.has(s.id));
    done += 1;
    onProgress({ done, total: projects.length, project });
    if (suggestions.length) groups.push({ projectId: project.id, projectTitle: project.title, projectType: project.project_type, suggestions });
  }
  const totalSuggestions = groups.reduce((sum, g) => sum + g.suggestions.length, 0);
  return { groups, projectsScanned: projects.length, totalSuggestions };
}

export function clearDismissedSuggestions() {
  localStorage.removeItem(DISMISS_KEY);
}
export function getDismissedCount() {
  return loadDismissed().size;
}

export async function applySuggestion(suggestion) {
  const { linkScripture, linkKnowledgeToProject } = await import('./connectedKnowledgeService.js');
  if (suggestion.apply.type === 'link-scripture') {
    return linkScripture(suggestion.apply.entityType, suggestion.apply.entityId, suggestion.apply.reference);
  }
  if (suggestion.apply.type === 'attach-knowledge') {
    return linkKnowledgeToProject(suggestion.apply.recordType, suggestion.apply.recordId, suggestion.apply.projectId);
  }
  throw new Error(`Unknown suggestion type: ${suggestion.apply.type}`);
}
