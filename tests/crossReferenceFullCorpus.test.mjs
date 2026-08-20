import assert from "node:assert/strict";
import { normalizeOpenCrossReferenceChapter, FULL_OPENBIBLE_CORPUS_INFO } from "../crossReferenceService.js";

const payload = {
  book: { id: "GEN" },
  chapter: { number: 1, content: [
    { verse: 1, references: [
      { book: "HEB", chapter: 11, verse: 3, score: 67 },
      { book: "JHN", chapter: 1, verse: 1, endVerse: 3, score: 56 }
    ] },
    { verse: 2, references: [] }
  ] }
};
const normalized = normalizeOpenCrossReferenceChapter(payload);
assert.equal(normalized.records.length, 2);
assert.equal(normalized.records[0].source_verse_id, "GENESIS-1-1");
assert.equal(normalized.records[0].target_verse_id, "HEBREWS-11-3");
assert.equal(normalized.records[1].target_end_verse, 3);
assert.equal(FULL_OPENBIBLE_CORPUS_INFO.expectedReferences, 344799);
assert.equal(FULL_OPENBIBLE_CORPUS_INFO.books, 66);
assert.equal(FULL_OPENBIBLE_CORPUS_INFO.chapters, 1189);
console.log("Full OpenBible corpus installer contract: PASS");
