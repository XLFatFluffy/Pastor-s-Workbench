import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkDocumentText, normalizeDocument } from '../documentService.js';

test('document normalization preserves provenance metadata',()=>{
  const d=normalizeDocument({title:'Church Constitution',filename:'constitution.pdf',mime_type:'application/pdf',source_entity_type:'Project',source_entity_id:'p1'});
  assert.equal(d.kind,'document'); assert.equal(d.title,'Church Constitution'); assert.equal(d.source,'user-upload'); assert.equal(d.source_entity_type,'Project');
});
test('document text is chunked with overlap',()=>{
  const text='A'.repeat(2200); const chunks=chunkDocumentText(text,{chunkSize:1000,overlap:100});
  assert.ok(chunks.length>=3); assert.ok(chunks[1].start<chunks[0].end);
});
