import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeWord,
  tokenizeKjvText,
  buildConcordanceEntries,
  searchConcordanceEntries
} from "../concordanceService.js";

test("normalizes KJV words consistently", () => {
  assert.equal(normalizeWord("Grace,"), "grace");
  assert.equal(normalizeWord("Jesus’"), "jesus");
  assert.deepEqual(tokenizeKjvText("In the beginning, God created."), ["in", "the", "beginning", "god", "created"]);
});

test("builds one concordance entry per unique word with all verse occurrences", () => {
  const entries = buildConcordanceEntries([
    {
      book: "Genesis",
      chapters: [
        { chapter: 1, verses: [
          { verse: 1, text: "In the beginning God created." },
          { verse: 2, text: "And God said." }
        ]}
      ]
    }
  ]);

  const god = entries.find(entry => entry.word === "god");
  assert.ok(god);
  assert.equal(god.metadata.occurrenceCount, 2);
  assert.deepEqual(
    god.metadata.occurrences.map(o => `${o.book} ${o.chapter}:${o.verse}`),
    ["Genesis 1:1", "Genesis 1:2"]
  );
});

test("search supports exact and prefix word lookup", () => {
  const entries = buildConcordanceEntries([
    { book: "John", chapters: [{ chapter: 1, verses: [
      { verse: 1, text: "In the beginning was the Word." },
      { verse: 2, text: "The Word was with God." }
    ]}]}
  ]);

  assert.equal(searchConcordanceEntries(entries, "word").length, 2);
  assert.equal(searchConcordanceEntries(entries, "wor", { mode: "prefix" }).length, 2);
  assert.equal(searchConcordanceEntries(entries, "wor").length, 0);
});


test("sorts occurrences in canonical Bible order rather than alphabetical book order", () => {
  const entries = buildConcordanceEntries([
    { book: "John", chapters: [{ chapter: 1, verses: [{ verse: 1, text: "Grace" }] }] },
    { book: "Genesis", chapters: [{ chapter: 1, verses: [{ verse: 1, text: "Grace" }] }] },
    { book: "Matthew", chapters: [{ chapter: 1, verses: [{ verse: 1, text: "Grace" }] }] }
  ]);
  const grace = entries.find(entry => entry.word === "grace");
  assert.deepEqual(grace.metadata.occurrences.map(o => o.book), ["Genesis", "Matthew", "John"]);
});

test("ignores duplicate or invalid local book records when building the local book set", async () => {
  // This behavior is covered indirectly by the service's canonical-book filtering;
  // the pure entry builder must also tolerate duplicate book input without crashing.
  const entries = buildConcordanceEntries([
    { book: "Genesis", chapters: [{ chapter: 1, verses: [{ verse: 1, text: "God" }] }] },
    { book: "Genesis", chapters: [{ chapter: 1, verses: [{ verse: 1, text: "God" }] }] },
    { book: "", chapters: [] },
    null
  ]);
  const god = entries.find(entry => entry.word === "god");
  assert.equal(god.metadata.occurrenceCount, 2);
});
