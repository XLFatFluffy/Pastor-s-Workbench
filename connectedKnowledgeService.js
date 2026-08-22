// v0.18 — connected Bible / Study / Sermon / Research workflow.
// Keeps domain records primary while using the generic relationship store for
// cross-domain links that should not duplicate content.
import { all, put, remove } from './store.js';
import { link, normalizeRelationship } from './relationships.js';
import { getVerse } from './bibleService.js';
import { listKnowledge } from './researchService.js';
import { listBooks } from './libraryService.js';
import { listDocuments, getDocument } from './documentService.js';

const RELATIONSHIP_STORE = 'relationships';
const PROJECT_KNOWLEDGE_STORES = ['notes', 'research_items'];

const clean = v => String(v ?? '').trim();

export async function getProjectKnowledge(projectId, { search = '' } = {}) {
  const needle = clean(search).toLowerCase();
  const rows = [];
  for (const store of PROJECT_KNOWLEDGE_STORES) {
    for (const row of await all(store)) {
      if (row.project_id !== projectId) continue;
      const hay = [row.title, row.content, row.name, row.description].join(' ').toLowerCase();
      if (!needle || hay.includes(needle)) rows.push({ ...row, _store: store, _type: store === 'notes' ? 'Note' : 'ResearchItem' });
    }
  }
  return rows.sort((a,b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
}

export async function linkEntities(sourceType, sourceId, targetType, targetId, relationshipType = 'related', metadata = {}) {
  const relationships = await all(RELATIONSHIP_STORE);
  const existing = relationships.find(r => r.source_type === sourceType && r.source_id === sourceId && r.target_type === targetType && r.target_id === targetId && r.relationship_type === relationshipType);
  if (existing) return existing;
  const relationship = normalizeRelationship(link(sourceType, sourceId, targetType, targetId, relationshipType, metadata));
  await put(RELATIONSHIP_STORE, relationship);
  return relationship;
}

export async function unlinkEntity(relationshipId) { await remove(RELATIONSHIP_STORE, relationshipId); }

export async function getEntityConnections(type, id) {
  return (await all(RELATIONSHIP_STORE)).filter(r =>
    (r.source_type === type && r.source_id === id) || (r.target_type === type && r.target_id === id)
  );
}

export async function linkScripture(entityType, entityId, reference, translationId = 'KJV') {
  const raw = clean(reference);
  const match = raw.match(/^(.*?)\s+(\d+):(\d+)(?:[-–](\d+))?$/);
  if (!match) throw new Error('Use a Scripture reference such as 1 John 1:1-4.');
  const book = match[1].trim();
  const chapter = Number(match[2]);
  const start = Number(match[3]);
  const end = Number(match[4] || match[3]);
  const verse = await getVerse(book, chapter, start, translationId);
  if (!verse) throw new Error(`Could not find ${raw} in ${translationId}.`);
  const linked = [];
  for (let number = start; number <= end; number++) {
    const v = await getVerse(book, chapter, number, translationId);
    if (!v) break;
    linked.push(await linkEntities(entityType, entityId, 'BibleVerse', v.id, 'scripture', { reference: `${v.book} ${v.chapter}:${v.verse}`, translationId }));
  }
  return { reference: `${verse.book} ${verse.chapter}:${start}${end !== start ? `–${end}` : ''}`, links: linked };
}

export async function linkKnowledgeToProject(type, id, projectId) {
  const store = type === 'Note' ? 'notes' : type === 'ResearchItem' ? 'research_items' : null;
  if (!store) throw new TypeError('Only Note and ResearchItem records can be attached directly to a project.');
  const row = (await all(store)).find(r => r.id === id);
  if (!row) throw new Error(`${type} not found.`);
  const updated = { ...row, project_id: projectId, updated_at: new Date().toISOString() };
  await put(store, updated);
  return updated;
}

export async function getConnectedKnowledgeSummary(projectId, entity = null) {
  const direct = await getProjectKnowledge(projectId);
  const connections = entity ? await getEntityConnections(entity.type, entity.id) : [];
  const linked = [];
  for (const r of connections) {
    const type = r.source_type === entity.type && r.source_id === entity.id ? r.target_type : r.source_type;
    const id = r.source_type === entity.type && r.source_id === entity.id ? r.target_id : r.source_id;
    linked.push({ ...r, linked_type: type, linked_id: id });
  }
  return { direct, connections: linked };
}


export async function getConnectedBooks(entityType, entityId) {
  const connections = await getEntityConnections(entityType, entityId);
  const ids = new Set();
  for (const r of connections) {
    if (r.source_type === 'LibraryItem') ids.add(r.source_id);
    if (r.target_type === 'LibraryItem') ids.add(r.target_id);
  }
  const books = await listBooks();
  return books.filter(book => ids.has(book.id));
}

export async function linkBookToEntity(entityType, entityId, bookId) {
  const books = await listBooks();
  const book = books.find(b => b.id === bookId);
  if (!book) throw new Error('Book not found.');
  return linkEntities(entityType, entityId, 'LibraryItem', book.id, 'source', { title: book.title, author: book.author || '' });
}


export async function getConnectedDocuments(entityType, entityId) {
  const connections = await getEntityConnections(entityType, entityId);
  const ids = new Set();
  for (const r of connections) {
    if (r.source_type === 'Document') ids.add(r.source_id);
    if (r.target_type === 'Document') ids.add(r.target_id);
  }
  const documents = await listDocuments();
  return documents.filter(document => ids.has(document.id));
}

export async function linkDocumentToEntity(entityType, entityId, documentId) {
  const document = await getDocument(documentId);
  if (!document) throw new Error('Document not found.');
  return linkEntities(entityType, entityId, 'Document', document.id, 'source', {
    title: document.title,
    filename: document.filename || ''
  });
}

export async function getConnectedSources(entityType, entityId) {
  const connections = await getEntityConnections(entityType, entityId);
  const ids = new Set();
  for (const r of connections) {
    if (r.source_type === 'Source') ids.add(r.source_id);
    if (r.target_type === 'Source') ids.add(r.target_id);
  }
  const sources = await all('sources');
  return sources.filter(source => ids.has(source.id));
}

export async function getConnectedEntities(entityType, entityId, { types = null } = {}) {
  const connections = await getEntityConnections(entityType, entityId);
  const allowed = Array.isArray(types) ? new Set(types) : null;
  const out = [];
  for (const r of connections) {
    const linkedType = r.source_type === entityType && r.source_id === entityId ? r.target_type : r.target_type === entityType && r.target_id === entityId ? r.source_type : null;
    const linkedId = r.source_type === entityType && r.source_id === entityId ? r.target_id : r.target_type === entityType && r.target_id === entityId ? r.source_id : null;
    if (!linkedType || !linkedId || (allowed && !allowed.has(linkedType))) continue;
    out.push({ ...r, linked_type: linkedType, linked_id: linkedId });
  }
  return out;
}

export async function getConnectedEntityRecords(entityType, entityId, { types = null } = {}) {
  const connections = await getConnectedEntities(entityType, entityId, { types });
  const stores = { Project:'projects', Sermon:'sermons', Lesson:'lessons', Study:'studies', Note:'notes', ResearchItem:'research_items', LibraryItem:'library_items', Document:'documents', BibleVerse:'bible_verses' };
  const grouped = new Map();
  for (const c of connections) {
    const store = stores[c.linked_type];
    if (!store) continue;
    if (!grouped.has(store)) grouped.set(store, []);
    grouped.get(store).push(c.linked_id);
  }
  const rows = [];
  for (const [store, ids] of grouped) {
    const wanted = new Set(ids);
    for (const row of await all(store)) if (wanted.has(row.id)) rows.push({ ...row, _connected_type: connections.find(c => c.linked_id === row.id)?.linked_type || store, _relationship: connections.find(c => c.linked_id === row.id) });
  }
  return rows;
}
