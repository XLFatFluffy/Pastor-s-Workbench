// crossReferenceService.js — Phase 4 Cross-Reference Engine.
// Stores normalized relationships and maintains a local lookup index.

import { all, get, bulk, put, clear } from "./store.js";
import { createRecord } from "./dataModel.js";

export const CROSS_REFERENCE_TYPES = Object.freeze([
  "parallel", "quotation", "allusion", "thematic", "prophetic", "fulfillment", "conceptual", "other"
]);

const SEED_URL = "./data/crossrefs/seed.json";
let seedPromise;

function makeId(source, target, type = "other") {
  const safe = (value) => String(value).replace(/[^A-Za-z0-9_.-]/g, "_");
  return `xref_${safe(source)}__${safe(target)}__${safe(type)}`;
}

function normalizeVerseId(value) {
  return String(value || "").trim().toUpperCase();
}

export function normalizeCrossReference(input) {
  const source = normalizeVerseId(input.source_verse_id);
  const target = normalizeVerseId(input.target_verse_id);
  if (!source || !target) throw new Error("Cross-reference source and target are required.");
  const record = {
    id: input.id || makeId(source, target, input.relationship_type),
    source_verse_id: source,
    target_verse_id: target,
    relationship_type: CROSS_REFERENCE_TYPES.includes(input.relationship_type) ? input.relationship_type : "other",
    source: input.source || "Pastor's Workbench",
    notes: input.notes || "",
    provenance: input.provenance && typeof input.provenance === "object" ? { ...input.provenance } : {},
    confidence: Number.isFinite(input.confidence) ? input.confidence : 0.5,
    votes: Number.isFinite(input.votes) ? input.votes : null,
    corpus_id: input.corpus_id || null
  };
  return createRecord("CrossReference", record);
}

async function rebuildIndex(records = null) {
  const source = records || await all("cross_references");
  await clear("cross_reference_index");
  const index = [];
  for (const record of source) {
    index.push({ id: `${record.source_verse_id}|out|${record.id}`, verse_id: record.source_verse_id, direction: "outgoing", relationship_id: record.id });
    index.push({ id: `${record.target_verse_id}|in|${record.id}`, verse_id: record.target_verse_id, direction: "incoming", relationship_id: record.id });
  }
  if (index.length) await bulk("cross_reference_index", index);
  return index.length;
}

export async function seedStarterSample() {
  const existing = await all("cross_references");
  if (existing.length) return { seeded: false, count: existing.length };
  if (!seedPromise) seedPromise = fetch(SEED_URL).then((r) => {
    if (!r.ok) throw new Error(`Cross-reference starter resource failed: HTTP ${r.status}`);
    return r.json();
  });
  const payload = await seedPromise;
  const records = (payload.records || []).map(normalizeCrossReference);
  await bulk("cross_references", records);
  await rebuildIndex(records);
  return { seeded: true, count: records.length };
}

export async function importCrossReferenceCorpus(text, { format = "auto", corpusId = "openbible-info", provider = "OpenBible.info" } = {}) {
  const input = String(text || "").trim();
  if (!input) throw new Error("The cross-reference file is empty.");
  let records = [];
  const detected = format === "auto" ? (input.startsWith("[") || input.startsWith("{") ? "json" : "tsv") : format;
  if (detected === "json") {
    const payload = JSON.parse(input);
    const rows = Array.isArray(payload) ? payload : (payload.records || payload.cross_references || payload.data || []);
    records = rows.map(row => normalizeCorpusRow(row, { corpusId, provider }));
  } else {
    const lines = input.split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      if (line.trim().startsWith("#")) continue;
      const cols = line.split("\t");
      if (cols.length < 2) continue;
      records.push(normalizeCorpusRow({ source_verse_id: cols[0], target_verse_id: cols[1], votes: cols[2] }, { corpusId, provider }));
    }
  }
  records = records.filter(Boolean);
  if (!records.length) throw new Error("No recognizable cross-reference records were found.");
  await bulk("cross_references", records);
  await rebuildIndex();
  return { imported: records.length, corpusId, provider };
}

function normalizeCorpusRow(row, { corpusId, provider }) {
  const source = normalizeVerseId(row.source_verse_id || row.from || row.from_verse || row.source || row[0]);
  const target = normalizeVerseId(row.target_verse_id || row.to || row.to_verse || row.target || row[1]);
  if (!source || !target) return null;
  const votesRaw = row.votes ?? row.vote_count ?? row[2];
  const votes = votesRaw === undefined || votesRaw === "" ? null : Number(votesRaw);
  return normalizeCrossReference({
    source_verse_id: source,
    target_verse_id: target,
    relationship_type: "other",
    source: provider,
    notes: votes != null && Number.isFinite(votes) ? `Source votes: ${votes}` : "Imported corpus relationship; semantic type not supplied by source.",
    provenance: { provider, kind: "corpus", corpus_id: corpusId, license: "CC BY", attribution: "Cross-reference data courtesy of OpenBible.info" },
    confidence: votes != null && Number.isFinite(votes) ? Math.min(1, Math.max(0.1, 0.25 + Math.log10(Math.max(1, votes)) / 4)) : 0.5,
    votes: Number.isFinite(votes) ? votes : null,
    corpus_id: corpusId
  });
}

export async function listCrossReferences({ verseId = null, direction = "both", relationshipType = null } = {}) {
  if (!verseId) {
    const records = await all("cross_references");
    return relationshipType ? records.filter(record => record.relationship_type === relationshipType) : records;
  }
  const normalizedVerseId = normalizeVerseId(verseId);
  const directions = direction === "outgoing" ? ["outgoing"] : direction === "incoming" ? ["incoming"] : ["outgoing", "incoming"];
  const indexRows = await all("cross_reference_index");
  const matching = indexRows.filter(row => row.verse_id === normalizedVerseId && directions.includes(row.direction));
  const records = [];
  for (const row of matching) {
    const record = await get("cross_references", row.relationship_id);
    if (record && (!relationshipType || record.relationship_type === relationshipType)) records.push(record);
  }
  return records;
}

export async function findRelatedVerseIds(verseId, options = {}) {
  const records = await listCrossReferences({ verseId, ...options });
  return records.map((record) => record.source_verse_id === verseId ? record.target_verse_id : record.source_verse_id);
}

export async function addCrossReference(input) {
  const record = normalizeCrossReference(input);
  await put("cross_references", record);
  await rebuildIndex();
  return record;
}


const OPEN_CROSS_REF_API = "https://bible.helloao.org/api/d/open-cross-ref";
const OPEN_CROSS_REF_EXPECTED = 344799;
const OPEN_CROSS_REF_CORPUS_ID = "openbible-info";
const OPEN_CROSS_REF_PROVIDER = "OpenBible.info (via Free Use Bible API delivery)";

const OPEN_BIBLE_BOOK_MAP = Object.freeze({
  GEN:"genesis", EXO:"exodus", LEV:"leviticus", NUM:"numbers", DEU:"deuteronomy", JOS:"joshua", JDG:"judges", RUT:"ruth",
  "1SA":"1-samuel", "2SA":"2-samuel", "1KI":"1-kings", "2KI":"2-kings", "1CH":"1-chronicles", "2CH":"2-chronicles",
  EZR:"ezra", NEH:"nehemiah", EST:"esther", JOB:"job", PSA:"psalms", PRO:"proverbs", ECC:"ecclesiastes", SNG:"song-of-solomon",
  ISA:"isaiah", JER:"jeremiah", LAM:"lamentations", EZK:"ezekiel", DAN:"daniel", HOS:"hosea", JOL:"joel", AMO:"amos", OBA:"obadiah",
  JON:"jonah", MIC:"micah", NAH:"nahum", HAB:"habakkuk", ZEP:"zephaniah", HAG:"haggai", ZEC:"zechariah", MAL:"malachi",
  MAT:"matthew", MRK:"mark", LUK:"luke", JHN:"john", ACT:"acts", ROM:"romans", "1CO":"1-corinthians", "2CO":"2-corinthians",
  GAL:"galatians", EPH:"ephesians", PHP:"philippians", COL:"colossians", "1TH":"1-thessalonians", "2TH":"2-thessalonians",
  "1TI":"1-timothy", "2TI":"2-timothy", TIT:"titus", PHM:"philemon", HEB:"hebrews", JAS:"james", "1PE":"1-peter", "2PE":"2-peter",
  "1JN":"1-john", "2JN":"2-john", "3JN":"3-john", JUD:"jude", REV:"revelation"
});

function apiBookToCanonicalId(book) {
  const slug = OPEN_BIBLE_BOOK_MAP[String(book || "").toUpperCase()];
  if (!slug) return null;
  return slug;
}

function canonicalFromApi(book, chapter, verse) {
  const slug = apiBookToCanonicalId(book);
  if (!slug || !Number.isInteger(Number(chapter)) || !Number.isInteger(Number(verse))) return null;
  return `${slug}-${Number(chapter)}-${Number(verse)}`.toUpperCase();
}

export function normalizeOpenCrossReferenceChapter(payload) {
  const book = payload?.book?.id;
  const chapter = Number(payload?.chapter?.number);
  const content = Array.isArray(payload?.chapter?.content) ? payload.chapter.content : [];
  const sourceBook = apiBookToCanonicalId(book);
  if (!sourceBook || !Number.isInteger(chapter)) throw new Error(`Invalid OpenBible chapter identity: ${book} ${chapter}`);
  const records = [];
  const sourceVerseIds = [];
  const targetIds = [];
  for (const verse of content) {
    const verseNumber = Number(verse?.verse);
    if (!Number.isInteger(verseNumber) || verseNumber < 1) continue;
    const sourceId = canonicalFromApi(book, chapter, verseNumber);
    if (!sourceId) continue;
    sourceVerseIds.push(sourceId);
    for (const ref of Array.isArray(verse?.references) ? verse.references : []) {
      const target = canonicalFromApi(ref?.book, ref?.chapter, ref?.verse);
      const endVerse = ref?.endVerse == null ? null : Number(ref.endVerse);
      if (!target) continue;
      if (endVerse != null && (!Number.isInteger(endVerse) || endVerse < Number(ref.verse))) continue;
      records.push({
        source_verse_id: sourceId,
        target_verse_id: target,
        target_end_verse: endVerse,
        score: Number.isFinite(Number(ref?.score)) ? Number(ref.score) : null
      });
      targetIds.push({ book: String(ref.book || "").toUpperCase(), chapter: Number(ref.chapter), verse: Number(ref.verse), endVerse });
    }
  }
  return { records, sourceVerseIds, targetIds, book: sourceBook, chapter };
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Cross-reference download failed: HTTP ${response.status}`);
  return response.json();
}

async function chunkedBulk(records, chunkSize = 1000) {
  for (let i = 0; i < records.length; i += chunkSize) await bulk("cross_references", records.slice(i, i + chunkSize));
}

async function clearCrossReferenceData() {
  await clear("cross_references");
  await clear("cross_reference_index");
}

export async function installFullOpenBibleCorpus({ onProgress = () => {}, concurrency = 8, replace = true } = {}) {
  const booksPayload = await fetchJson(`${OPEN_CROSS_REF_API}/books.json`);
  const books = Array.isArray(booksPayload?.books) ? booksPayload.books : [];
  if (books.length !== 66) throw new Error(`Expected 66 books from the OpenBible corpus, received ${books.length}.`);
  const chapterJobs = [];
  const expectedReferences = Number(booksPayload?.dataset?.totalNumberOfReferences || OPEN_CROSS_REF_EXPECTED);
  for (const book of books) {
    for (let chapter = Number(book.firstChapterNumber); chapter <= Number(book.lastChapterNumber); chapter++) {
      chapterJobs.push({ book: book.id, chapter });
    }
  }
  if (chapterJobs.length !== 1189) throw new Error(`Expected 1,189 chapters from the OpenBible corpus, received ${chapterJobs.length}.`);

  const validVerseIds = new Set();
  const chapterMaxVerse = new Map();
  const rows = [];
  let completed = 0;
  let referenceRows = 0;
  let invalidReferences = 0;
  const pending = [...chapterJobs];

  const worker = async () => {
    while (pending.length) {
      const job = pending.shift();
      const payload = await fetchJson(`${OPEN_CROSS_REF_API}/${job.book}/${job.chapter}.json`);
      const normalized = normalizeOpenCrossReferenceChapter(payload);
      for (const id of normalized.sourceVerseIds) validVerseIds.add(id);
      chapterMaxVerse.set(`${normalized.book}-${normalized.chapter}`.toUpperCase(), normalized.sourceVerseIds.length ? Math.max(...normalized.sourceVerseIds.map(id => Number(id.split("-").pop()))) : 0);
      for (const row of normalized.records) {
        referenceRows++;
        const targetBook = row.target_verse_id.split("-")[0];
        const parts = row.target_verse_id.split("-");
        const targetKey = `${targetBook}-${parts[1]}`;
        const max = chapterMaxVerse.get(targetKey);
        // Target validation is completed after all chapter metadata has been fetched.
        if (max != null && Number(parts[2]) > max) invalidReferences++;
        rows.push(row);
      }
      completed++;
      onProgress({ completed, total: chapterJobs.length, referenceRows, phase: "download" });
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, chapterJobs.length) }, worker));

  // Re-validate every target against the complete chapter map. Ranges stay on the same chapter.
  const validRows = [];
  let unresolved = 0;
  for (const row of rows) {
    const parts = row.target_verse_id.split("-");
    const key = `${parts[0]}-${parts[1]}`;
    const max = chapterMaxVerse.get(key);
    const start = Number(parts[2]);
    const end = row.target_end_verse == null ? start : Number(row.target_end_verse);
    if (!max || start < 1 || end < start || end > max) { unresolved++; continue; }
    validRows.push(row);
  }
  if (unresolved) throw new Error(`OpenBible validation rejected ${unresolved.toLocaleString()} references because their target verse is outside the canonical chapter bounds.`);
  if (validRows.length !== expectedReferences || validRows.length !== OPEN_CROSS_REF_EXPECTED) {
    throw new Error(`Corpus count mismatch: expected ${OPEN_CROSS_REF_EXPECTED.toLocaleString()} references, validated ${validRows.length.toLocaleString()}.`);
  }

  if (replace) await clearCrossReferenceData();
  const records = validRows.map((row) => normalizeCorpusRow({ source_verse_id: row.source_verse_id, target_verse_id: row.target_verse_id, votes: row.score }, { corpusId: OPEN_CROSS_REF_CORPUS_ID, provider: OPEN_CROSS_REF_PROVIDER }));
  for (let i = 0; i < records.length; i += 1000) {
    await bulk("cross_references", records.slice(i, i + 1000));
    onProgress({ completed: chapterJobs.length, total: chapterJobs.length, referenceRows: records.length, stored: Math.min(records.length, i + 1000), phase: "store" });
  }
  await rebuildIndex(records);
  const result = { corpusId: OPEN_CROSS_REF_CORPUS_ID, expectedReferences, imported: records.length, chapters: chapterJobs.length, books: books.length, invalidReferences: 0, unresolved: 0, source: "OpenBible.info", delivery: "Free Use Bible API", license: "CC BY" };
  onProgress({ ...result, phase: "complete" });
  return result;
}

export const FULL_OPENBIBLE_CORPUS_INFO = Object.freeze({ expectedReferences: OPEN_CROSS_REF_EXPECTED, books: 66, chapters: 1189, provider: OPEN_CROSS_REF_PROVIDER, license: "CC BY", sourceUrl: "https://www.openbible.info/labs/cross-references/", apiUrl: OPEN_CROSS_REF_API });

export async function loadCrossReferencesForChapter(book, chapter, { force = false } = {}) {
  const canonicalBook = String(book || '').trim();
  const chapterNumber = Number(chapter);
  if (!canonicalBook || !Number.isInteger(chapterNumber) || chapterNumber < 1) throw new Error('A valid Bible book and chapter are required.');
  const sourcePrefix = `${canonicalBook.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${chapterNumber}-`.toUpperCase();
  if (!force) {
    const existing = (await all('cross_references')).filter(r => String(r.source_verse_id || '').startsWith(sourcePrefix));
    if (existing.length) return { loaded: false, cached: true, count: existing.length };
  }
  const codeMap = Object.fromEntries(Object.entries(OPEN_BIBLE_BOOK_MAP).map(([code, slug]) => [slug, code]));
  const slug = canonicalBook.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const apiBook = codeMap[slug];
  if (!apiBook) throw new Error(`Cross-reference source does not recognize ${canonicalBook}.`);
  const payload = await fetchJson(`${OPEN_CROSS_REF_API}/${apiBook}/${chapterNumber}.json`);
  const normalized = normalizeOpenCrossReferenceChapter(payload);
  const records = normalized.records.map((row) => normalizeCorpusRow({
    source_verse_id: row.source_verse_id,
    target_verse_id: row.target_verse_id,
    votes: row.score
  }, { corpusId: OPEN_CROSS_REF_CORPUS_ID, provider: OPEN_CROSS_REF_PROVIDER }));
  const existing = await all('cross_references');
  const keep = existing.filter(r => !String(r.source_verse_id || '').startsWith(sourcePrefix));
  await clear('cross_references');
  if (keep.length) await bulk('cross_references', keep);
  if (records.length) await bulk('cross_references', records);
  await rebuildIndex();
  return { loaded: true, cached: false, count: records.length, chapter: canonicalBook, chapterNumber };
}

export async function getChapterCrossReferences(book, chapter) {
  const prefix = `${String(book || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Number(chapter)}-`.toUpperCase();
  return (await all('cross_references')).filter(r => String(r.source_verse_id || '').startsWith(prefix));
}

export async function getCrossReferenceStats() {
  const records = await all("cross_references");
  const byType = Object.fromEntries(CROSS_REFERENCE_TYPES.map((type) => [type, 0]));
  const corpora = {};
  for (const record of records) {
    byType[record.relationship_type] = (byType[record.relationship_type] || 0) + 1;
    const id = record.corpus_id || "personal-or-legacy";
    corpora[id] = (corpora[id] || 0) + 1;
  }
  return { total: records.length, byType, corpora };
}

export async function getCrossReferenceIndexStatus() {
  const [records, index] = await Promise.all([all("cross_references"), all("cross_reference_index")]);
  return { relationships: records.length, indexRows: index.length, ready: records.length === 0 ? true : index.length === records.length * 2 };
}
