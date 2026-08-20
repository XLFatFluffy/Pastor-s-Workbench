import {
  getChapter,
  search,
  getBibleVersions,
  getAvailableBibleVersions,
  getBookList,
  canonicalVerseId,
  getPassage,
  canonicalChapterId
} from "../bibleService.js";
import { get, put, all, remove } from "../store.js";
import { getConfessionReferencesForScripture } from "../confessionService.js";
import { loadCrossReferencesForChapter, getChapterCrossReferences } from "../crossReferenceService.js";

const DEFAULT_BOOK = "John";
const DEFAULT_CHAPTER = 3;
const DEFAULT_VERSE = 16;
const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "red", "purple"];

export async function render(mount) {
  const versions = await getAvailableBibleVersions();
  const books = getBookList();
  let pendingNavigation = null;
  try {
    const raw = sessionStorage.getItem("pw:bible:pendingNavigation");
    if (raw) { pendingNavigation = JSON.parse(raw); sessionStorage.removeItem("pw:bible:pendingNavigation"); }
  } catch { pendingNavigation = null; }
  const state = {
    translation: localStorage.getItem("pw:bible:translation") || "KJV",
    book: pendingNavigation?.book || localStorage.getItem("pw:bible:book") || DEFAULT_BOOK,
    chapter: Number(pendingNavigation?.chapter) || Number(localStorage.getItem("pw:bible:chapter")) || DEFAULT_CHAPTER,
    selectedStart: Number(pendingNavigation?.verse) || Number(localStorage.getItem("pw:bible:verse")) || DEFAULT_VERSE,
    selectedEnd: Number(pendingNavigation?.endVerse) || Number(pendingNavigation?.verse) || Number(localStorage.getItem("pw:bible:verse")) || DEFAULT_VERSE,
    chapterData: null,
    selectedVerses: [],
    fontSize: Number(localStorage.getItem("pw:bible:fontSize")) || 22,
    lineHeight: Number(localStorage.getItem("pw:bible:lineHeight")) || 1.75,
    textWidth: localStorage.getItem("pw:bible:textWidth") || "medium",
    openNoteId: null
  };
  if (pendingNavigation?.type === "BibleChapter") { state.selectedStart = 1; state.selectedEnd = 1; }

  mount.innerHTML = `
    <section class="canvas__header">
      <p class="canvas__eyebrow">Study · Bible Engine</p>
      <h1 class="canvas__title">Bible</h1>
      <p class="canvas__dek">Read the whole chapter, select Scripture, highlight it, and attach personal notes directly to the text.</p>
    </section>

    <section class="bible-workspace">
      <article class="panel panel--wide bible-reader-panel">
        <div class="bible-controls">
          <span id="bible-status" class="status-badge">Ready</span>
          <label>Translation<select id="bible-translation">${versions.map(v => `<option value="${v.id}" ${v.id === state.translation ? "selected" : ""}>${escapeHtml(v.name)} (${escapeHtml(v.abbreviation)})</option>`).join("")}</select></label>
          <label>Book<select id="bible-book">${books.map(b => `<option value="${escapeHtml(b.name)}" ${b.name === state.book ? "selected" : ""}>${escapeHtml(b.name)}</option>`).join("")}</select></label>
          <label>Chapter<select id="bible-chapter"></select></label>
          <label>Verse<select id="bible-verse"></select></label>
          <button id="bible-load" class="button button--primary bible-open-button" type="button">Open Chapter</button>
          <button id="bible-settings" class="icon-button" type="button" title="Reading settings" aria-label="Reading settings">Aa</button>
        </div>
        <div class="bible-shortcuts"><span><kbd>Click</kbd> verse to select</span><span><kbd>Shift</kbd> + click for a passage</span><span><kbd>Esc</kbd> clears selection</span></div>
        <div id="bible-reading" class="reading-panel reading-panel--full"></div>
      </article>

      <aside class="bible-context" id="bible-context">
        <div class="panel">
          <div class="panel__header"><div><h2>Study Tools</h2><p>Tools follow the selected Scripture.</p></div></div>
          <div id="bible-selection-summary" class="selection-summary">Select a verse to begin.</div>
          <div class="context-actions">
            <button class="tool-button" data-action="highlight">Highlight</button>
            <button class="tool-button" data-action="note">Note</button>
            <button class="tool-button" data-action="bookmark">Bookmark</button>
            <button class="tool-button" data-action="copy">Copy</button>
            <button class="tool-button" data-action="share">Share</button>
            <button class="tool-button" data-action="compare">Compare</button>
          </div>
          <div id="highlight-palette" class="highlight-palette" hidden>
            ${HIGHLIGHT_COLORS.map(color => `<button class="highlight-swatch highlight-swatch--${color}" data-color="${color}" title="Highlight ${color}" aria-label="Highlight ${color}"></button>`).join("")}
            <button class="highlight-remove" data-color="remove">Remove</button>
          </div>
          <div id="bible-note-editor" class="note-editor" hidden>
            <div class="note-editor__heading" id="note-editor-heading">New note</div>
            <textarea id="bible-note-text" placeholder="Write your note about this Scripture…"></textarea>
            <div class="note-editor__actions"><button class="button button--primary" id="save-bible-note">Save Note</button><button class="button" id="cancel-bible-note">Cancel</button></div>
          </div>
          <div id="bible-note-list" class="bible-note-list"></div>
          <div id="bible-confession-links" class="bible-confession-links"></div>
        </div>

        <div class="panel">
          <div class="panel__header"><div><h2>My Study</h2><p>Highlights and bookmarks in this chapter.</p></div></div>
          <div id="bible-study-summary" class="study-summary"></div>
          <div id="bible-annotations-list" class="annotation-list"></div>
        </div>

        <div class="panel">
          <div class="panel__header"><div><h2>Recently Studied</h2><p>Your local Bible history.</p></div></div>
          <div id="bible-history" class="history-list"></div>
        </div>
      </aside>

      <article class="panel">
        <div class="panel__header"><div><h2>Search Bible</h2><p>Search the selected translation.</p></div></div>
        <form id="bible-search-form" class="search-row"><input id="bible-search" placeholder="Search a word or phrase…"><button class="button" type="submit">Search</button></form>
        <div id="bible-results" class="result-list"></div>
      </article>


    </section>

    <dialog id="reading-settings-dialog" class="settings-dialog">
      <form method="dialog" id="reading-settings-form">
        <div class="panel__header"><div><h2>Reading Settings</h2><p>Customize the Bible reading area.</p></div><button class="icon-button" value="cancel">×</button></div>
        <label>Font size<input id="reader-font-size" type="range" min="17" max="32" value="${state.fontSize}"></label>
        <label>Line spacing<input id="reader-line-height" type="range" min="1.4" max="2.2" step="0.05" value="${state.lineHeight}"></label>
        <label>Text width<select id="reader-text-width"><option value="narrow">Narrow</option><option value="medium">Medium</option><option value="wide">Wide</option></select></label>
        <label class="settings-check"><input id="reader-verse-numbers" type="checkbox" checked> Show verse numbers</label>
        <div class="note-editor__actions"><button class="button button--primary" value="default">Done</button></div>
      </form>
    </dialog>

    <dialog id="compare-dialog" class="settings-dialog settings-dialog--wide">
      <form method="dialog">
        <div class="panel__header"><div><h2>Translation Comparison</h2><p id="compare-reference"></p></div><button class="icon-button" value="cancel">×</button></div>
        <div id="compare-content" class="compare-grid"></div>
      </form>
    </dialog>

    <dialog id="crossref-reader-dialog" class="crossref-reader-dialog">
      <div class="crossref-reader-dialog__shell">
        <header class="crossref-reader-dialog__header">
          <div>
            <p class="canvas__eyebrow">Cross-Reference</p>
            <h2 id="crossref-reader-title">Referenced Passage</h2>
            <p id="crossref-reader-meta" class="crossref-reader-dialog__meta"></p>
          </div>
          <button id="crossref-reader-close" class="icon-button" type="button" aria-label="Close cross-reference window">×</button>
        </header>
        <div class="crossref-reader-dialog__toolbar">
          <button id="crossref-reader-prev" class="button" type="button">← Previous</button>
          <button id="crossref-reader-open" class="button button--primary" type="button">Open in Bible</button>
          <button id="crossref-reader-next" class="button" type="button">Next →</button>
        </div>
        <div id="crossref-reader-content" class="crossref-reader-dialog__content"></div>
      </div>
    </dialog>`;

  const $ = id => document.getElementById(id);
  const reading = $("bible-reading");
  const results = $("bible-results");
  const crossrefPopup = { book: null, chapter: null, verse: null, endVerse: null };

  function saveLocation() {
    localStorage.setItem("pw:bible:translation", state.translation);
    localStorage.setItem("pw:bible:book", state.book);
    localStorage.setItem("pw:bible:chapter", String(state.chapter));
    localStorage.setItem("pw:bible:verse", String(state.selectedStart || 1));
  }

  function populateChapters() {
    const book = books.find(b => b.name === state.book) || books[0];
    const count = getChapterCount(book.name);
    $("bible-chapter").innerHTML = Array.from({ length: count }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
    state.chapter = Math.min(Math.max(1, state.chapter), count);
    $("bible-chapter").value = String(state.chapter);
  }

  function populateVerses() {
    const count = state.chapterData?.verses?.length || 0;
    $("bible-verse").innerHTML = count ? Array.from({ length: count }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("") : `<option value="">—</option>`;
    if (count) $("bible-verse").value = String(Math.min(state.selectedStart || 1, count));
  }

  function selectedPassage() {
    if (!state.chapterData || !state.selectedVerses.length) return [];
    const ids = new Set(state.selectedVerses);
    return state.chapterData.verses.filter(v => ids.has(v.verse));
  }

  function currentReference(passage = selectedPassage()) {
    if (!passage.length) return `${state.book} ${state.chapter}`;
    return `${state.book} ${state.chapter}:${passage[0].verse}${passage.length > 1 ? `–${passage.at(-1).verse}` : ""}`;
  }

  async function getChapterNotes() {
    const notes = await all("notes");
    const byVerse = new Map();
    for (const note of notes) {
      const scriptures = Array.isArray(note.scripture) ? note.scripture : [];
      for (const scripture of scriptures) {
        if (scripture.book !== state.book || Number(scripture.chapter) !== Number(state.chapter)) continue;
        const verse = Number(scripture.verse);
        if (!byVerse.has(verse)) byVerse.set(verse, []);
        byVerse.get(verse).push(note);
      }
    }
    return byVerse;
  }

  async function getChapterAnnotations() {
    const annotations = await all("bible_annotations");
    return annotations.filter(a => a.book === state.book && Number(a.chapter) === Number(state.chapter) && a.translationId === state.translation);
  }

  async function renderChapter() {
    if (!state.chapterData) return;
    const selected = new Set(state.selectedVerses);
    const notesByVerse = await getChapterNotes();
    const noteNumbers = new Map();
    let noteCounter = 0;
    for (const notes of notesByVerse.values()) for (const note of notes) if (!noteNumbers.has(note.id)) noteNumbers.set(note.id, ++noteCounter);

    reading.innerHTML = `
      <div class="scripture-reader-shell">
        <aside class="highlight-sidebar" aria-label="Highlight tools">
          <div class="highlight-sidebar__title">Highlight</div>
          <div class="highlight-sidebar__hint">Select a verse, then choose a color.</div>
          <div class="highlight-sidebar__colors">${HIGHLIGHT_COLORS.map(color => `<button class="highlight-swatch highlight-swatch--${color}" data-color="${color}" title="Highlight ${color}" aria-label="Highlight ${color}"></button>`).join("")}</div>
          <button class="highlight-sidebar__remove" data-color="remove" title="Remove highlight">Clear</button>
        </aside>
        <div class="scripture-reader ${state.textWidth === "narrow" ? "scripture-reader--narrow" : state.textWidth === "wide" ? "scripture-reader--wide" : ""}" style="--reader-font-size:${state.fontSize}px;--reader-line-height:${state.lineHeight}">
          <header class="scripture-reader__header">
            <div><div class="scripture-reader__eyebrow">${escapeHtml(state.translation)}</div><h2>${escapeHtml(state.book)} ${state.chapter}</h2><p>Click a verse to select it. Shift-click to select a passage. Note markers stay attached to the text.</p></div>
            <div class="scripture-reader__nav"><button class="button" id="prev-chapter" ${state.chapter <= 1 ? "disabled" : ""}>← Previous</button><button class="button" id="next-chapter">Next →</button></div>
          </header>
          <div class="scripture-text" role="document">
            ${state.chapterData.verses.map(v => {
              const notes = notesByVerse.get(v.verse) || [];
              const markers = notes.map(note => `<button class="note-marker" data-note-id="${escapeHtml(note.id)}" title="Open note ${noteNumbers.get(note.id)}" aria-label="Open note ${noteNumbers.get(note.id)}">${noteNumbers.get(note.id)}</button>`).join("");
              return `<div class="verse-wrap"><div class="verse-row ${selected.has(v.verse) ? "verse-row--selected" : ""}" role="button" tabindex="0" data-verse="${v.verse}" data-canonical="${escapeHtml(v.canonicalVerseId)}"><span class="verse-number">${v.verse}</span><span class="verse-text">${escapeHtml(v.text)}</span>${markers}</div><div class="note-bubble-layer" data-bubble-for="${v.verse}"></div><div class="crossref-bubble-layer" data-crossref-bubble-for="${v.verse}"></div></div>`;
            }).join("")}
          </div>
        </div>
      </div>`;

    reading.querySelectorAll(".verse-row").forEach(row => {
      row.addEventListener("click", event => selectVerse(Number(row.dataset.verse), event.shiftKey, true));
      row.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectVerse(Number(row.dataset.verse), event.shiftKey, true); } });
    });
    reading.querySelectorAll(".note-marker").forEach(button => button.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); toggleNoteBubble(button.dataset.noteId, button); }));
    reading.querySelectorAll(".highlight-swatch, .highlight-sidebar__remove").forEach(button => button.addEventListener("click", () => saveHighlight(button.dataset.color)));
    $("prev-chapter")?.addEventListener("click", () => { state.chapter -= 1; state.selectedStart = 1; state.selectedEnd = 1; loadChapter(); });
    $("next-chapter")?.addEventListener("click", () => { state.chapter += 1; state.selectedStart = 1; state.selectedEnd = 1; loadChapter(); });
    await applyHighlightClasses();
    await renderCrossReferenceMarkers();
  }

  async function toggleNoteBubble(noteId, marker) {
    const existing = reading.querySelector(`.note-bubble[data-note-id="${CSS.escape(noteId)}"]`);
    reading.querySelectorAll(".note-bubble").forEach(bubble => bubble.remove());
    state.openNoteId = existing ? null : noteId;
    if (existing) return;
    const note = await get("notes", noteId);
    if (!note) return;
    const bubble = document.createElement("div");
    bubble.className = "note-bubble";
    bubble.dataset.noteId = noteId;
    bubble.innerHTML = `<div class="note-bubble__title">${escapeHtml(note.title || "Note")}</div><div class="note-bubble__content">${escapeHtml(note.content || "")}</div><div class="note-bubble__actions"><button type="button" class="text-button" data-note-edit="${escapeHtml(note.id)}">Edit</button><button type="button" class="text-button text-button--danger" data-note-delete="${escapeHtml(note.id)}">Delete</button></div><button class="note-bubble__close" type="button" aria-label="Close note">×</button>`;
    marker.closest(".verse-wrap")?.querySelector(".note-bubble-layer")?.appendChild(bubble);
    bubble.querySelector(".note-bubble__close").addEventListener("click", () => { bubble.remove(); state.openNoteId = null; });
    bubble.querySelector("[data-note-edit]").addEventListener("click", () => beginEditNote(note));
    bubble.querySelector("[data-note-delete]").addEventListener("click", () => deleteNote(note.id));
  }

  async function applyHighlightClasses() {
    const annotations = await getChapterAnnotations();
    const byVerse = new Map(annotations.filter(a => a.type === "highlight").map(a => [a.canonicalVerseId, a.color]));
    reading.querySelectorAll(".verse-row").forEach(row => {
      HIGHLIGHT_COLORS.forEach(color => row.classList.remove(`verse-row--${color}`));
      const color = byVerse.get(row.dataset.canonical);
      if (color) row.classList.add(`verse-row--${color}`);
    });
    await renderStudySummary(annotations);
  }

  function selectVerse(verse, range = false, scroll = false) {
    if (!state.chapterData) return;
    if (range) {
      const start = Math.min(state.selectedStart || verse, verse);
      const end = Math.max(state.selectedStart || verse, verse);
      state.selectedStart = start;
      state.selectedEnd = end;
      state.selectedVerses = state.chapterData.verses.filter(v => v.verse >= start && v.verse <= end).map(v => v.verse);
    } else {
      state.selectedStart = verse;
      state.selectedEnd = verse;
      state.selectedVerses = [verse];
    }
    $("bible-verse").value = String(verse);
    saveLocation();
    updateSelectionPanel();
    updateVerseSelectionClasses();
    if (scroll) reading.querySelector(`.verse-row[data-verse="${verse}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function updateVerseSelectionClasses() {
    const ids = new Set(state.selectedVerses);
    reading.querySelectorAll(".verse-row").forEach(row => row.classList.toggle("verse-row--selected", ids.has(Number(row.dataset.verse))));
  }

  async function renderConfessionConnections(passage) {
    const targetIds = new Set(passage.map(v => canonicalVerseId(state.book, state.chapter, v.verse)));
    targetIds.add(canonicalChapterId(state.book, state.chapter));
    const relationships = [];
    for (const targetId of targetIds) {
      const targetType = targetId === canonicalChapterId(state.book, state.chapter) ? "BibleChapter" : "BibleVerse";
      const refs = await getConfessionReferencesForScripture(targetId, targetType);
      relationships.push(...refs);
    }
    const unique = new Map();
    for (const rel of relationships) {
      const key = `${rel.source_id}:${rel.metadata?.reference_text || ""}`;
      if (!unique.has(key)) unique.set(key, rel);
    }
    const list = [...unique.values()];
    const container = $("bible-confession-links");
    if (!list.length) {
      container.innerHTML = `<div class="bible-confession-links__empty"><strong>1689 Confession</strong><span>No 1689 proof-text connection is recorded for this selection.</span></div>`;
      return;
    }
    const grouped = new Map();
    for (const rel of list) {
      const match = String(rel.source_id || "").match(/^1689-lbcf-(\d+)-(\d+)$/);
      if (!match) continue;
      const key = `${match[1]}:${match[2]}`;
      if (!grouped.has(key)) grouped.set(key, { chapter: Number(match[1]), paragraph: Number(match[2]), reference: rel.metadata?.reference_text || "" });
    }
    const cards = [...grouped.values()].map(item => {
      const payload = encodeURIComponent(JSON.stringify(item));
      return `<button type="button" class="bible-confession-link" data-confession-target="${escapeHtml(payload)}"><strong>1689 · Ch. ${item.chapter} ¶${item.paragraph}</strong><span>${escapeHtml(item.reference)}</span><small>Open in Confession</small></button>`;
    }).join("");
    container.innerHTML = `<div class="bible-confession-links__heading"><strong>1689 Confession</strong><span>${grouped.size} related paragraph${grouped.size === 1 ? "" : "s"}</span></div>${cards}`;
    container.querySelectorAll("[data-confession-target]").forEach(btn => btn.addEventListener("click", () => {
      try {
        const target = JSON.parse(decodeURIComponent(btn.dataset.confessionTarget));
        sessionStorage.setItem("pw:confession:pendingNavigation", JSON.stringify(target));
        window.location.hash = "#/confession";
      } catch (error) { console.error("[Workbench] Could not open 1689 reference", error); }
    }));
  }

  function canonicalIdToLocation(id) {
    const parts = String(id || "").toLowerCase().split("-");
    if (parts.length < 3) return null;
    const verse = Number(parts.pop());
    const chapter = Number(parts.pop());
    const slug = parts.join("-");
    const book = getBookList().find(b => b.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") === slug);
    if (!book || !Number.isInteger(chapter) || !Number.isInteger(verse)) return null;
    return { book: book.name, chapter, verse };
  }

  function crossReferenceLetter(index) {
    let n = index + 1;
    let label = "";
    while (n > 0) {
      n -= 1;
      label = String.fromCharCode(97 + (n % 26)) + label;
      n = Math.floor(n / 26);
    }
    return label;
  }

  function renderCrossReferenceBubble(layer, ordered) {
    layer.innerHTML = "";
    const bubble = document.createElement("div");
    bubble.className = "crossref-bubble";
    bubble.hidden = true;
    bubble.innerHTML = `<div class="crossref-bubble__title">Cross-reference</div><div class="crossref-bubble__list"></div><button class="crossref-bubble__close" type="button" aria-label="Close cross-reference">×</button>`;
    const list = bubble.querySelector(".crossref-bubble__list");
    ordered.forEach((ref, index) => {
      const letter = crossReferenceLetter(index);
      const target = ref.target;
      const endVerse = Number(ref.target_end_verse || target.verse);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "crossref-bubble__link";
      button.innerHTML = `<span class="crossref-bubble__letter">${letter}</span><span>${escapeHtml(target.book)} ${target.chapter}:${target.verse}${endVerse !== target.verse ? `–${endVerse}` : ""}</span>`;
      button.addEventListener("click", async () => {
        await openCrossReferenceReader({ ...target, endVerse });
      });
      list.appendChild(button);
    });
    layer.appendChild(bubble);
    bubble.querySelector(".crossref-bubble__close").addEventListener("click", () => { bubble.hidden = true; });
    return bubble;
  }

  async function renderCrossReferenceMarkers() {
    try {
      await loadCrossReferencesForChapter(state.book, state.chapter);
      const refs = await getChapterCrossReferences(state.book, state.chapter);
      const byVerse = new Map();
      for (const ref of refs) {
        const source = String(ref.source_verse_id || "").toUpperCase();
        const targetId = String(ref.target_verse_id || "").toUpperCase();
        if (!source || !targetId) continue;
        if (!byVerse.has(source)) byVerse.set(source, []);
        byVerse.get(source).push(ref);
      }

      for (const [sourceId, verseRefs] of byVerse) {
        const location = canonicalIdToLocation(sourceId);
        if (!location || location.book !== state.book || Number(location.chapter) !== Number(state.chapter)) continue;
        const row = reading.querySelector(`.verse-row[data-verse="${location.verse}"]`);
        const text = row?.querySelector(".verse-text");
        const layer = reading.querySelector(`.crossref-bubble-layer[data-crossref-bubble-for="${location.verse}"]`);
        if (!row || !text || !layer) continue;

        const unique = new Map();
        for (const ref of verseRefs) {
          const target = canonicalIdToLocation(ref.target_verse_id);
          if (!target) continue;
          const key = `${ref.target_verse_id}|${ref.target_end_verse || ""}`;
          if (!unique.has(key)) unique.set(key, { ...ref, target });
        }
        const ordered = [...unique.values()].sort((a, b) => Number(b.votes ?? b.score ?? 0) - Number(a.votes ?? a.score ?? 0));
        if (!ordered.length) continue;

        // Keep the verse itself clean: one compact native dropdown contains all
        // cross-reference letters instead of printing every letter beside the text.
        const select = document.createElement("select");
        select.className = "crossref-select";
        select.title = `${ordered.length} cross-reference${ordered.length === 1 ? "" : "s"}`;
        select.setAttribute("aria-label", `Cross-references for ${state.book} ${state.chapter}:${location.verse}`);
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = ordered.length === 1 ? crossReferenceLetter(0) : "refs";
        select.appendChild(placeholder);
        ordered.forEach((ref, index) => {
          const option = document.createElement("option");
          option.value = String(index);
          option.textContent = crossReferenceLetter(index);
          select.appendChild(option);
        });
        text.appendChild(select);

        const bubble = renderCrossReferenceBubble(layer, ordered);
        select.addEventListener("click", event => event.stopPropagation());
        select.addEventListener("change", event => {
          event.stopPropagation();
          const index = Number(select.value);
          if (!Number.isInteger(index) || !ordered[index]) return;
          const link = bubble.querySelectorAll(".crossref-bubble__link")[index];
          reading.querySelectorAll(".crossref-bubble").forEach(other => { if (other !== bubble) other.hidden = true; });
          bubble.hidden = false;
          link?.focus();
          select.value = "";
        });
      }
    } catch (error) {
      // Cross-references are supplemental. A network/corpus problem must never
      // prevent the Bible chapter itself from rendering.
      console.warn("[Workbench] Cross-reference markers unavailable", error);
    }
  }

  async function openCrossReferenceReader(target) {
    crossrefPopup.book = target.book;
    crossrefPopup.chapter = Number(target.chapter);
    crossrefPopup.verse = Number(target.verse);
    crossrefPopup.endVerse = Number(target.endVerse || target.verse);
    await renderCrossReferenceReader();
    const dialog = $("crossref-reader-dialog");
    if (!dialog.open) dialog.showModal();
  }

  async function renderCrossReferenceReader() {
    const { book, chapter, verse, endVerse } = crossrefPopup;
    if (!book || !chapter || !verse) return;
    const content = $("crossref-reader-content");
    const title = $("crossref-reader-title");
    const meta = $("crossref-reader-meta");
    content.innerHTML = `<div class="empty-state">Loading ${escapeHtml(book)} ${chapter}…</div>`;
    $("crossref-reader-prev").disabled = chapter <= 1;
    try {
      const data = await getChapter(book, chapter, state.translation);
      if (!data?.verses?.length) throw new Error("Referenced chapter is not available in this translation.");
      const targetStart = Math.max(1, verse);
      const targetEnd = Math.min(Number(endVerse || verse), data.verses.length);
      title.textContent = `${book} ${chapter}`;
      meta.textContent = `${state.translation} · verses ${targetStart}${targetEnd !== targetStart ? `–${targetEnd}` : ""} · full chapter`;
      content.innerHTML = `<div class="crossref-reader-text">${data.verses.map(v => {
        const selected = v.verse >= targetStart && v.verse <= targetEnd;
        return `<div class="crossref-reader-verse ${selected ? "crossref-reader-verse--target" : ""}" data-popup-verse="${v.verse}"><span class="crossref-reader-verse__number">${v.verse}</span><span class="crossref-reader-verse__text">${escapeHtml(v.text)}</span></div>`;
      }).join("")}</div>`;
      const target = content.querySelector(`.crossref-reader-verse[data-popup-verse="${targetStart}"]`);
      requestAnimationFrame(() => target?.scrollIntoView({ behavior: "smooth", block: "center" }));
    } catch (error) {
      title.textContent = `${book} ${chapter}`;
      meta.textContent = state.translation;
      content.innerHTML = `<div class="error-panel">${escapeHtml(error.message)}</div>`;
    }
  }

  async function openCrossReferenceInMainReader() {
    const { book, chapter, verse, endVerse } = crossrefPopup;
    if (!book || !chapter || !verse) return;
    $("crossref-reader-dialog").close();
    state.book = book;
    state.chapter = chapter;
    state.selectedStart = verse;
    state.selectedEnd = Number(endVerse || verse);
    $("bible-book").value = state.book;
    populateChapters();
    await loadChapter();
    selectVerse(verse, false, true);
  }

  async function updateSelectionPanel() {
    const passage = selectedPassage();
    const summary = $("bible-selection-summary");
    if (!passage.length) {
      summary.textContent = `Reading ${state.book} ${state.chapter}. Select a verse to narrow study tools.`;
      $("bible-note-list").innerHTML = "";
      $("bible-confession-links").innerHTML = "";
        return;
    }
    const ref = currentReference(passage);
    summary.innerHTML = `<strong>${escapeHtml(ref)}</strong><span>${escapeHtml(state.translation)} · ${passage.length} verse${passage.length === 1 ? "" : "s"}</span>`;
    const ids = passage.map(v => canonicalVerseId(state.book, state.chapter, v.verse));
    const notes = (await all("notes")).filter(n => n.scripture?.some?.(s => ids.includes(s.canonicalVerseId)) || ids.includes(n.canonicalVerseId));
    $("bible-note-list").innerHTML = notes.length ? notes.map(n => `<div class="bible-note"><div class="bible-note__title">${escapeHtml(n.title || "Note")}</div><p>${escapeHtml(n.content || "")}</p><div class="bible-note__actions"><button class="text-button" data-note-edit="${escapeHtml(n.id)}">Edit</button><button class="text-button text-button--danger" data-note-delete="${escapeHtml(n.id)}">Delete</button></div></div>`).join("") : `<div class="empty-state">No notes on this selection yet.</div>`;
    $("bible-note-list").querySelectorAll("[data-note-edit]").forEach(btn => btn.addEventListener("click", async () => { const note = await get("notes", btn.dataset.noteEdit); if (note) beginEditNote(note); }));
    $("bible-note-list").querySelectorAll("[data-note-delete]").forEach(btn => btn.addEventListener("click", () => deleteNote(btn.dataset.noteDelete)));
    await renderConfessionConnections(passage);
  }

  async function saveHighlight(color) {
    const passage = selectedPassage();
    if (!passage.length) return;
    for (const verse of passage) {
      const canonical = canonicalVerseId(state.book, state.chapter, verse.verse);
      const id = `highlight:${state.translation}:${canonical}`;
      if (color === "remove") await remove("bible_annotations", id);
      else await put("bible_annotations", { id, type: "highlight", color, canonicalVerseId: canonical, translationId: state.translation, book: state.book, chapter: state.chapter, verse: verse.verse, updatedAt: new Date().toISOString() });
    }
    $("highlight-palette").hidden = true;
    await renderChapter();
    updateVerseSelectionClasses();
  }

  function beginEditNote(note) {
    $("bible-note-editor").hidden = false;
    $("note-editor-heading").textContent = `Edit note · ${note.title || currentReference()}`;
    $("bible-note-text").value = note.content || "";
    $("save-bible-note").dataset.editNoteId = note.id;
    $("bible-note-text").focus();
  }

  function resetNoteEditor() {
    $("bible-note-editor").hidden = true;
    $("note-editor-heading").textContent = "New note";
    $("bible-note-text").value = "";
    delete $("save-bible-note").dataset.editNoteId;
  }

  async function deleteNote(noteId) {
    if (!noteId) return;
    const note = await get("notes", noteId);
    if (!note) return;
    if (!window.confirm(`Delete this note?\n\n${note.title || "Note"}`)) return;
    await remove("notes", noteId);
    state.openNoteId = null;
    resetNoteEditor();
    await renderChapter();
    await updateSelectionPanel();
  }

  async function saveNote() {
    const text = $("bible-note-text").value.trim();
    const passage = selectedPassage();
    if (!text || !passage.length) return;
    const editId = $("save-bible-note").dataset.editNoteId;
    const now = new Date().toISOString();
    if (editId) {
      const existing = await get("notes", editId);
      if (existing) await put("notes", { ...existing, content: text, updatedAt: now });
    } else {
      const scriptures = passage.map(v => ({ canonicalVerseId: canonicalVerseId(state.book, state.chapter, v.verse), book: state.book, chapter: state.chapter, verse: v.verse }));
      await put("notes", { id: `bible-note:${crypto.randomUUID()}`, title: currentReference(passage), content: text, sourceType: "personal", note_type: "observation", origin: "personal", scripture: scriptures, createdAt: now, updatedAt: now });
    }
    resetNoteEditor();
    await renderChapter();
    await updateSelectionPanel();
  }

  async function bookmark() {
    const passage = selectedPassage();
    if (!passage.length) return;
    const start = passage[0].verse;
    const end = passage.at(-1).verse;
    const id = `bookmark:${state.translation}:${canonicalVerseId(state.book, state.chapter, start)}:${end}`;
    const existing = await get("bible_annotations", id);
    if (existing) await remove("bible_annotations", id);
    else await put("bible_annotations", { id, type: "bookmark", canonicalVerseId: canonicalVerseId(state.book, state.chapter, start), translationId: state.translation, book: state.book, chapter: state.chapter, startVerse: start, endVerse: end, createdAt: new Date().toISOString() });
    await renderStudySummary(await getChapterAnnotations());
  }

  async function copySelection() {
    const passage = selectedPassage(); if (!passage.length) return;
    const text = passage.map(v => `${state.book} ${state.chapter}:${v.verse} ${v.text}`).join("\n");
    try { await navigator.clipboard.writeText(text); $("bible-status").textContent = "Copied"; setTimeout(() => { $("bible-status").textContent = "Ready"; }, 1200); } catch { window.prompt("Copy Scripture", text); }
  }

  async function shareSelection() {
    const passage = selectedPassage(); if (!passage.length) return;
    const text = `${currentReference(passage)} · ${state.translation}\n\n${passage.map(v => v.text).join(" ")}`;
    if (navigator.share) {
      try { await navigator.share({ title: currentReference(passage), text }); } catch { /* cancelled */ }
    } else {
      await copySelection();
      $("bible-status").textContent = "Copied for sharing";
      setTimeout(() => { $("bible-status").textContent = "Ready"; }, 1200);
    }
  }

  async function loadChapter() {
    saveLocation();
    reading.innerHTML = `<div class="empty-state">Loading ${escapeHtml(state.book)} ${state.chapter}…</div>`;
    try {
      state.chapterData = await getChapter(state.book, state.chapter, state.translation);
      if (!state.chapterData) throw new Error("Chapter not found.");
      state.chapterData.verses = state.chapterData.verses.map(v => ({ ...v, canonicalVerseId: canonicalVerseId(state.book, state.chapter, v.verse) }));
      state.selectedStart = Math.min(state.selectedStart || 1, state.chapterData.verses.length);
      state.selectedEnd = Math.min(state.selectedEnd || state.selectedStart, state.chapterData.verses.length);
      if (state.selectedEnd < state.selectedStart) state.selectedEnd = state.selectedStart;
      state.selectedVerses = state.chapterData.verses.filter(v => v.verse >= state.selectedStart && v.verse <= state.selectedEnd).map(v => v.verse);
      if (!state.selectedVerses.length) state.selectedVerses = [state.selectedStart];
      populateVerses();
      await renderChapter();
      if (pendingNavigation?.book === state.book && Number(pendingNavigation?.chapter) === Number(state.chapter)) {
        requestAnimationFrame(() => reading.querySelector(`.verse-row[data-verse="${state.selectedStart}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
      }
      await updateSelectionPanel();
      await saveHistory();
      $("bible-status").textContent = "Ready";
    } catch (error) {
      reading.innerHTML = `<div class="error-panel">${escapeHtml(error.message)}<br><small>This translation/book may not be available at the source.</small></div>`;
      $("bible-status").textContent = "Unavailable";
    }
  }

  async function saveHistory() {
    const id = `${state.translation}:${state.book}:${state.chapter}`;
    await put("bible_history", { id, translationId: state.translation, book: state.book, chapter: state.chapter, verse: state.selectedStart, openedAt: new Date().toISOString() });
    const history = (await all("bible_history")).sort((a,b) => String(b.openedAt).localeCompare(String(a.openedAt))).slice(0, 12);
    $("bible-history").innerHTML = history.map(h => `<button class="history-item" data-history="${escapeHtml(h.id)}"><strong>${escapeHtml(h.book)} ${h.chapter}</strong><span>${escapeHtml(h.translationId)}</span></button>`).join("") || `<div class="empty-state">Nothing here yet.</div>`;
    $("bible-history").querySelectorAll("[data-history]").forEach(btn => btn.addEventListener("click", async () => { const h = history.find(x => x.id === btn.dataset.history); if (!h) return; state.translation = h.translationId; state.book = h.book; state.chapter = h.chapter; state.selectedStart = h.verse || 1; $("bible-translation").value = state.translation; $("bible-book").value = state.book; populateChapters(); await loadChapter(); }));
  }

  async function renderStudySummary(annotations) {
    const highlights = annotations.filter(a => a.type === "highlight");
    const bookmarks = annotations.filter(a => a.type === "bookmark");
    $("bible-study-summary").innerHTML = `<div><strong>${highlights.length}</strong><span>Highlights</span></div><div><strong>${bookmarks.length}</strong><span>Bookmarks</span></div>`;
    const items = [...highlights.map(a => ({ ...a, label: `Highlight · ${state.book} ${state.chapter}:${a.verse}`, detail: a.color })), ...bookmarks.map(a => ({ ...a, label: `Bookmark · ${state.book} ${state.chapter}:${a.startVerse}${a.endVerse !== a.startVerse ? `–${a.endVerse}` : ""}`, detail: "saved" }))];
    $("bible-annotations-list").innerHTML = items.length ? items.map(a => `<div class="annotation-item"><div><strong>${escapeHtml(a.label)}</strong><span>${escapeHtml(a.detail)}</span></div><button class="text-button text-button--danger" data-remove-annotation="${escapeHtml(a.id)}">Remove</button></div>`).join("") : `<div class="empty-state">No highlights or bookmarks in this chapter.</div>`;
    $("bible-annotations-list").querySelectorAll("[data-remove-annotation]").forEach(btn => btn.addEventListener("click", async () => { await remove("bible_annotations", btn.dataset.removeAnnotation); await renderChapter(); }));
  }

  function openCompare() {
    const passage = selectedPassage(); if (!passage.length) return;
    const dialog = $("compare-dialog");
    $("compare-reference").textContent = `${currentReference(passage)} · ${state.translation} selected`;
    $("compare-content").innerHTML = versions.map(v => `<article class="compare-card" data-compare-version="${v.id}"><h3>${escapeHtml(v.name)} (${v.id})</h3><div>Loading…</div></article>`).join("");
    dialog.showModal();
    versions.forEach(async v => {
      try { const p = await getPassage(state.book, state.chapter, passage[0].verse, passage.at(-1).verse, v.id); const card = document.querySelector(`[data-compare-version="${v.id}"] div`); if (card) card.textContent = (p || []).map(x => `${x.verse} ${x.text}`).join(" ") || "Unavailable"; }
      catch { const card = document.querySelector(`[data-compare-version="${v.id}"] div`); if (card) card.textContent = "Unavailable from this provider."; }
    });
  }

  $("crossref-reader-close").addEventListener("click", () => $("crossref-reader-dialog").close());
  $("crossref-reader-open").addEventListener("click", openCrossReferenceInMainReader);
  $("crossref-reader-prev").addEventListener("click", async () => {
    if (crossrefPopup.chapter <= 1) return;
    crossrefPopup.chapter -= 1;
    crossrefPopup.verse = 1;
    crossrefPopup.endVerse = 1;
    await renderCrossReferenceReader();
  });
  $("crossref-reader-next").addEventListener("click", async () => {
    crossrefPopup.chapter += 1;
    crossrefPopup.verse = 1;
    crossrefPopup.endVerse = 1;
    await renderCrossReferenceReader();
  });
  $("crossref-reader-dialog").addEventListener("click", event => {
    if (event.target === $("crossref-reader-dialog")) $("crossref-reader-dialog").close();
  });

  $("bible-translation").addEventListener("change", () => { state.translation = $("bible-translation").value; saveLocation(); loadChapter(); });
  $("bible-book").addEventListener("change", () => { state.book = $("bible-book").value; state.chapter = 1; state.selectedStart = 1; populateChapters(); loadChapter(); });
  $("bible-chapter").addEventListener("change", () => { state.chapter = Number($("bible-chapter").value); state.selectedStart = 1; loadChapter(); });
  $("bible-verse").addEventListener("change", () => { const verse = Number($("bible-verse").value); if (verse) selectVerse(verse, false, true); });
  $("bible-load").addEventListener("click", loadChapter);

  document.querySelectorAll(".tool-button").forEach(btn => btn.addEventListener("click", async () => {
    if (!state.selectedVerses.length) return;
    const action = btn.dataset.action;
    if (action === "highlight") $("highlight-palette").hidden = !$("highlight-palette").hidden;
    if (action === "note") { $("bible-note-editor").hidden = false; $("note-editor-heading").textContent = `New note · ${currentReference()}`; $("bible-note-text").value = ""; delete $("save-bible-note").dataset.editNoteId; $("bible-note-text").focus(); }
    if (action === "bookmark") await bookmark();
    if (action === "copy") await copySelection();
    if (action === "share") await shareSelection();
    if (action === "compare") openCompare();
  }));
  document.querySelectorAll(".highlight-swatch, .highlight-remove").forEach(btn => btn.addEventListener("click", () => saveHighlight(btn.dataset.color)));
  $("save-bible-note").addEventListener("click", saveNote);
  $("cancel-bible-note").addEventListener("click", resetNoteEditor);

  $("bible-search-form").addEventListener("submit", async event => {
    event.preventDefault(); const query = $("bible-search").value; const version = state.translation; results.innerHTML = `<p>Searching ${escapeHtml(version)}…</p>`;
    try {
      const found = await search(query, { limit: 100, translationId: version });
      results.innerHTML = found.length ? found.map(item => `<button class="result-item" data-book="${escapeHtml(item.book)}" data-chapter="${item.chapter}" data-verse="${item.verse}"><strong>${escapeHtml(item.book)} ${item.chapter}:${item.verse} · ${escapeHtml(version)}</strong><span>${escapeHtml(item.text)}</span></button>`).join("") : `<div class="empty-state">No results.</div>`;
      results.querySelectorAll("[data-book]").forEach(button => button.addEventListener("click", () => { state.book = button.dataset.book; state.chapter = Number(button.dataset.chapter); state.selectedStart = Number(button.dataset.verse); $("bible-book").value = state.book; populateChapters(); loadChapter(); }));
    } catch (error) { results.innerHTML = `<div class="error-panel">${escapeHtml(error.message)}</div>`; }
  });

  $("bible-settings").addEventListener("click", () => $("reading-settings-dialog").showModal());
  $("reader-text-width").value = state.textWidth;
  $("reader-font-size").addEventListener("input", e => { state.fontSize = Number(e.target.value); localStorage.setItem("pw:bible:fontSize", state.fontSize); renderChapter(); });
  $("reader-line-height").addEventListener("input", e => { state.lineHeight = Number(e.target.value); localStorage.setItem("pw:bible:lineHeight", state.lineHeight); renderChapter(); });
  $("reader-text-width").addEventListener("change", e => { state.textWidth = e.target.value; localStorage.setItem("pw:bible:textWidth", state.textWidth); renderChapter(); });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      state.selectedVerses = [];
      updateVerseSelectionClasses();
      updateSelectionPanel();
    }
  }, { once: false });

  populateChapters();
  await loadChapter();
}

function getChapterCount(book) {
  const counts = [31,40,27,36,34,24,21,4,31,24,22,25,29,36,10,13,10,42,150,31,12,8,66,52,5,48,12,14,3,9,1,4,7,3,3,3,2,14,4,28,16,24,21,28,16,16,13,6,6,4,4,5,3,6,4,3,1,13,5,5,3,5,1,1,1,22];
  const books = getBookList(); const index = books.findIndex(b => b.name === book); return counts[index] || 1;
}

function escapeHtml(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
