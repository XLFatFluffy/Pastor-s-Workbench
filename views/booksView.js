import { importBookFile, listBooks, searchBooks, deleteBook, getBookChunks, getBookStats } from "../libraryService.js";

const esc = v => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

export async function render(mount) {
  mount.innerHTML = `
    <section class="canvas__header"><p class="canvas__eyebrow">Library · Books</p><h1 class="canvas__title">Books</h1><p class="canvas__dek">Upload books once, search them instantly, copy passages when you need them, and give the same material to the AI as retrieval context.</p></section>
    <section class="study-grid">
      <article class="reader-panel"><div class="reader-panel__head"><div><p class="canvas__eyebrow">Add to library</p><h2>Upload a book</h2></div></div>
        <form id="book-upload" class="tool-form"><label>Book file<input id="book-file" type="file" accept=".pdf,.txt,.md,.markdown,.html,.htm,.json,application/pdf,text/plain,text/markdown,text/html" required></label><label>Title<input name="title" placeholder="Leave blank to use filename"></label><label>Author<input name="author" placeholder="Author (optional)"></label><button class="button button--primary" type="submit">Upload & index book</button></form><div id="upload-status" class="import-status" aria-live="polite"></div>
        <p class="muted" style="margin-top:1rem">PDF text is extracted in the browser. The Workbench stores searchable text and metadata locally; it does not train a model on the book.</p>
      </article>
      <article class="reader-panel"><div class="reader-panel__head"><div><p class="canvas__eyebrow">AI context</p><h2>How this works</h2></div></div><p>Books become a private retrieval library. When AI features are connected, the Workbench can search the relevant passages and send only those passages as context, with the book title attached for provenance.</p><div id="book-stats" class="foundation-strip"></div></article>
    </section>
    <section class="reader-panel" style="margin-top:1rem"><div class="reader-panel__head"><div><p class="canvas__eyebrow">Reading room</p><h2>Search books</h2></div></div><form id="book-search" class="inline-form"><input name="query" placeholder="Search the books you uploaded…" aria-label="Search books"><button class="button" type="submit">Search</button><button class="button" id="copy-ai-context" type="button">Copy AI context</button></form><div id="book-results" style="margin-top:1rem"></div></section>
    <section class="reader-panel" style="margin-top:1rem"><div class="reader-panel__head"><div><p class="canvas__eyebrow">Library</p><h2>My books</h2></div></div><div id="book-list"></div></section>`;

  const refresh = async () => {
    const books = await listBooks();
    mount.querySelector("#book-list").innerHTML = books.length ? books.map(b => `<article class="knowledge-card"><div class="knowledge-card__head"><div><h3>${esc(b.title)}</h3><div class="pill-list">${b.author ? `<span class="pill">${esc(b.author)}</span>` : ""}<span class="pill">${esc(b.chunk_count)} searchable sections</span>${b.page_count ? `<span class="pill">${esc(b.page_count)} pages</span>` : ""}</div></div><button class="text-button text-button--danger" data-delete-book="${esc(b.id)}">Remove</button></div><p>${esc(b.filename)}</p></article>`).join("") : `<div class="empty-state">No books uploaded yet.</div>`;
    mount.querySelectorAll("[data-delete-book]").forEach(btn => btn.onclick = async () => { if (!confirm("Remove this book and its searchable text?")) return; await deleteBook(btn.dataset.deleteBook); await refresh(); });
    const stats = await getBookStats(); mount.querySelector("#book-stats").innerHTML = `<div><span class="foundation-strip__label">Indexed library</span><strong>${stats.books} book${stats.books === 1 ? "" : "s"}</strong><span class="foundation-strip__ok">${stats.chunks.toLocaleString()} searchable sections</span></div>`;
  };

  mount.querySelector("#book-upload").onsubmit = async e => { e.preventDefault(); const file = mount.querySelector("#book-file").files?.[0]; const status = mount.querySelector("#upload-status"); if (!file) return; const d = new FormData(e.currentTarget); const button = e.currentTarget.querySelector("button"); button.disabled = true; status.textContent = file.type === "application/pdf" ? "Reading PDF pages…" : "Reading and indexing book…"; try { const book = await importBookFile(file, { title: d.get("title"), author: d.get("author") }, (page,total) => { status.textContent = `Reading PDF page ${page} of ${total}…`; }); status.textContent = `Added “${book.title}” with ${book.chunk_count.toLocaleString()} searchable sections.`; e.currentTarget.reset(); await refresh(); } catch (err) { status.textContent = `Upload failed: ${err.message || err}`; } finally { button.disabled = false; } };
  mount.querySelector("#copy-ai-context").onclick = async () => {
    const q = String(new FormData(mount.querySelector("#book-search")).get("query") || "").trim();
    const status = mount.querySelector("#book-results");
    if (!q) { status.innerHTML = '<div class="empty-state">Enter a topic or question first.</div>'; return; }
    const { buildBookContext } = await import("../libraryService.js");
    const context = await buildBookContext(q, { limit: 8 });
    if (!context.length) { status.innerHTML = '<div class="empty-state">No book passages matched that question.</div>'; return; }
    const text = context.map((r, i) => `[Book ${i + 1}] ${r.citation}\n${r.content}`).join("\n\n");
    await navigator.clipboard.writeText(`Use the following book passages as source context. Preserve the source labels when citing them.\n\n${text}`);
    const button = mount.querySelector("#copy-ai-context"); button.textContent = "AI context copied"; setTimeout(() => button.textContent = "Copy AI context", 1400);
  };

  mount.querySelector("#book-search").onsubmit = async e => { e.preventDefault(); const q = new FormData(e.currentTarget).get("query"); const results = await searchBooks(q, { limit: 15 }); const books = new Map((await listBooks()).map(b => [b.id,b])); mount.querySelector("#book-results").innerHTML = results.length ? results.map(r => `<article class="knowledge-card"><div class="knowledge-card__head"><div><h3>${esc(books.get(r.book_id)?.title || "Book")}</h3><span class="pill">Section ${r.index + 1}</span></div><button class="text-button" data-copy-book="${esc(r.id)}">Copy passage</button></div><p class="rich-preview">${esc(r.content)}</p></article>`).join("") : `<div class="empty-state">No matching passages.</div>`; mount.querySelectorAll("[data-copy-book]").forEach(btn => btn.onclick = async () => { const row = results.find(x => x.id === btn.dataset.copyBook); if (!row) return; await navigator.clipboard.writeText(row.content); btn.textContent = "Copied"; setTimeout(() => btn.textContent = "Copy passage", 1200); }); };
  await refresh();
}
