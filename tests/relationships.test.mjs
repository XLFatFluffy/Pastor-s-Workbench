import assert from "node:assert/strict";
import { link, everythingRelatedTo, reverseRelationships, normalizeRelationship } from "../relationships.js";

const a = link("Note", "n1", "Topic", "t1", "topic");
const b = link("ResearchItem", "r1", "Topic", "t1", "topic");
const all = [a, b];

assert.equal(everythingRelatedTo(all, "Topic", "t1").length, 2);
assert.equal(reverseRelationships(all, "Topic", "t1").length, 2);
assert.equal(everythingRelatedTo(all, "Note", "n1", { direction: "outgoing" })[0].id, a.id);
assert.throws(() => normalizeRelationship({
  id: "bad", source_type: "Note", source_id: "n1", target_type: "Topic", target_id: "t1", relationship_type: "invalid"
}), /Invalid relationship type/);

console.log("relationship tests passed");
