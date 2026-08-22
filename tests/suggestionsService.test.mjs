import assert from "node:assert/strict";
import { findReferencesInText } from "../suggestionsService.js";

const refs = findReferencesInText("As we see in Romans 8:1, and again in romans 8:1 later, then John 3:16-18.");
assert.equal(refs.length, 2, "should dedupe repeated references and find distinct ones");
assert.ok(refs.some(r => r.book === "Romans" && r.chapter === 8 && r.start === 1 && r.end === 1));
assert.ok(refs.some(r => r.book === "John" && r.chapter === 3 && r.start === 16 && r.end === 18));

assert.deepEqual(findReferencesInText(""), []);
assert.deepEqual(findReferencesInText("No references in this sentence."), []);

console.log("suggestionsService tests passed");
