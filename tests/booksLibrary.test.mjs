import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkBookText, normalizeBook } from '../libraryService.js';

test('book normalization creates a stable library record', () => {
  const book = normalizeBook({ title: 'Knowing God', author: 'J.I. Packer', filename: 'knowing-god.pdf' });
  assert.equal(book.kind, 'book');
  assert.equal(book.author, 'J.I. Packer');
  assert.equal(book.source, 'user-upload');
});

test('book text is chunked with overlap-friendly searchable sections', () => {
  const text = Array.from({ length: 80 }, (_, i) => `Paragraph ${i}: theological study material.`).join('\n\n');
  const chunks = chunkBookText(text, { chunkSize: 300, overlap: 40 });
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every(c => c.content.length > 0));
  assert.equal(chunks[0].index, 0);
});
