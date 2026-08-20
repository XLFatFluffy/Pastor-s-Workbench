// Phase 3 — 1689 Confession Engine.
// The confession is a structured reference resource. Text is local; the UI
// never reaches into the resource directly. Scripture identity remains owned
// by the Bible Engine.
import { all, bulk, put, remove, get } from './store.js';
import { link } from './relationships.js';
import { canonicalVerseId, canonicalChapterId } from './bibleService.js';
import resource from './data/1689/seed.json' with { type: 'json' };
import chapterIndex from './data/1689/chapters.json' with { type: 'json' };
import verification from './data/1689/verification.json' with { type: 'json' };

const CONFESSION_ID = resource.id;
const now = '2026-08-19T00:00:00.000Z';
const seededByNumber = new Map(resource.chapters.map(c => [c.number, c]));

const CHAPTERS = chapterIndex.chapters.map(([chapter_number, title]) => {
  const seeded = seededByNumber.get(chapter_number);
  return {
    id: `${CONFESSION_ID}-ch-${chapter_number}`,
    confession_id: CONFESSION_ID,
    chapter_number,
    title,
    is_seeded: Boolean(seeded),
    verification_status: seeded?.verification_status || 'reference_pdf_verified',
    verification_record: verification.records.find(r => r.chapter === chapter_number) || null,
    created_at: now,
    updated_at: now
  };
});

function paragraphRecord(chapter, paragraph) {
  return {
    id: `${CONFESSION_ID}-${chapter.number}-${paragraph.number}`,
    chapter_id: `${CONFESSION_ID}-ch-${chapter.number}`,
    paragraph_number: paragraph.number,
    text: paragraph.text,
    is_seeded: true,
    verification_status: 'reference_pdf_verified',
    source: resource.metadata.source,
    source_url: resource.metadata.source_url,
    created_at: now,
    updated_at: now
  };
}

const BOOK_TOKENS = Object.freeze([
  '1Co','2Co','1Jo','2Jo','3Jo','1Ki','2Ki','1Ch','2Ch','1Sa','2Sa','1Pe','2Pe','1Th','2Th','1Ti','2Ti',
  'Gen','Exo','Lev','Num','Deu','Jos','Jdg','Rut','Ezr','Neh','Est','Job','Psa','Pro','Ecc','Song','Isa','Jer','Lam','Eze','Dan',
  'Hos','Joe','Amo','Oba','Jon','Mic','Nah','Hab','Zep','Hag','Zec','Mal','Mat','Mar','Luk','Joh','Act','Rom','Gal','Eph','Phi','Col',
  'Ti','Tit','Phm','Heb','Jam','Jas','Jud','Rev'
]);
const BOOK_TOKEN_RE = new RegExp(`\\b(${[...BOOK_TOKENS].sort((a,b)=>b.length-a.length).join('|')})\\s+`, 'g');
const ONE_CHAPTER_BOOKS = new Set(['Phm','2Jo','3Jo','Jud','Oba']);

function cleanReferenceText(reference) {
  return String(reference || '')
    .replace(/^\s*\*\s*/, '')
    .replace(/\betc\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[;,]\s*$/, '');
}

function expandVerseList(book, chapter, verseSpec) {
  const verses = [];
  for (const token of String(verseSpec || '').split(',')) {
    const part = token.trim();
    if (!part) continue;
    const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (end < start || end - start > 300) throw new Error(`Invalid Scripture verse range: ${book} ${chapter}:${part}`);
      for (let verse = start; verse <= end; verse++) verses.push({
        kind: 'verse', book, chapter, verse,
        canonicalVerseId: canonicalVerseId(book, chapter, verse)
      });
    } else if (/^\d+$/.test(part)) {
      const verse = Number(part);
      verses.push({ kind: 'verse', book, chapter, verse, canonicalVerseId: canonicalVerseId(book, chapter, verse) });
    }
  }
  return verses;
}

function parseBookChunk(bookToken, chunk) {
  const results = [];
  let currentChapter = null;
  const pieces = String(chunk || '').split(';');
  for (const rawPiece of pieces) {
    const piece = rawPiece.replace(/\betc\.?/gi, '').replace(/\*/g, '').trim().replace(/^[,\s]+|[,\s]+$/g, '');
    if (!piece) continue;

    // A proof list may continue the same book without repeating its name.
    for (const token of piece.split(',').map(x => x.trim()).filter(Boolean)) {
      const chapterVerse = token.match(/^(\d+)\s*:\s*(.+)$/);
      if (chapterVerse) {
        currentChapter = Number(chapterVerse[1]);
        results.push(...expandVerseList(bookToken, currentChapter, chapterVerse[2]));
        continue;
      }

      const chapterRange = token.match(/^(\d+)\s*-\s*(\d+)$/);
      if (chapterRange) {
        const start = Number(chapterRange[1]);
        const end = Number(chapterRange[2]);
        if (ONE_CHAPTER_BOOKS.has(bookToken)) {
          results.push(...expandVerseList(bookToken, 1, `${start}-${end}`));
        } else {
          if (end < start || end - start > 50) throw new Error(`Invalid Scripture chapter range: ${bookToken} ${token}`);
          for (let chapter = start; chapter <= end; chapter++) results.push({
            kind: 'chapter', book: bookToken, chapter, canonicalChapterId: canonicalChapterId(bookToken, chapter)
          });
        }
        continue;
      }

      if (/^\d+$/.test(token)) {
        const number = Number(token);
        if (currentChapter !== null) {
          results.push(...expandVerseList(bookToken, currentChapter, token));
        } else if (ONE_CHAPTER_BOOKS.has(bookToken)) {
          results.push(...expandVerseList(bookToken, 1, token));
        } else {
          currentChapter = number;
          results.push({ kind: 'chapter', book: bookToken, chapter: number, canonicalChapterId: canonicalChapterId(bookToken, number) });
        }
      }
    }
  }
  return results;
}

/**
 * Parse a historical 1689 proof-text string into canonical Bible targets.
 * Explicit verse references become BibleVerse identities; chapter-only
 * references become BibleChapter identities. No Bible text is duplicated here.
 */
export function parseScriptureReference(reference) {
  const cleaned = cleanReferenceText(reference);
  if (!cleaned) return [];
  const matches = [...cleaned.matchAll(BOOK_TOKEN_RE)];
  if (!matches.length) return [];
  const out = [];
  for (let i = 0; i < matches.length; i++) {
    const book = matches[i][1];
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : cleaned.length;
    out.push(...parseBookChunk(book, cleaned.slice(start, end)));
  }
  return out;
}

export function getProofSeedEntries() {
  const entries = [];
  for (const chapter of resource.chapters) {
    for (const paragraph of chapter.paragraphs) {
      for (const reference of (resource.chapterProofs?.[String(chapter.number)]?.[String(paragraph.number)] || [])) {
        entries.push({ chapterNumber: chapter.number, paragraphNumber: paragraph.number, reference });
      }
    }
  }
  return entries;
}

async function rebuildScriptureRelationships() {
  const existing = await all('relationships');
  for (const relationship of existing) {
    if (relationship.source_type === 'ConfessionParagraph' && relationship.relationship_type === 'scripture') {
      await remove('relationships', relationship.id);
    }
  }

  const relationships = [];
  for (const entry of getProofSeedEntries()) {
    const sourceId = `${CONFESSION_ID}-${entry.chapterNumber}-${entry.paragraphNumber}`;
    const parsedTargets = parseScriptureReference(entry.reference);
    for (const target of parsedTargets) {
      relationships.push(link(
        'ConfessionParagraph',
        sourceId,
        target.kind === 'verse' ? 'BibleVerse' : 'BibleChapter',
        target.kind === 'verse' ? target.canonicalVerseId : target.canonicalChapterId,
        'scripture',
        {
          reference_text: entry.reference,
          reference_kind: target.kind,
          provenance: `1689 chapter ${entry.chapterNumber} paragraph ${entry.paragraphNumber} proof-text import`,
          verification_status: 'reference_pdf_verified_canonical_identity',
          book: target.book,
          chapter: target.chapter,
          verse: target.kind === 'verse' ? target.verse : null,
          source: resource.metadata.proof_source,
          source_url: resource.metadata.proof_source_url
        }
      ));
    }
  }
  if (relationships.length) await bulk('relationships', relationships);
  return relationships.length;
}

export function getConfession() {
  return { id: CONFESSION_ID, name: resource.name, edition: resource.edition, metadata: resource.metadata };
}
export function getChapters() { return [...CHAPTERS]; }
export function getChapter(chapterNumber) { return CHAPTERS.find(c => c.chapter_number === Number(chapterNumber)) || null; }

export async function seedCore() {
  await put('confessions', getConfession());
  await bulk('confession_chapters', CHAPTERS);
  const paragraphs = [];
  for (const chapter of resource.chapters) for (const paragraph of chapter.paragraphs) paragraphs.push(paragraphRecord(chapter, paragraph));
  await bulk('confession_paragraphs', paragraphs);
  const proofRelationshipCount = await rebuildScriptureRelationships();
  return { chapters: CHAPTERS.length, paragraphs: paragraphs.length, proofs: proofRelationshipCount };
}

export async function getParagraphs(chapterNumber) {
  const chapter = getChapter(chapterNumber);
  if (!chapter) return [];
  const records = await all('confession_paragraphs');
  return records.filter(p => p.chapter_id === chapter.id).sort((a,b) => a.paragraph_number-b.paragraph_number);
}
export async function getParagraph(id) {
  const records = await all('confession_paragraphs');
  return records.find(p => p.id === id) || null;
}
export async function getScriptureProofs(paragraphId) {
  const relationships = await all('relationships');
  return relationships.filter(r => r.source_type === 'ConfessionParagraph' && r.source_id === paragraphId && r.relationship_type === 'scripture');
}
export async function getConfessionReferencesForScripture(targetId, targetType = 'BibleVerse') {
  const relationships = await all('relationships');
  return relationships.filter(r => r.target_type === targetType && r.target_id === targetId && r.relationship_type === 'scripture');
}
const RELATED_DOMAINS = Object.freeze([
  { targetType: 'Note', store: 'notes', label: 'Notes', relationshipType: 'note' },
  { targetType: 'ResearchItem', store: 'research_items', label: 'Research', relationshipType: 'research' },
  { targetType: 'Sermon', store: 'sermons', label: 'Sermons', relationshipType: 'sermon' },
  { targetType: 'Lesson', store: 'lessons', label: 'Lessons', relationshipType: 'lesson' },
  { targetType: 'Study', store: 'studies', label: 'Studies', relationshipType: 'study' },
  { targetType: 'Topic', store: 'topics', label: 'Topics', relationshipType: 'topic' }
]);

export function getRelatedDomains() { return RELATED_DOMAINS.map(d => ({ ...d })); }

async function getRelatedByDomain(paragraphId, domain) {
  const relationships = await all('relationships');
  const links = relationships.filter(r => r.source_type === 'ConfessionParagraph' && r.source_id === paragraphId && r.target_type === domain.targetType && r.relationship_type === domain.relationshipType);
  if (!links.length) return [];
  const records = await all(domain.store);
  const byId = new Map(records.map(record => [record.id, record]));
  return links.map(linkRecord => ({ relationship: linkRecord, record: byId.get(linkRecord.target_id) || null })).filter(item => item.record);
}

export async function getRelatedNotes(paragraphId) { return getRelatedByDomain(paragraphId, RELATED_DOMAINS[0]); }
export async function getRelatedResearch(paragraphId) { return getRelatedByDomain(paragraphId, RELATED_DOMAINS[1]); }
export async function getRelatedSermons(paragraphId) { return getRelatedByDomain(paragraphId, RELATED_DOMAINS[2]); }
export async function getRelatedLessons(paragraphId) { return getRelatedByDomain(paragraphId, RELATED_DOMAINS[3]); }
export async function getRelatedStudies(paragraphId) { return getRelatedByDomain(paragraphId, RELATED_DOMAINS[4]); }
export async function getRelatedTopics(paragraphId) { return getRelatedByDomain(paragraphId, RELATED_DOMAINS[5]); }

export async function getRelatedWorkbenchItems(paragraphId) {
  const groups = {};
  for (const domain of RELATED_DOMAINS) groups[domain.targetType] = await getRelatedByDomain(paragraphId, domain);
  return groups;
}

export async function linkParagraphToEntity(paragraphId, targetType, targetId, metadata = {}) {
  const domain = RELATED_DOMAINS.find(d => d.targetType === targetType);
  if (!domain) throw new TypeError(`Unsupported 1689 relationship target: ${targetType}`);
  const record = await get(domain.store, targetId);
  if (!record) throw new Error(`${domain.label} record not found: ${targetId}`);
  const existing = await all('relationships');
  const duplicate = existing.find(r => r.source_type === 'ConfessionParagraph' && r.source_id === paragraphId && r.target_type === targetType && r.target_id === targetId && r.relationship_type === domain.relationshipType);
  if (duplicate) return duplicate;
  const relationship = link('ConfessionParagraph', paragraphId, targetType, targetId, domain.relationshipType, { ...metadata, provenance: metadata.provenance || 'User-created 1689 Workbench relationship' });
  await put('relationships', relationship);
  return relationship;
}

export async function unlinkParagraphFromEntity(paragraphId, targetType, targetId) {
  const domain = RELATED_DOMAINS.find(d => d.targetType === targetType);
  if (!domain) throw new TypeError(`Unsupported 1689 relationship target: ${targetType}`);
  const relationships = await all('relationships');
  const matches = relationships.filter(r => r.source_type === 'ConfessionParagraph' && r.source_id === paragraphId && r.target_type === targetType && r.target_id === targetId && r.relationship_type === domain.relationshipType);
  for (const match of matches) await remove('relationships', match.id);
  return matches.length;
}

export async function search(query, mode = 'all') {
  const raw = String(query || '').trim();
  if (!raw) return [];
  const q = raw.toLowerCase();
  const paragraphs = await all('confession_paragraphs');
  const chapterMatches = (mode === 'all' || mode === 'chapter')
    ? CHAPTERS.filter(c => `${c.chapter_number} ${c.title}`.toLowerCase().includes(q)).map(c => ({ type:'chapter', ...c }))
    : [];
  let paragraphMatches = [];
  if (mode === 'all' || mode === 'word' || mode === 'phrase' || mode === 'paragraph') {
    paragraphMatches = paragraphs.filter(p => {
      const text = String(p.text || '').toLowerCase();
      if (mode === 'paragraph') return `${p.paragraph_number}` === raw || p.id.toLowerCase().includes(q);
      if (mode === 'phrase') return text.includes(q);
      if (mode === 'word') return new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(String(p.text || ''));
      return text.includes(q) || `${p.paragraph_number}` === raw;
    }).map(p => ({ type:'paragraph', ...p }));
  }
  return [...chapterMatches, ...paragraphMatches];
}
export async function getAvailability() {
  const paragraphs = await all('confession_paragraphs');
  const seededChapters = new Set(paragraphs.map(p => p.chapter_id));
  const proofs = (await all('relationships')).filter(r => r.source_type === 'ConfessionParagraph' && r.relationship_type === 'scripture');
  return { confession_id: CONFESSION_ID, chapter_count: CHAPTERS.length, seeded_chapters: seededChapters.size, paragraph_count: paragraphs.length, proof_relationships: proofs.length, is_local: true };
}
export { CONFESSION_ID };
