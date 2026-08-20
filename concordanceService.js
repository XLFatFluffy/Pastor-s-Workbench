// concordanceService.js — Phase 5 KJV concordance engine.
// The index is built only from KJV books already stored in the local
// bible_text persistence layer. It never fetches Bible text from the network.
//
// Each indexed word has one record in concordance_entries. The record's
// metadata.occurrences array contains the canonical verse identity, reference,
// and verse text needed for fast lookup and short-context display.

import { all, bulk, remove } from "./store.js";
import { getBookList } from "./bibleService.js";

export const CONCORDANCE_VERSION = "1.1";
export const CONCORDANCE_TRANSLATION_ID = "KJV";

function normalizeApostrophes(value) {
  return String(value ?? "").replace(/[’‘‛]/g, "'");
}

export function normalizeWord(value) {
  return normalizeApostrophes(value)
    .toLowerCase()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "")
    .replace(/[^a-z0-9']+/gi, "")
    .trim();
}

export function tokenizeKjvText(text) {
  const normalized = normalizeApostrophes(text);
  const matches = normalized.match(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)*/g) || [];
  return matches.map(normalizeWord).filter(Boolean);
}

export function buildConcordanceEntries(bookRecords) {
  const byWord = new Map();

  for (const bookRecord of bookRecords || []) {
    if (!bookRecord?.book || !Array.isArray(bookRecord.chapters)) continue;
    for (const chapter of bookRecord.chapters) {
      const chapterNumber = Number(chapter?.chapter);
      if (!Number.isInteger(chapterNumber)) continue;
      for (const verse of chapter?.verses || []) {
        const verseNumber = Number(verse?.verse);
        const text = String(verse?.text ?? "").trim();
        if (!Number.isInteger(verseNumber) || !text) continue;

        const uniqueWords = new Set(tokenizeKjvText(text));
        for (const word of uniqueWords) {
          if (!byWord.has(word)) {
            byWord.set(word, {
              id: `${CONCORDANCE_TRANSLATION_ID}:${word}`,
              language: "en",
              word,
              normalized_word: word,
              display_form: word,
              description: `KJV occurrences of “${word}”.`,
              metadata: {
                version: CONCORDANCE_VERSION,
                translationId: CONCORDANCE_TRANSLATION_ID,
                occurrenceCount: 0,
                occurrences: []
              },
              source_id: "local-kjv"
            });
          }
          const entry = byWord.get(word);
          entry.metadata.occurrences.push({
            book: bookRecord.book,
            chapter: chapterNumber,
            verse: verseNumber,
            canonicalVerseId: `${bookRecord.book.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${chapterNumber}-${verseNumber}`,
            text
          });
        }
      }
    }
  }

  const bookOrder = new Map(getBookList().map((book, index) => [book.name, index]));
  for (const entry of byWord.values()) {
    entry.metadata.occurrences.sort((a, b) =>
      (bookOrder.get(a.book) ?? Number.MAX_SAFE_INTEGER) - (bookOrder.get(b.book) ?? Number.MAX_SAFE_INTEGER) ||
      a.chapter - b.chapter ||
      a.verse - b.verse
    );
    entry.metadata.occurrenceCount = entry.metadata.occurrences.length;
  }

  return [...byWord.values()].sort((a, b) => a.word.localeCompare(b.word));
}

export function searchConcordanceEntries(entries, query, options = {}) {
  const term = normalizeWord(query);
  if (!term) return [];

  const mode = options.mode === "prefix" ? "prefix" : "exact";
  const limit = Math.max(1, Math.min(Number(options.limit) || 500, 5000));
  const matched = (entries || []).filter(entry =>
    mode === "prefix" ? entry.normalized_word.startsWith(term) : entry.normalized_word === term
  );

  const occurrences = [];
  for (const entry of matched) {
    for (const occurrence of entry.metadata?.occurrences || []) {
      occurrences.push({
        ...occurrence,
        word: entry.display_form,
        translationId: CONCORDANCE_TRANSLATION_ID
      });
      if (occurrences.length >= limit) return occurrences;
    }
  }
  return occurrences;
}

async function localKjvBooks() {
  const records = await all("bible_text");
  const expectedCodes = new Set(getBookList().map(book => book.code));
  const byCode = new Map();
  for (const record of records) {
    if (record?.translationId !== CONCORDANCE_TRANSLATION_ID) continue;
    const data = record?.data;
    const code = String(record?.bookCode || data?.code || "").toUpperCase();
    if (!expectedCodes.has(code) || !data?.book || !Array.isArray(data.chapters) || data.chapters.length === 0) continue;
    byCode.set(code, data);
  }
  return getBookList().map(book => byCode.get(book.code)).filter(Boolean);
}

export async function getConcordanceStatus() {
  const entries = await all("concordance_entries");
  const kjvBooks = await localKjvBooks();
  const expectedBooks = getBookList().length;
  const expectedCodes = getBookList().map(book => book.code);
  const localCodes = new Set(kjvBooks.map(book => book.code));
  const missingBooks = expectedCodes.filter(code => !localCodes.has(code));
  const indexedEntries = entries.filter(entry => entry?.id?.startsWith(`${CONCORDANCE_TRANSLATION_ID}:`));
  const occurrenceCount = indexedEntries.reduce((sum, entry) => sum + Number(entry.metadata?.occurrenceCount || 0), 0);
  return {
    translationId: CONCORDANCE_TRANSLATION_ID,
    localBookCount: kjvBooks.length,
    expectedBookCount: expectedBooks,
    completeLocalBible: kjvBooks.length === expectedBooks && missingBooks.length === 0,
    missingBooks,
    indexedWordCount: indexedEntries.length,
    occurrenceCount,
    ready: indexedEntries.length > 0 && kjvBooks.length === expectedBooks
  };
}

export async function buildKjvConcordance({ replace = true } = {}) {
  const books = await localKjvBooks();
  const expectedBooks = getBookList().length;

  if (books.length !== expectedBooks) {
    throw new Error(
      `The local KJV is incomplete: found ${books.length} of ${expectedBooks} books. ` +
      `Load the complete KJV into the local Bible store before building the concordance.`
    );
  }

  if (replace) {
    const existing = await all("concordance_entries");
    for (const entry of existing.filter(item => item?.id?.startsWith(`${CONCORDANCE_TRANSLATION_ID}:`))) {
      await remove("concordance_entries", entry.id);
    }
  }

  const entries = buildConcordanceEntries(books);
  await bulk("concordance_entries", entries);
  return getConcordanceStatus();
}

export async function searchConcordance(query, options = {}) {
  const entries = (await all("concordance_entries"))
    .filter(entry => entry?.id?.startsWith(`${CONCORDANCE_TRANSLATION_ID}:`));
  return searchConcordanceEntries(entries, query, options);
}
