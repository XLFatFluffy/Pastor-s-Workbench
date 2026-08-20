import assert from "node:assert/strict";
import { ENTITY_TYPES, createRecord, getSchema, validateRecord } from "../dataModel.js";

assert.equal(ENTITY_TYPES.length, 32);
assert.ok(getSchema("Project").includes("project_type"));
assert.ok(getSchema("Sermon").includes("manuscript"));

assert.deepEqual(createRecord("Project", {
  id: "p1", workspace_id: "w1", user_id: "u1", project_type: "study", title: "Romans Study",
  description: "", status: "draft", created_at: "2026-08-19", updated_at: "2026-08-19"
}).project_type, "study");

assert.throws(() => validateRecord("Project", { id: "p1" }), /workspace_id is required/);
assert.throws(() => validateRecord("Project", {
  id: "p1", workspace_id: "w1", user_id: "u1", project_type: "invalid", title: "x",
  description: "", status: "draft", created_at: "x", updated_at: "x", archived_at: null
}), /Project.project_type is invalid/);

const sourceResearch = {
  id: "r1", workspace_id: "w1", user_id: "u1", project_id: "p1", research_type: "observation",
  title: "Observation", content: "Text", status: "draft", created_at: "x", updated_at: "x", origin: "source"
};
assert.throws(() => validateRecord("ResearchItem", sourceResearch), /requires provenance/);
assert.throws(() => validateRecord("BibleVerse", {
  id: "v1", canonical_verse_id: "rom-8-1", book_id: "rom", chapter: 8, verse: 1,
  translation_id: "kjv", text: "Text"
}), /searchable_text is required/);
assert.throws(() => validateRecord("CrossReference", {
  id: "x", source_verse_id: "a", target_verse_id: "b", relationship_type: "invalid",
  source: "test", notes: "", provenance: {}, confidence: 1
}), /relationship_type is invalid/);
assert.equal(validateRecord("ConfessionParagraph", {
  id: "cp1", chapter_id: "c1", paragraph_number: 1, text: "Text", is_seeded: false
}).is_seeded, false);

console.log("dataModel tests passed");
