import assert from "node:assert/strict";
import fs from "node:fs";

const bible = fs.readFileSync(new URL("../views/bibleWorkspaceView.js", import.meta.url), "utf8");
const confession = fs.readFileSync(new URL("../views/confessionWorkspaceView.js", import.meta.url), "utf8");

assert.match(bible, /getConfessionReferencesForScripture/);
assert.match(bible, /canonicalChapterId/);
assert.match(bible, /pw:confession:pendingNavigation/);
assert.match(bible, /bible-confession-links/);
assert.match(confession, /pw:confession:pendingNavigation/);
assert.match(confession, /initialParagraph/);
console.log("bibleConfessionReverseNavigation.test.mjs: PASS");
