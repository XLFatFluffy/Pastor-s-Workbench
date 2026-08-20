// Phase 8 — Books / Reading Library.
// Books are stored as searchable text chunks in IndexedDB. This is retrieval
// context for the AI; it does not retrain or permanently modify a model.
import { all, get, put, remove, bulk } from "./store.js";

const BOOK_STORE = "library_items";
const CHUNK_STORE = "book_chunks";
const CHUNK_SIZE = 1800;
const CHUNK_OVERLAP = 250;

const clean = v => String(v ?? "").trim();
const uid = p => `${p}:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const now = () => new Date().toISOString();

export function normalizeBook(input = {}) {
  const title = clean(input.title) || clean(input.name) || clean(input.filename) || "Untitled book";
  const book = {
    id: clean(input.id) || uid("book"),
    kind: "book",
    title,
    author: clean(input.author),
    description: clean(input.description),
    filename: clean(input.filename),
    mime_type: clean(input.mime_type) || "text/plain",
    file_size: Number(input.file_size || 0),
    page_count: Number(input.page_count || 0),
    chunk_count: Number(input.chunk_count || 0),
    status: clean(input.status) || "ready",
    source: "user-upload",
    created_at: input.created_at || now(),
    updated_at: now()
  };
  if (!book.title) throw new TypeError("Book.title is required.");
  return book;
}

function stripHtml(text) {
  const doc = typeof DOMParser !== "undefined" ? new DOMParser().parseFromString(text, "text/html") : null;
  if (doc) return doc.body?.innerText || doc.body?.textContent || "";
  return text.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
}

function normalizeText(text) {
  return String(text || "").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function chunkBookText(text, { chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP } = {}) {
  const source = normalizeText(text);
  if (!source) return [];
  const chunks = [];
  let start = 0;
  let index = 0;
  while (start < source.length) {
    let end = Math.min(source.length, start + chunkSize);
    if (end < source.length) {
      const boundary = Math.max(source.lastIndexOf("\n\n", end), source.lastIndexOf(". ", end));
      if (boundary > start + Math.floor(chunkSize * 0.55)) end = boundary + (source[boundary] === "." ? 1 : 0);
    }
    const content = source.slice(start, end).trim();
    if (content) chunks.push({ index: index++, content, start, end });
    if (end >= source.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

async function loadPdfJs() {
  if (globalThis.__pwPdfJs) return globalThis.__pwPdfJs;
  if (typeof window === "undefined") throw new Error("PDF reading requires the Workbench web app.");
  try {
    const pdfjs = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs";
    globalThis.__pwPdfJs = pdfjs;
    return pdfjs;
  } catch (error) {
    throw new Error("Could not load the PDF reader. Check the internet connection and try again.");
  }
}

async function extractPdf(file, onProgress) {
  const pdfjs = await loadPdfJs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pages = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const text = content.items.map(item => item.str || "").join(" ");
    pages.push(`\n\n[Page ${pageNo}]\n${text}`);
    onProgress?.(pageNo, pdf.numPages);
  }
  return { text: pages.join(""), pageCount: pdf.numPages };
}

export async function extractBookFile(file, onProgress) {
  const name = file?.name || "";
  const type = file?.type || "";
  if (!file) throw new TypeError("Choose a book file first.");
  if (type === "application/pdf" || /\.pdf$/i.test(name)) return extractPdf(file, onProgress);
  const raw = await file.text();
  if (type.includes("html") || /\.(html?|xhtml)$/i.test(name)) return { text: stripHtml(raw), pageCount: 0 };
  if (type.includes("json") || /\.json$/i.test(name)) {
    try { return { text: JSON.stringify(JSON.parse(raw), null, 2), pageCount: 0 }; } catch { return { text: raw, pageCount: 0 }; }
  }
  if (/\.(txt|md|markdown)$/i.test(name) || type.startsWith("text/")) return { text: raw, pageCount: 0 };
  throw new Error("Supported book formats: PDF, TXT, Markdown, HTML, and JSON text files.");
}

export async function saveBook(input, chunks = []) {
  const book = normalizeBook({ ...input, chunk_count: chunks.length });
  await put(BOOK_STORE, book);
  if (chunks.length) {
    const records = chunks.map((chunk, i) => ({ id: `${book.id}:chunk:${i}`, book_id: book.id, index: i, page: chunk.page || null, content: chunk.content, created_at: now() }));
    await bulk(CHUNK_STORE, records);
  }
  return book;
}

export async function importBookFile(file, metadata = {}, onProgress) {
  const extracted = await extractBookFile(file, onProgress);
  const chunks = chunkBookText(extracted.text);
  if (!chunks.length) throw new Error("No readable text was found in this book.");
  return saveBook({ ...metadata, title: metadata.title || file.name.replace(/\.[^.]+$/, ""), filename: file.name, mime_type: file.type || "application/octet-stream", file_size: file.size || 0, page_count: extracted.pageCount }, chunks);
}

export async function listBooks(search = "") {
  const needle = clean(search).toLowerCase();
  return (await all(BOOK_STORE)).filter(b => !needle || [b.title, b.author, b.description, b.filename].join(" ").toLowerCase().includes(needle)).sort((a,b) => String(b.updated_at).localeCompare(String(a.updated_at)));
}

export async function getBook(id) { return get(BOOK_STORE, id); }
export async function getBookChunks(bookId) { return (await all(CHUNK_STORE)).filter(c => c.book_id === bookId).sort((a,b) => a.index - b.index); }

function scoreChunk(content, terms) {
  const hay = content.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (!term) continue;
    let at = hay.indexOf(term);
    while (at >= 0) { score += term.length > 5 ? 3 : 1; at = hay.indexOf(term, at + term.length); }
  }
  return score;
}

export async function searchBooks(query, { limit = 12, bookId = null } = {}) {
  const terms = clean(query).toLowerCase().split(/\s+/).filter(t => t.length > 1).slice(0, 12);
  if (!terms.length) return [];
  const chunks = await all(CHUNK_STORE);
  return chunks.filter(c => !bookId || c.book_id === bookId).map(c => ({ ...c, score: scoreChunk(c.content, terms) })).filter(c => c.score > 0).sort((a,b) => b.score - a.score || a.index - b.index).slice(0, limit);
}

export async function buildBookContext(query, { limit = 6, bookIds = [] } = {}) {
  const results = await searchBooks(query, { limit: Math.max(limit * 2, limit), bookId: bookIds.length === 1 ? bookIds[0] : null });
  const filtered = bookIds.length > 1 ? results.filter(r => bookIds.includes(r.book_id)).slice(0, limit) : results.slice(0, limit);
  const books = new Map((await listBooks()).map(b => [b.id, b]));
  return filtered.map(r => ({ ...r, book: books.get(r.book_id) || null, citation: `${books.get(r.book_id)?.title || "Book"}${books.get(r.book_id)?.author ? ` — ${books.get(r.book_id).author}` : ""}, chunk ${r.index + 1}` }));
}

export async function deleteBook(id) {
  for (const chunk of await getBookChunks(id)) await remove(CHUNK_STORE, chunk.id);
  await remove(BOOK_STORE, id);
}

export async function getBookStats() {
  const books = await all(BOOK_STORE); const chunks = await all(CHUNK_STORE);
  return { books: books.length, chunks: chunks.length, characters: chunks.reduce((n,c) => n + String(c.content || "").length, 0) };
}
