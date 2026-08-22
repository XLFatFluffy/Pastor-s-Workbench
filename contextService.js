// Global Workbench context — lets the local AI read the user's structured work
// across the application without sending the entire database on every prompt.
import { all } from './store.js';
import { search as searchBible } from './bibleService.js';
import { search as searchConfession } from './confessionService.js';
import { findRelatedVerseIds } from './crossReferenceService.js';
import { buildBookContext } from './libraryService.js';
import { searchDocuments, getDocumentChunks } from './documentService.js';
import { getConnectedDocuments } from './connectedKnowledgeService.js';

const WORK_STORES = [
  ['projects','Project'], ['sermons','Sermon'], ['sermon_stages','Sermon Stage'], ['sermon_points','Sermon Point'],
  ['lessons','Lesson'], ['lesson_teaching_sections','Lesson Section'], ['studies','Study'],
  ['notes','Note'], ['research_items','Research'], ['topics','Topic'], ['collections','Collection'],
  ['sources','Source'], ['resources','Resource'], ['documents','Document'], ['templates','Template'],
  ['calendar_events','Calendar Event'], ['daily_tasks','Daily Task'],
  ['tags','Tag'], ['bible_annotations','Bible Annotation']
];

const clean = v => String(v ?? '').trim();
const termsFor = q => clean(q).toLowerCase().split(/\s+/).filter(t => t.length > 1).slice(0, 18);
const score = (record, terms) => {
  const text = Object.entries(record || {}).filter(([k,v]) => !['id','created_at','updated_at'].includes(k) && typeof v !== 'object').map(([k,v]) => `${k} ${v}`).join(' ').toLowerCase();
  let total = 0;
  for (const term of terms) {
    let at = text.indexOf(term);
    while (at >= 0) { total += term.length > 6 ? 3 : 1; at = text.indexOf(term, at + term.length); }
  }
  return total;
};

function labelRecord(type, r) {
  const title = r.title || r.name || r.label || r.subject || r.passage || r.reference || `${type} ${r.id || ''}`;
  return `${type}: ${title}`;
}

export function getCurrentAppContext() {
  if (typeof document === 'undefined') return { route: '', screen: '', workspaceAI: null };
  const route = globalThis.__pwbCurrentRoute || location.hash || '#/dashboard';
  const main = document.getElementById('app-view');
  let screen = main?.innerText || '';
  screen = screen.replace(/\n{3,}/g, '\n\n').trim().slice(0, 18000);
  const workspaceAI = globalThis.__pwbWorkspaceAI || null;
  return { route, screen, workspaceAI };
}

export async function searchWorkbenchRecords(query, { limit = 14 } = {}) {
  const terms = termsFor(query);
  if (!terms.length) return [];
  const results = [];
  for (const [store, type] of WORK_STORES) {
    const rows = await all(store);
    for (const row of rows) {
      const s = score(row, terms);
      if (s > 0) results.push({ type, store, id: row.id, score: s, label: labelRecord(type, row), content: row });
    }
  }
  return results.sort((a,b) => b.score - a.score || String(a.label).localeCompare(String(b.label))).slice(0, limit);
}

function formatRecord(r) {
  const fields = Object.entries(r.content || {}).filter(([k,v]) => !['id','created_at','updated_at'].includes(k) && v !== null && v !== undefined && typeof v !== 'object');
  return `${r.label}\n${fields.map(([k,v]) => `${k}: ${v}`).join('\n')}`;
}

export async function buildWorkbenchContext(query, { includeBooks = true, includeBible = true, includeConfession = true, includeCrossReferences = true, includeCurrentScreen = true, limit = 18 } = {}) {
  const [work, books, documents] = await Promise.all([
    searchWorkbenchRecords(query, { limit: Math.max(limit, 14) }),
    includeBooks ? buildBookContext(query, { limit: 6 }) : [],
    searchDocuments(query, { limit: 6 })
  ]);
  const sections = [];
  let connectedDocuments = [];
  const currentEntity = globalThis.__pwbCurrentEntity || null;
  if (currentEntity?.type && currentEntity?.id) {
    try {
      connectedDocuments = await getConnectedDocuments(currentEntity.type, currentEntity.id);
      if (connectedDocuments.length) {
        const connectedChunks = [];
        for (const doc of connectedDocuments.slice(0, 8)) {
          const hits = await searchDocuments(query, { limit: 4, documentId: doc.id });
          if (hits.length) connectedChunks.push(...hits);
        }
        if (connectedChunks.length) documents.push(...connectedChunks);
      }
    } catch { /* connected documents are optional context */ }
  }
  if (includeCurrentScreen) {
    const current = getCurrentAppContext();
    if (current.screen) sections.push(`CURRENT WORKBENCH SCREEN\nRoute: ${current.route}\n${current.screen}`);
    if (current.workspaceAI) sections.push(`CURRENT WORKSPACE AI CONTRACT\nWorkspace: ${current.workspaceAI.label || current.workspaceAI.route}\nCapabilities: ${(current.workspaceAI.capabilities || []).join(' | ')}\nInstruction: ${current.workspaceAI.instruction || ''}`);
  }
  if (work.length) sections.push(`MATCHING USER WORK\n${work.map((r,i)=>`[Work ${i+1}]\n${formatRecord(r)}`).join('\n\n')}`);
  if (books.length) sections.push(`UPLOADED BOOK LIBRARY
${books.map((r,i)=>`[Book ${i+1}] ${r.citation}
${r.content}`).join('\n\n')}`);
  if (documents.length) sections.push(`CONNECTED FILES & DOCUMENTS
${documents.map((r,i)=>`[Document ${i+1}] ${r.document?.title || 'Document'} — ${r.index + 1}
${r.content}`).join('\n\n')}`);

  if (includeBible) {
    try {
      const hits = await searchBible(query, { limit: 6 });
      if (hits?.length) sections.push(`BIBLE SEARCH RESULTS\n${hits.map((r,i)=>`[Bible ${i+1}] ${r.reference || r.book || ''}\n${r.text || r.content || ''}`).join('\n\n')}`);
    } catch { /* Bible may not be installed yet. */ }
  }
  if (includeConfession) {
    try {
      const hits = await searchConfession(query);
      if (hits?.length) sections.push(`1689 CONFESSION SEARCH RESULTS\n${hits.slice(0,6).map((r,i)=>`[Confession ${i+1}] ${r.chapter_title || r.chapter || ''} ${r.paragraph_number || ''}\n${r.text || r.content || ''}`).join('\n\n')}`);
    } catch { /* Confession may be unavailable. */ }
  }
  if (includeCrossReferences) {
    try {
      const verseId = clean(query).toLowerCase().replace(/[^a-z0-9]+/g,'-');
      if (/^[a-z]+-\d+-\d+/.test(verseId)) {
        const refs = await findRelatedVerseIds(verseId, { limit: 8 });
        if (refs?.length) sections.push(`CROSS-REFERENCES\n${refs.map((r,i)=>`[Cross Reference ${i+1}] ${JSON.stringify(r)}`).join('\n')}`);
      }
    } catch { /* optional corpus */ }
  }
  return { sections, work, books, documents, current: getCurrentAppContext() };
}

export function contextSummary(ctx) {
  return { work: ctx.work?.length || 0, books: ctx.books?.length || 0, documents: ctx.documents?.length || 0, sections: ctx.sections?.length || 0, route: ctx.current?.route || '' };
}
