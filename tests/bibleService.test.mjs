import test from "node:test";
import assert from "node:assert/strict";
import { canonicalVerseId, KJV_METADATA, ESV_METADATA, getBibleVersions, normalizeVerseText, normalizeUploadedTranslation, normalizeHolyBook } from "../bibleService.js";

test("canonical verse identity is translation-neutral", () => {
  assert.equal(canonicalVerseId("John", 3, 16), "john-3-16");
  assert.equal(canonicalVerseId("Jn", 3, 16), "john-3-16");
  assert.equal(canonicalVerseId("1 John", 1, 1), "1-john-1-1");
});

test("HolyBooks catalog exposes the supported English versions", () => {
  assert.equal(KJV_METADATA.id, "KJV");
  assert.equal(KJV_METADATA.isDefault, true);
  assert.equal(ESV_METADATA.id, "ESV");
  assert.deepEqual(getBibleVersions().map(v => v.id), ["ERV","AMP","ASV","CPDV","ESV","KJV","NASB","WEB"]);
});


test("source verse-number duplication is removed conservatively", () => {
  assert.equal(normalizeVerseText("1 The proverbs of Solomon the son of David", 1), "The proverbs of Solomon the son of David");
  assert.equal(normalizeVerseText("16 For God so loved the world", 16), "For God so loved the world");
  assert.equal(normalizeVerseText("16 16 For God so loved the world", 16), "For God so loved the world");
  assert.equal(normalizeVerseText("16. 16 For God so loved the world", 16), "For God so loved the world");
  assert.equal(normalizeVerseText("16) 16 For God so loved the world", 16), "For God so loved the world");
  assert.equal(normalizeVerseText("One 1 later in the sentence", 1), "One 1 later in the sentence");
});


test("uploaded translation parser merges duplicate verse-number records", () => {
  const parsed = normalizeUploadedTranslation({
    books: [{ name: "Romans", chapters: [{ chapter: 3, verses: [
      { verse: 4, text: "4 God forbid." },
      { verse: 4, text: "4 Let God be true." },
      { verse: 5, text: "5 But if our unrighteousness." }
    ] }] }]
  }, { id: "DUP", name: "Duplicate Test" });
  const verses = parsed.books[0].chapters[0].verses;
  assert.deepEqual(verses.map(v => v.verse), [4, 5]);
  assert.equal(verses[0].text, "God forbid. Let God be true.");
});

test("uploaded translation parser accepts HolyBooks-style book JSON", () => {
  const parsed = normalizeUploadedTranslation({
    text: [
      { ID: "1", text: [{ ID: 1, text: "1 In the beginning" }, { ID: 2, text: "2 And the earth" }] }
    ]
  }, { id: "TST", name: "Test Translation", filename: "GEN.json" });
  assert.equal(parsed.metadata.id, "TST");
  assert.equal(parsed.books[0].book, "Genesis");
  assert.equal(parsed.books[0].chapters[0].verses[0].text, "In the beginning");
});

test("uploaded translation parser accepts whole-Bible books arrays", () => {
  const parsed = normalizeUploadedTranslation({
    books: [{ name: "John", chapters: [{ chapter: 3, verses: [{ verse: 16, text: "For God so loved the world" }] }] }]
  }, { id: "TST2", name: "Test Two" });
  assert.equal(parsed.books.length, 1);
  assert.equal(parsed.books[0].code, "JHN");
  assert.equal(parsed.books[0].chapters[0].verses[0].verse, 16);
});

test("HolyBooks KJV payload normalizes into usable chapters and verses", () => {
  const parsed = normalizeHolyBook({
    text: [{ ID: "OT:GEN.1", name: "Genesis 1", text: [
      { ID: "1", text: "In the beginning God created the heaven and the earth." },
      { ID: "1", text: "" },
      { ID: "2", text: "And the earth was without form, and void;" }
    ] }]
  }, { name: "Genesis", code: "GEN" }, { id: "KJV", abbreviation: "KJV" });
  assert.equal(parsed.chapters.length, 1);
  assert.deepEqual(parsed.chapters[0].verses.map(v => v.verse), [1, 2]);
});
