// Optional structural check for a bundled local KJV seed file.
// This verifies structural integrity only. It deliberately does not claim textual accuracy.
//
// NOTE (v0.5.10 audit): Phase 2 deliberately moved to on-demand, non-bundled
// translation loading (see PHASE-2-NOTES.txt) — the app does not ship
// data/bible/kjv.json and is not expected to. This file used to throw when
// the seed was absent, which `node --test tests/*.mjs` treated as a failing
// test on every run. It now skips cleanly instead, so the suite reflects the
// real Phase 2 architecture. If a bundled local KJV seed is reintroduced in
// a future phase, this test will automatically start verifying it again.
import fs from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";

const path = new URL("../data/bible/kjv.json", import.meta.url);

test("bundled KJV seed structural check (skips if not present)", (t) => {
  if (!fs.existsSync(path)) {
    t.skip("No data/bible/kjv.json bundled — expected under the current on-demand translation model (PHASE-2-NOTES.txt).");
    return;
  }
  const data = JSON.parse(fs.readFileSync(path, "utf8"));
  assert.equal(data.books.length, 66, "KJV must contain 66 canonical books.");
  const verses = data.books.flatMap((b) => b.chapters.flatMap((c) => c.verses));
  assert.equal(verses.length, 31102, "KJV must contain 31,102 verses.");
  for (const book of data.books) for (const chapter of book.chapters) for (const verse of chapter.verses) {
    assert.equal(typeof verse.text, "string");
    assert.ok(verse.text.trim());
  }
  console.log(`Structural KJV check passed: ${data.books.length} books, ${verses.length} verses.`);
});
