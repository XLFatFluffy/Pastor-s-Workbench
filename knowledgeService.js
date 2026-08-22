// Knowledge store — semantic retrieval layer for the AI assistant.
// Sources (books/texts the user uploads) are chunked and embedded locally via
// Ollama's nomic-embed-text model. Retrieval is cosine-similarity over stored
// vectors, entirely local — nothing leaves the machine.
import { all, get, put, remove, bulk } from './store.js';
import { isDesktop, ollamaEmbed } from './desktopBridge.js';
import { chunkBookText, extractBookFile } from './libraryService.js';

const SOURCE_STORE = 'knowledge_sources';
const CHUNK_STORE = 'knowledge_chunks';
export const EMBED_MODEL = 'nomic-embed-text';

const clean = v => String(v ?? '').trim();
const uid = p => `${p}:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const now = () => new Date().toISOString();

function normalizeSource(input = {}) {
  const title = clean(input.title) || clean(input.filename) || 'Untitled source';
  const source = {
    id: clean(input.id) || uid('knowledge'), title, author: clean(input.author), description: clean(input.description),
    filename: clean(input.filename), mime_type: clean(input.mime_type) || 'text/plain', file_size: Number(input.file_size || 0),
    chunk_count: Number(input.chunk_count || 0), status: clean(input.status) || 'ready', error: clean(input.error),
    created_at: input.created_at || now(), updated_at: now()
  };
  if (!source.title) throw new TypeError('Knowledge source title is required.');
  return source;
}

async function embedTexts(texts) {
  if (!isDesktop()) throw new Error('The local knowledge store requires the Windows desktop app (it calls Ollama directly).');
  const result = await ollamaEmbed({ model: EMBED_MODEL, input: texts });
  const vectors = result?.embeddings;
  if (!Array.isArray(vectors) || vectors.length !== texts.length) throw new Error(`Ollama did not return embeddings. Make sure the model is pulled: ollama pull ${EMBED_MODEL}`);
  return vectors;
}

function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0; const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function addKnowledgeSource({ file = null, text = '', title = '', author = '', description = '' } = {}, onProgress) {
  let extractedText = '', filename = '', mimeType = 'text/plain', fileSize = 0;
  if (file) {
    const extracted = await extractBookFile(file, (page, totalPages) => onProgress?.({ stage: 'extract', page, totalPages }));
    extractedText = extracted.text; filename = file.name || ''; mimeType = file.type || 'application/octet-stream'; fileSize = file.size || 0;
  } else extractedText = clean(text);
  if (!extractedText) throw new Error('No readable text was found for this source.');
  const chunks = chunkBookText(extractedText);
  if (!chunks.length) throw new Error('No readable text was found for this source.');
  const source = normalizeSource({ title: title || filename.replace(/\.[^.]+$/, ''), author, description, filename, mime_type: mimeType, file_size: fileSize, chunk_count: chunks.length, status: 'embedding' });
  await put(SOURCE_STORE, source);
  try {
    const BATCH = 16, records = [];
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH); const vectors = await embedTexts(batch.map(c => c.content));
      batch.forEach((chunk, j) => records.push({ id: `${source.id}:chunk:${chunk.index}`, source_id: source.id, index: chunk.index, content: chunk.content, embedding: vectors[j], created_at: now() }));
      onProgress?.({ stage: 'embed', done: Math.min(i + BATCH, chunks.length), total: chunks.length });
    }
    await bulk(CHUNK_STORE, records); source.status = 'ready'; source.updated_at = now(); await put(SOURCE_STORE, source); return source;
  } catch (error) {
    source.status = 'error'; source.error = String(error?.message || error); source.updated_at = now(); await put(SOURCE_STORE, source); throw error;
  }
}

export async function listKnowledgeSources(search = '') {
  const needle = clean(search).toLowerCase();
  return (await all(SOURCE_STORE)).filter(s => !needle || [s.title, s.author, s.description, s.filename].join(' ').toLowerCase().includes(needle)).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
}
export async function getKnowledgeSource(id) { return get(SOURCE_STORE, id); }
export async function deleteKnowledgeSource(id) { const chunks = (await all(CHUNK_STORE)).filter(c => c.source_id === id); for (const chunk of chunks) await remove(CHUNK_STORE, chunk.id); await remove(SOURCE_STORE, id); }
export async function getKnowledgeStats() { const sources = await all(SOURCE_STORE); const chunks = await all(CHUNK_STORE); return { sources: sources.length, chunks: chunks.length, characters: chunks.reduce((n, c) => n + String(c.content || '').length, 0) }; }

export async function searchKnowledge(query, { limit = 6, sourceIds = [] } = {}) {
  const needle = clean(query); if (!needle) return [];
  const chunks = (await all(CHUNK_STORE)).filter(c => !sourceIds.length || sourceIds.includes(c.source_id)); if (!chunks.length) return [];
  const [queryVector] = await embedTexts([needle]); const sources = new Map((await all(SOURCE_STORE)).map(s => [s.id, s]));
  return chunks.map(c => ({ ...c, score: cosineSimilarity(queryVector, c.embedding || []) })).sort((a, b) => b.score - a.score).slice(0, limit).map(r => ({ ...r, source: sources.get(r.source_id) || null, citation: `${sources.get(r.source_id)?.title || 'Source'}${sources.get(r.source_id)?.author ? ` — ${sources.get(r.source_id).author}` : ''}, chunk ${r.index + 1}` }));
}
export async function buildKnowledgeContext(query, options = {}) { try { return await searchKnowledge(query, options); } catch { return []; } }
