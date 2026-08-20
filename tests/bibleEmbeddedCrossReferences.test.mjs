import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const bible = await readFile(new URL("../views/bibleWorkspaceView.js", import.meta.url), "utf8");
const main = await readFile(new URL("../main.js", import.meta.url), "utf8");
const index = await readFile(new URL("../index.html", import.meta.url), "utf8");

assert.match(bible, /loadCrossReferencesForChapter/);
assert.match(bible, /getChapterCrossReferences/);
assert.match(bible, /crossref-select/);
assert.doesNotMatch(bible, /crossref-markers/);
assert.doesNotMatch(bible, /crossref-marker/);
assert.match(bible, /crossref-bubble/);
assert.match(bible, /crossReferenceLetter/);
assert.match(bible, /placeholder\.textContent = ordered\.length === 1/);
assert.match(bible, /select\.addEventListener\("change"/);
assert.doesNotMatch(main, /id:\s*["']crossrefs["']/);
assert.doesNotMatch(index, /data-route-id=["']crossrefs["']/);
console.log("Embedded Bible cross-reference UI contract: PASS");

assert.match(bible, /crossref-reader-dialog/);
assert.match(bible, /openCrossReferenceReader/);
assert.match(bible, /Open in Bible/);
console.log("Cross-reference chapter popup contract: PASS");
