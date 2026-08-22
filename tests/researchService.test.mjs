import assert from "node:assert/strict";
import test from "node:test";
import { normalizeKnowledgeOrigin, normalizeResearchItem, normalizeNote, validateKnowledgeBoundary, normalizeTopic, normalizeCollection } from "../researchService.js";

test("knowledge origin is explicit and limited", () => {
  assert.equal(normalizeKnowledgeOrigin("personal"), "personal");
  assert.equal(normalizeKnowledgeOrigin("SOURCE"), "source");
  assert.throws(() => normalizeKnowledgeOrigin("uncited"), /must be one of/);
});

test("source and AI knowledge require provenance", () => {
  assert.throws(() => validateKnowledgeBoundary({ origin: "source" }), /requires provenance/);
  assert.throws(() => validateKnowledgeBoundary({ origin: "ai" }), /requires provenance/);
  assert.equal(validateKnowledgeBoundary({ origin: "source", provenance: { provider: "Owen" } }).origin, "source");
  assert.equal(validateKnowledgeBoundary({ origin: "personal" }).provenance, null);
});

test("research normalization preserves type and provenance boundary", () => {
  const item = normalizeResearchItem({ title: "Regeneration", content: "Observation", research_type: "observation", origin: "personal" });
  assert.equal(item.research_type, "observation");
  assert.equal(item.origin, "personal");
  assert.equal(item.provenance, null);
  assert.throws(() => normalizeResearchItem({ title: "Quote", content: "Text", research_type: "quote", origin: "source" }), /requires provenance/);
});

test("note normalization rejects invalid note types", () => {
  const note = normalizeNote({ title: "Prayer", content: "Personal reflection", note_type: "reflection", origin: "personal" });
  assert.equal(note.note_type, "reflection");
  assert.throws(() => normalizeNote({ title: "Bad", content: "x", note_type: "invalid", origin: "personal" }), /Invalid note type/);
});

test("topics and collections are durable structured records", () => {
  assert.equal(normalizeTopic({ name: "Justification" }).name, "Justification");
  assert.equal(normalizeCollection({ name: "Romans 9" }).name, "Romans 9");
});
