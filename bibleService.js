// bibleService.js — Phase 2 Bible Engine.
// Translation-neutral Bible engine. English versions are sourced from the
// user's selected HolyBooks repository and cached locally after first access.
import { all, get, put, bulk, remove } from "./store.js";

export const HOLYBOOKS_BASE_URL = "https://raw.githubusercontent.com/bobuk/holybooks/master/EN";
export const KJV_FALLBACK_BASE_URL = "https://raw.githubusercontent.com/aruljohn/Bible-kjv/master";

export const BIBLE_VERSIONS = Object.freeze([
  { id: "ERV", name: "Easy-to-Read Version", abbreviation: "ERV", source: "holybooks" },
  { id: "AMP", name: "Amplified Bible", abbreviation: "AMP", source: "holybooks" },
  { id: "ASV", name: "American Standard Version", abbreviation: "ASV", source: "holybooks" },
  { id: "CPDV", name: "Catholic Public Domain Version", abbreviation: "CPDV", source: "holybooks" },
  { id: "ESV", name: "English Standard Version", abbreviation: "ESV", source: "holybooks" },
  { id: "KJV", name: "King James Version", abbreviation: "KJV", source: "holybooks", isDefault: true },
  { id: "NASB", name: "New American Standard Bible", abbreviation: "NASB", source: "holybooks" },
  { id: "WEB", name: "World English Bible", abbreviation: "WEB", source: "holybooks" },
]);

export const KJV_PROVIDER_ID = "KJV";
export const DEFAULT_TRANSLATION_ID = "KJV";
export const KJV_METADATA = Object.freeze({ id: "KJV", name: "King James Version", abbreviation: "KJV", provider: "HolyBooks GitHub repository", isLocal: false, isDefault: true, status: "remote_source" });
export const ESV_METADATA = Object.freeze({ id: "ESV", name: "English Standard Version", abbreviation: "ESV", provider: "HolyBooks GitHub repository", isLocal: false, isDefault: false, status: "remote_source" });

const BOOKS = [
  ["Genesis","GEN","OT"],["Exodus","EXO","OT"],["Leviticus","LEV","OT"],["Numbers","NUM","OT"],["Deuteronomy","DEU","OT"],
  ["Joshua","JOS","OT"],["Judges","JDG","OT"],["Ruth","RUT","OT"],["1 Samuel","1SA","OT"],["2 Samuel","2SA","OT"],
  ["1 Kings","1KI","OT"],["2 Kings","2KI","OT"],["1 Chronicles","1CH","OT"],["2 Chronicles","2CH","OT"],["Ezra","EZR","OT"],
  ["Nehemiah","NEH","OT"],["Esther","EST","OT"],["Job","JOB","OT"],["Psalms","PSA","OT"],["Proverbs","PRO","OT"],
  ["Ecclesiastes","ECC","OT"],["Song of Solomon","SNG","OT"],["Isaiah","ISA","OT"],["Jeremiah","JER","OT"],["Lamentations","LAM","OT"],
  ["Ezekiel","EZK","OT"],["Daniel","DAN","OT"],["Hosea","HOS","OT"],["Joel","JOL","OT"],["Amos","AMO","OT"],["Obadiah","OBA","OT"],
  ["Jonah","JON","OT"],["Micah","MIC","OT"],["Nahum","NAH","OT"],["Habakkuk","HAB","OT"],["Zephaniah","ZEP","OT"],
  ["Haggai","HAG","OT"],["Zechariah","ZEC","OT"],["Malachi","MAL","OT"],
  ["Matthew","MAT","NT"],["Mark","MRK","NT"],["Luke","LUK","NT"],["John","JHN","NT"],["Acts","ACT","NT"],["Romans","ROM","NT"],
  ["1 Corinthians","1CO","NT"],["2 Corinthians","2CO","NT"],["Galatians","GAL","NT"],["Ephesians","EPH","NT"],["Philippians","PHP","NT"],
  ["Colossians","COL","NT"],["1 Thessalonians","1TH","NT"],["2 Thessalonians","2TH","NT"],["1 Timothy","1TI","NT"],["2 Timothy","2TI","NT"],
  ["Titus","TIT","NT"],["Philemon","PHM","NT"],["Hebrews","HEB","NT"],["James","JAS","NT"],["1 Peter","1PE","NT"],["2 Peter","2PE","NT"],
  ["1 John","1JN","NT"],["2 John","2JN","NT"],["3 John","3JN","NT"],["Jude","JUD","NT"],["Revelation","REV","NT"]
].map(([name, code, testament]) => ({ name, code, testament }));

const ALIASES = new Map();
for (const book of BOOKS) {
  const compact = book.name.toLowerCase().replace(/[^a-z0-9]/g, "");
  ALIASES.set(compact, book);
  ALIASES.set(book.code.toLowerCase(), book);
}
["ps", "psalm", "psa"].forEach((x) => ALIASES.set(x, BOOKS.find(b => b.code === "PSA")));
ALIASES.set("jn", BOOKS.find(b => b.code === "JHN"));
// Common abbreviations used by historical 1689 proof-text lists.
const SCRIPTURE_REFERENCE_ALIASES = {
  gen:"GEN", exo:"EXO", lev:"LEV", num:"NUM", deu:"DEU", jos:"JOS", jdg:"JDG", rut:"RUT",
  "1sa":"1SA", "2sa":"2SA", "1ki":"1KI", "2ki":"2KI", "1ch":"1CH", "2ch":"2CH", ezr:"EZR", neh:"NEH", est:"EST",
  job:"JOB", psa:"PSA", ps:"PSA", pro:"PRO", ecc:"ECC", song:"SNG", isa:"ISA", jer:"JER", lam:"LAM", eze:"EZK", dan:"DAN",
  hos:"HOS", joe:"JOL", amo:"AMO", oba:"OBA", jon:"JON", mic:"MIC", nah:"NAH", hab:"HAB", zep:"ZEP", hag:"HAG", zec:"ZEC", mal:"MAL",
  mat:"MAT", mar:"MRK", luk:"LUK", joh:"JHN", jn:"JHN", act:"ACT", rom:"ROM", "1co":"1CO", "2co":"2CO", gal:"GAL", eph:"EPH",
  phi:"PHP", col:"COL", "1th":"1TH", "2th":"2TH", "1ti":"1TI", "2ti":"2TI", ti:"TIT", tit:"TIT", phm:"PHM", heb:"HEB",
  jam:"JAS", jas:"JAS", "1pe":"1PE", "2pe":"2PE", "1jo":"1JN", "2jo":"2JN", "3jo":"3JN", jud:"JUD", rev:"REV"
};
for (const [alias, code] of Object.entries(SCRIPTURE_REFERENCE_ALIASES)) ALIASES.set(alias, BOOKS.find(b => b.code === code));

const bookCache = new Map();
const remoteCache = new Map();

function canonicalBook(book) {
  const key = String(book ?? "").trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, "");
  return ALIASES.get(key) || BOOKS.find(b => b.name.toLowerCase() === String(book ?? "").trim().toLowerCase()) || null;
}

export function canonicalChapterId(book, chapter) {
  const b = canonicalBook(book) || { name: String(book) };
  if (!b.name || !Number.isInteger(Number(chapter))) throw new TypeError("Canonical chapter identity requires book and chapter.");
  return `${b.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Number(chapter)}`;
}

export function canonicalVerseId(book, chapter, verse) {
  const b = canonicalBook(book) || { name: String(book) };
  if (!b.name || !Number.isInteger(Number(chapter)) || !Number.isInteger(Number(verse))) throw new TypeError("Canonical verse identity requires book, chapter, and verse.");
  return `${canonicalChapterId(b.name, chapter)}-${Number(verse)}`;
}

export function getBibleVersions() { return BIBLE_VERSIONS; }

export async function getAvailableBibleVersions() {
  const custom = await all("bible_translations");
  const customVersions = custom.filter(v => v?.source === "user-upload" || v?.source === "local-upload").map(v => ({ ...v, isCustom: true, source: "local-upload", isLocal: true }));
  return [...BIBLE_VERSIONS, ...customVersions.filter(c => !BIBLE_VERSIONS.some(v => v.id === c.id))];
}

export function sanitizeTranslationId(value) {
  const id = String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!id) throw new Error("A translation ID or abbreviation is required.");
  return id.slice(0, 32);
}

function localBookKey(versionId, bookCode) { return `${versionId}:${bookCode}`; }

async function getLocalBook(versionId, bookCode) {
  const record = await get("bible_text", localBookKey(versionId, bookCode));
  const data = record?.data;
  // Older/broken KJV imports can leave a record in IndexedDB without the
  // canonical chapters array. Do not treat that record as a valid local book.
  // Removing it lets fetchBook recover from the remote source on the next
  // request instead of reporting a misleading "No KJV data returned" error.
  if (!data || !Array.isArray(data.chapters) || data.chapters.length === 0) {
    if (record) await remove("bible_text", localBookKey(versionId, bookCode));
    return null;
  }
  return data;
}

export async function saveLocalTranslation(version, normalizedBooks) {
  const translationId = sanitizeTranslationId(version.id || version.abbreviation);
  const metadata = {
    id: translationId,
    name: String(version.name || translationId).trim(),
    abbreviation: String(version.abbreviation || translationId).trim().toUpperCase(),
    source: "local-upload",
    isLocal: true,
    isCustom: true,
    status: "local",
    importedAt: new Date().toISOString(),
    bookCount: normalizedBooks.length
  };
  await put("bible_translations", metadata);
  await bulk("bible_text", normalizedBooks.map(book => ({
    id: localBookKey(translationId, book.code),
    translationId,
    bookCode: book.code,
    book: book.book,
    data: { ...book, translationId }
  })));
  const storedBooks = await all("bible_text");
  const uniqueBookCount = new Set(storedBooks.filter(r => r.translationId === translationId).map(r => r.bookCode)).size;
  metadata.bookCount = uniqueBookCount;
  await put("bible_translations", metadata);
  bookCache.clear();
  remoteCache.clear();
  return metadata;
}

export async function removeLocalTranslation(translationId) {
  const id = sanitizeTranslationId(translationId);
  const records = await all("bible_text");
  for (const record of records.filter(r => r.translationId === id)) await remove("bible_text", record.id);
  await remove("bible_translations", id);
  bookCache.clear();
}

function inferBookFromValue(value) {
  if (!value) return null;
  if (typeof value === "object") return canonicalBook(value.name || value.book || value.bookName || value.title || value.code || value.ID || value.id);
  return canonicalBook(value);
}

function mergeDuplicateVerses(verses) {
  const merged = new Map();
  for (const verse of verses) {
    if (!Number.isInteger(verse?.verse) || !verse.text) continue;
    const existing = merged.get(verse.verse);
    if (!existing) {
      merged.set(verse.verse, { ...verse });
      continue;
    }
    const extra = normalizeVerseText(verse.text, verse.verse);
    if (extra && extra !== existing.text) existing.text = `${existing.text} ${extra}`.replace(/\s+/g, " ").trim();
  }
  return [...merged.values()].sort((a, b) => a.verse - b.verse);
}

function normalizeStoredBook(bookData, book, versionId) {
  if (!bookData || !Array.isArray(bookData.chapters)) return bookData;
  const normalized = {
    ...bookData,
    book: bookData.book || book.name,
    code: bookData.code || book.code,
    translationId: bookData.translationId || versionId,
    chapters: bookData.chapters.map((chapter) => {
      const verses = (chapter.verses || []).map((verse) => ({
        verse: Number(verse.verse),
        text: normalizeVerseText(verse.text, Number(verse.verse))
      }));
      return { ...chapter, chapter: Number(chapter.chapter), verses: mergeDuplicateVerses(verses) };
    }).filter(ch => Number.isInteger(ch.chapter) && ch.verses.length)
  };
  return normalized;
}

function normalizeChapterArray(chapters, book, version) {
  if (!Array.isArray(chapters)) return [];
  return chapters.map((ch, index) => {
    const chapterNumber = Number(ch?.chapter ?? ch?.number ?? String(ch?.ID ?? index + 1).split(".").pop());
    const verses = Array.isArray(ch?.text) ? ch.text : Array.isArray(ch?.verses) ? ch.verses : [];
    const normalized = verses.map((v, vi) => {
      const verseNumber = Number(v?.verse ?? v?.number ?? v?.ID ?? vi + 1);
      return {
        verse: verseNumber,
        text: normalizeVerseText(v?.text ?? v?.content ?? v?.value ?? "", verseNumber)
      };
    });
    return { chapter: chapterNumber, verses: mergeDuplicateVerses(normalized) };
  }).filter(ch => Number.isInteger(ch.chapter) && ch.verses.length);
}

export function normalizeUploadedTranslation(input, options = {}) {
  const raw = input;
  const inferredName = raw?.name || raw?.translation?.name || raw?.metadata?.name || options.name || options.id;
  const inferredId = raw?.abbreviation || raw?.translation?.abbreviation || raw?.metadata?.abbreviation || options.id || options.name;
  const id = sanitizeTranslationId(inferredId);
  const name = String(inferredName || id).trim();
  const abbreviation = String(inferredId || id).trim().toUpperCase();
  const bookRecords = [];

  const candidates = Array.isArray(raw) ? raw : Array.isArray(raw?.books) ? raw.books : Array.isArray(raw?.translations) ? raw.translations : null;
  if (candidates) {
    for (const candidate of candidates) {
      const book = inferBookFromValue(candidate);
      if (!book) continue;
      const chapters = candidate.chapters || candidate.text || candidate.verses;
      const normalizedChapters = Array.isArray(chapters) && chapters.length && (chapters[0]?.text || chapters[0]?.verses)
        ? normalizeChapterArray(chapters, book, { id })
        : [];
      if (normalizedChapters.length) bookRecords.push({ book: book.name, code: book.code, testament: book.testament, translationId: id, chapters: normalizedChapters });
    }
  }

  if (!bookRecords.length) {
    const book = inferBookFromValue(raw?.book || raw?.bookName || raw?.name) || inferBookFromValue(options.book) || inferBookFromValue(options.filename?.replace(/\.json$/i, ""));
    const chapters = raw?.chapters || raw?.text;
    if (book && Array.isArray(chapters)) {
      const normalizedChapters = normalizeChapterArray(chapters, book, { id });
      if (normalizedChapters.length) bookRecords.push({ book: book.name, code: book.code, testament: book.testament, translationId: id, chapters: normalizedChapters });
    }
  }

  if (!bookRecords.length) {
    const verses = Array.isArray(raw) ? raw : raw?.verses;
    if (Array.isArray(verses)) {
      const grouped = new Map();
      for (const v of verses) {
        const book = inferBookFromValue(v.book || v.bookName || v);
        const chapter = Number(v.chapter);
        const verse = Number(v.verse || v.number || v.ID);
        const text = normalizeVerseText(v.text || v.content || "", verse);
        if (!book || !Number.isInteger(chapter) || !Number.isInteger(verse) || !text) continue;
        if (!grouped.has(book.code)) grouped.set(book.code, { book: book.name, code: book.code, testament: book.testament, translationId: id, chapters: [] });
        let ch = grouped.get(book.code).chapters.find(c => c.chapter === chapter);
        if (!ch) { ch = { chapter, verses: [] }; grouped.get(book.code).chapters.push(ch); }
        ch.verses.push({ verse, text });
      }
      bookRecords.push(...grouped.values());
    }
  }

  const deduped = [...new Map(bookRecords.map(b => [b.code, b])).values()];
  if (!deduped.length) throw new Error("Could not recognize the JSON Bible structure. Use a whole-Bible JSON, a books array, or a HolyBooks-style book JSON.");
  deduped.forEach(book => book.chapters.sort((a,b) => a.chapter - b.chapter).forEach(ch => ch.verses.sort((a,b) => a.verse - b.verse)));
  return { metadata: { id, name, abbreviation, source: "local-upload" }, books: deduped };
}

export async function importTranslationJson(input, options = {}) {
  const parsed = normalizeUploadedTranslation(input, options);
  if (BIBLE_VERSIONS.some(v => v.id === parsed.metadata.id)) throw new Error(`${parsed.metadata.id} is a built-in translation ID. Use a different ID for an imported translation.`);
  const metadata = await saveLocalTranslation(parsed.metadata, parsed.books);
  return { metadata, bookNames: parsed.books.map(b => b.book), booksImported: parsed.books.length, chaptersImported: parsed.books.reduce((n,b) => n + b.chapters.length, 0), versesImported: parsed.books.reduce((n,b) => n + b.chapters.reduce((m,c) => m + c.verses.length, 0), 0) };
}
export function getBookList() { return BOOKS; }

function provider(versionId) {
  return BIBLE_VERSIONS.find(v => v.id === versionId) || BIBLE_VERSIONS.find(v => v.id === DEFAULT_TRANSLATION_ID);
}

async function fetchRemoteBibleJson(url, label) {
  let response;
  try {
    response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
  } catch (error) {
    throw new Error(`${label} could not be reached. Check your internet connection. ${error?.message || "Network request failed."}`);
  }
  if (!response.ok) throw new Error(`${label} unavailable (${response.status}).`);
  const contentType = response.headers.get("content-type") || "";
  let raw;
  try { raw = await response.json(); }
  catch (error) { throw new Error(`${label} returned invalid JSON${contentType ? ` (${contentType})` : ""}.`); }
  return raw;
}

function validateRemoteBook(data, book, version) {
  const chapters = data?.chapters;
  const verseCount = Array.isArray(chapters) ? chapters.reduce((sum, chapter) => sum + (Array.isArray(chapter?.verses) ? chapter.verses.length : 0), 0) : 0;
  if (!Array.isArray(chapters) || chapters.length === 0 || verseCount === 0) {
    throw new Error(`${version.abbreviation} ${book.name} source contained no usable chapters or verses.`);
  }
  return data;
}

async function fetchRemoteBook(version, book) {
  const primaryUrl = `${HOLYBOOKS_BASE_URL}/${book.testament}/${book.code}/${version.id}.json`;
  try {
    const raw = await fetchRemoteBibleJson(primaryUrl, `${version.abbreviation} ${book.name}`);
    return validateRemoteBook(normalizeHolyBook(raw, book, version), book, version);
  } catch (primaryError) {
    // KJV has a second, independently hosted public-domain source. This is a
    // recovery path only; HolyBooks remains the preferred source.
    if (version.id !== "KJV") throw primaryError;
    const fallbackUrl = `${KJV_FALLBACK_BASE_URL}/${book.name}.json`;
    try {
      const raw = await fetchRemoteBibleJson(fallbackUrl, `KJV ${book.name} fallback source`);
      return validateRemoteBook(normalizeKjvFallbackBook(raw, book, version), book, version);
    } catch (fallbackError) {
      throw new Error(`KJV ${book.name} download failed. Primary source: ${primaryError.message} Fallback source: ${fallbackError.message}`);
    }
  }
}

async function fetchBook(versionId, book) {
  const v = provider(versionId);
  const b = canonicalBook(book);
  if (!b) return null;
  const key = `${v.id}:${b.code}`;
  if (bookCache.has(key)) return bookCache.get(key);
  const local = await getLocalBook(v.id, b.code);
  if (local) {
    const normalized = normalizeStoredBook(local, b, v.id);
    if (JSON.stringify(normalized) !== JSON.stringify(local)) {
      await put("bible_text", { id: localBookKey(v.id, b.code), translationId: v.id, bookCode: b.code, book: b.name, data: normalized });
    }
    bookCache.set(key, Promise.resolve(normalized));
    return normalized;
  }
  const custom = (await all("bible_translations")).find(x => x.id === v.id && (x.source === "local-upload" || x.source === "user-upload"));
  if (custom) throw new Error(`${v.abbreviation} has not imported the ${b.name} book.`);
  const promise = fetchRemoteBook(v, b);
  bookCache.set(key, promise);
  try { return await promise; } catch (e) { bookCache.delete(key); throw e; }
}

export function normalizeVerseText(text, verseNumber) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  const number = Number(verseNumber);
  if (!Number.isInteger(number) || !value) return value;
  // Some HolyBooks files repeat the verse number inside the verse text.
  // The reader renders the canonical verse number separately, so remove only
  // a leading copy that exactly matches the verse identity.
  // Source files can contain the verse number once, twice, or with punctuation
  // (for example: "16 16 For..." or "16. 16 For..."). The reader renders the
  // canonical verse number separately, so strip only repeated leading copies of
  // the exact verse identity. Never remove a matching number later in the text.
  const token = String(number).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const prefix = new RegExp("^(?:" + token + ")(?:(?:[\\s\\u00a0]+)|(?:[.)\\]:-]\\s*))+");
  let cleaned = value;
  let previous = "";
  while (cleaned !== previous) {
    previous = cleaned;
    cleaned = cleaned.replace(prefix, "").trim();
  }
  return cleaned;
}

function normalizeKjvFallbackBook(raw, book, version) {
  if (!raw || !Array.isArray(raw.chapters)) throw new Error(`Invalid fallback KJV source for ${book.name}.`);
  return {
    book: book.name,
    code: book.code,
    translationId: version.id,
    chapters: raw.chapters.map(ch => ({
      chapter: Number(ch.chapter),
      verses: (ch.verses || []).map(v => ({
        verse: Number(v.verse),
        text: normalizeVerseText(String(v.text || "").replace(/\n/g, " "), Number(v.verse))
      })).filter(v => Number.isInteger(v.verse) && v.text)
    })).filter(ch => Number.isInteger(ch.chapter) && ch.verses.length)
  };
}

export function normalizeHolyBook(raw, book, version) {
  if (!raw || !Array.isArray(raw.text)) throw new Error(`Invalid ${version.abbreviation} source for ${book.name}.`);
  return {
    book: book.name,
    code: book.code,
    translationId: version.id,
    chapters: raw.text.map(ch => {
      const normalized = (ch.text || []).filter(v => String(v.text || "").trim() !== "").map(v => ({
        verse: Number(v.ID), text: normalizeVerseText(String(v.text).replace(/\n/g, " "), Number(v.ID))
      }));
      return {
        chapter: Number(String(ch.ID || "").split(".").pop()),
        verses: mergeDuplicateVerses(normalized)
      };
    }).filter(ch => Number.isInteger(ch.chapter))
  };
}

export async function getAvailability(versionId = DEFAULT_TRANSLATION_ID) {
  const v = provider(versionId);
  let loaded = 0;
  for (const b of BOOKS) {
    if (bookCache.has(`${v.id}:${b.code}`)) loaded++;
  }
  return {
    available: true,
    source: "HolyBooks GitHub repository",
    versionId: v.id,
    versionName: v.name,
    bookCount: BOOKS.length,
    cachedBookCount: loaded,
    message: loaded ? `${loaded} book(s) cached locally; uncached books require internet.` : "Bible is available through the selected HolyBooks source."
  };
}

export async function downloadKJVLocally(onProgress = () => {}) {
  const versionId = DEFAULT_TRANSLATION_ID;
  const total = BOOKS.length;
  let booksDownloaded = 0;
  let versesDownloaded = 0;

  for (const book of BOOKS) {
    // A download is an explicit acquisition operation. Do not rely on an old
    // in-memory promise from a previous failed page load. Prefer an already
    // valid local book, otherwise fetch and validate the remote source directly.
    const local = await getLocalBook(versionId, book.code);
    const data = local || await fetchRemoteBook(provider(versionId), book);
    if (!data?.chapters?.length) throw new Error(`KJV ${book.name} returned no usable chapters.`);
    const normalized = normalizeStoredBook(data, book, versionId);
    const verseCount = normalized.chapters.reduce((sum, chapter) => sum + chapter.verses.length, 0);
    if (!verseCount) throw new Error(`KJV ${book.name} returned no usable verses.`);
    versesDownloaded += normalized.chapters.reduce((sum, chapter) => sum + chapter.verses.length, 0);
    await put("bible_text", {
      id: localBookKey(versionId, book.code),
      translationId: versionId,
      bookCode: book.code,
      book: book.name,
      data: normalized
    });
    booksDownloaded += 1;
    onProgress({ completed: booksDownloaded, total, book: book.name });
  }

  bookCache.clear();
  remoteCache.clear();
  return { booksDownloaded, versesDownloaded, totalBooks: total };
}

export async function getLocalBibleBookCount(versionId = DEFAULT_TRANSLATION_ID) {
  const records = await all("bible_text");
  return new Set(records.filter(record => record.translationId === versionId).map(record => record.bookCode)).size;
}

export async function getBook(book, versionId = DEFAULT_TRANSLATION_ID) { return fetchBook(versionId, book); }

export async function getChapter(book, chapter, versionId = DEFAULT_TRANSLATION_ID) {
  const foundBook = await getBook(book, versionId);
  if (!foundBook) return null;
  return foundBook.chapters.find(c => Number(c.chapter) === Number(chapter)) || null;
}

export async function getVerse(book, chapter, verse, versionId = DEFAULT_TRANSLATION_ID) {
  const ch = await getChapter(book, chapter, versionId);
  if (!ch) return null;
  const found = ch.verses.find(v => Number(v.verse) === Number(verse));
  if (!found) return null;
  const b = canonicalBook(book);
  return { id: `${versionId}:${canonicalVerseId(b.name, chapter, verse)}`, canonicalVerseId: canonicalVerseId(b.name, chapter, verse), book: b.name, chapter: Number(chapter), verse: Number(verse), translationId: versionId, text: found.text };
}

export async function getPassage(book, chapter, startVerse, endVerse = startVerse, versionId = DEFAULT_TRANSLATION_ID) {
  const ch = await getChapter(book, chapter, versionId);
  if (!ch) return null;
  return ch.verses.filter(v => v.verse >= Number(startVerse) && v.verse <= Number(endVerse)).map(v => ({ ...v, book: canonicalBook(book).name, chapter: Number(chapter), translationId: versionId, canonicalVerseId: canonicalVerseId(book, chapter, v.verse) }));
}

export async function search(query, options = {}) {
  const term = String(query ?? "").trim().toLowerCase();
  if (!term) return [];
  const versionId = options.translationId || DEFAULT_TRANSLATION_ID;
  const limit = Math.max(1, Math.min(Number(options.limit) || 100, 1000));
  const books = options.book ? [canonicalBook(options.book)].filter(Boolean) : BOOKS;
  const results = [];
  for (const b of books) {
    const data = await getBook(b.name, versionId);
    for (const ch of data?.chapters || []) for (const v of ch.verses) {
      if (v.text.toLowerCase().includes(term)) {
        results.push({ book: b.name, chapter: ch.chapter, verse: v.verse, translationId: versionId, canonicalVerseId: canonicalVerseId(b.name, ch.chapter, v.verse), text: v.text });
        if (results.length >= limit) return results;
      }
    }
  }
  return results;
}

export async function getCrossReferences() {
  const module = await import("./crossReferenceService.js");
  return module.findBySourceVerse?.(...arguments) ?? [];
}

export async function getTranslationStatus() {
  const versions = await getAvailableBibleVersions();
  const statuses = {};
  for (const v of versions) {
    const localRecords = await all("bible_text");
    const cachedBookCount = localRecords.filter(r => r.translationId === v.id).length;
    statuses[v.id] = { ...v, status: v.source === "local-upload" ? "local" : "remote_source", available: true, cachedBookCount, bookCount: v.source === "local-upload" ? (v.bookCount || cachedBookCount) : BOOKS.length };
  }
  return statuses;
}
