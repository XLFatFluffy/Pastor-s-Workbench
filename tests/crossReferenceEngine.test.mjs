import assert from "node:assert/strict";
import { CROSS_REFERENCE_TYPES, normalizeCrossReference } from "../crossReferenceService.js";

assert.equal(CROSS_REFERENCE_TYPES.length, 8);
const record = normalizeCrossReference({source_verse_id:"GEN.1.1",target_verse_id:"JOH.1.1",relationship_type:"thematic",source:"test",provenance:{provider:"test"},confidence:0.8});
assert.equal(record.source_verse_id,"GEN.1.1");
assert.equal(record.relationship_type,"thematic");
assert.equal(record.confidence,0.8);
assert.throws(()=>normalizeCrossReference({source_verse_id:"",target_verse_id:"JOH.1.1",relationship_type:"other",provenance:{},confidence:0.5}));
console.log("Cross-reference engine contract: PASS");
