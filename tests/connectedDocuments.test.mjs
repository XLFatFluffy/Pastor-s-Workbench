import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('connected document workflow is exposed to workspaces and AI', () => {
  const service = fs.readFileSync(new URL('../connectedKnowledgeService.js', import.meta.url), 'utf8');
  const work = fs.readFileSync(new URL('../views/workWorkspaceView.js', import.meta.url), 'utf8');
  const context = fs.readFileSync(new URL('../contextService.js', import.meta.url), 'utf8');
  const ai = fs.readFileSync(new URL('../aiService.js', import.meta.url), 'utf8');
  assert.match(service, /getConnectedDocuments/);
  assert.match(service, /linkDocumentToEntity/);
  assert.match(work, /mountConnectedDocuments/);
  assert.match(work, /data-attach-document/);
  assert.match(context, /CONNECTED FILES & DOCUMENTS/);
  assert.match(context, /getConnectedDocuments/);
  assert.match(ai, /document_link/);
});

test('connected document relationships use the generic relationship store', () => {
  const service = fs.readFileSync(new URL('../connectedKnowledgeService.js', import.meta.url), 'utf8');
  assert.match(service, /linkEntities\(entityType, entityId, 'Document'/);
  assert.match(service, /'source'/);
});
console.log('connectedDocuments.test.mjs: PASS — documents can attach to ministry work and flow into contextual AI');
