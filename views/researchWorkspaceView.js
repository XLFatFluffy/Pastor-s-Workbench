import {
  deleteKnowledgeRecord, getKnowledgeRelationships, getKnowledgeStats, listKnowledge,
  relateKnowledge, saveCollection, saveNote, saveResearchItem, saveSource, saveTopic,
  normalizeKnowledgeOrigin
} from "../researchService.js";
import { NOTE_TYPES, RESEARCH_TYPES, KNOWLEDGE_ORIGINS, RELATIONSHIP_TYPES } from "../dataModel.js";

const escapeHtml = (v) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const label = (value) => String(value || "").replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());

const TABS = [
  ["research", "Research"], ["notes", "Notes"], ["topics", "Topics"], ["collections", "Collections"], ["sources", "Sources"]
];

export async function render(mount, route = {}) {
  const initial = ["research", "notes", "topics", "collections", "sources"].includes(route.id) ? route.id : "research";
  mount.innerHTML = `
    <div class="canvas__header">
      <p class="canvas__eyebrow">Phase 6 · Research &amp; Knowledge</p>
      <h1 class="canvas__title">Knowledge Workspace</h1>
      <p class="canvas__dek">Capture reusable research, distinguish personal conclusions from source material, and connect knowledge to Scripture and other Workbench records.</p>
    </div>
    <section class="foundation-strip" id="knowledge-stats"></section>
    <nav class="knowledge-tabs" aria-label="Knowledge sections">
      ${TABS.map(([id, text]) => `<button type="button" class="knowledge-tab" data-tab="${id}">${text}</button>`).join("")}
    </nav>
    <section id="knowledge-panel"></section>
  `;
  mount.querySelectorAll(".knowledge-tab").forEach((button) => button.addEventListener("click", () => showTab(button.dataset.tab)));
  await refreshStats();
  await showTab(initial);

  async function refreshStats() {
    const s = await getKnowledgeStats();
    mount.querySelector("#knowledge-stats").innerHTML = `
      <div><span class="foundation-strip__label">Research</span><strong>${s.research}</strong><span class="foundation-strip__ok">Structured</span></div>
      <div><span class="foundation-strip__label">Notes</span><strong>${s.notes}</strong><span class="foundation-strip__ok">Structured</span></div>
      <div><span class="foundation-strip__label">Topics</span><strong>${s.topics}</strong><span class="foundation-strip__ok">Indexed</span></div>
      <div><span class="foundation-strip__label">Relationships</span><strong>${s.relationships}</strong><span class="foundation-strip__ok">Local</span></div>
    `;
  }

  async function showTab(tab) {
    mount.querySelectorAll(".knowledge-tab").forEach((button) => button.classList.toggle("knowledge-tab--active", button.dataset.tab === tab));
    const panel = mount.querySelector("#knowledge-panel");
    if (tab === "research") await renderResearch(panel);
    if (tab === "notes") await renderNotes(panel);
    if (tab === "topics") await renderTopics(panel);
    if (tab === "collections") await renderCollections(panel);
    if (tab === "sources") await renderSources(panel);
  }

  function originOptions() { return KNOWLEDGE_ORIGINS.map((origin) => `<option value="${origin}">${label(origin)}</option>`).join(""); }

  function knowledgeForm({ type, submitId, title = "", content = "", origin = "personal", researchType = "observation", noteType = "general" }) {
    const isResearch = type === "ResearchItem";
    return `<form id="${submitId}" class="tool-form">
      <label>Title<input name="title" value="${escapeHtml(title)}" required></label>
      ${isResearch ? `<label>Research type<select name="research_type">${RESEARCH_TYPES.map((v) => `<option value="${v}" ${v === researchType ? "selected" : ""}>${label(v)}</option>`).join("")}</select></label>` : `<label>Note type<select name="note_type">${NOTE_TYPES.map((v) => `<option value="${v}" ${v === noteType ? "selected" : ""}>${label(v)}</option>`).join("")}</select></label>`}
      <label>Knowledge origin<select name="origin">${originOptions()}</select></label>
      <label>Content<textarea name="content" rows="8" required>${escapeHtml(content)}</textarea></label>
      <fieldset class="provenance-fieldset"><legend>Provenance</legend><label>Source / provider<input name="provider" placeholder="Book, commentary, author, website, etc."></label><label>Locator<input name="locator" placeholder="Page, chapter, URL, quotation location"></label><p class="muted">Source and AI knowledge require provenance. Personal knowledge is explicitly yours and is not presented as source material.</p></fieldset>
      <button class="button button--primary" type="submit">Save ${type === "ResearchItem" ? "Research" : "Note"}</button>
    </form>`;
  }

  async function renderResearch(panel) {
    panel.innerHTML = `<section class="study-grid"><article class="reader-panel"><div class="reader-panel__head"><div><p class="canvas__eyebrow">Capture</p><h2>New research item</h2></div></div>${knowledgeForm({ type: "ResearchItem", submitId: "research-create" })}</article><article class="reader-panel"><div class="reader-panel__head"><div><p class="canvas__eyebrow">Knowledge boundary</p><h2>Research types</h2></div></div><p class="muted">Use a specific type rather than a generic blob. Observation, question, argument, counterargument, quote, historical, linguistic, theological connection, conclusion, and application remain separately searchable.</p><div class="pill-list">${RESEARCH_TYPES.map((v) => `<span class="pill">${label(v)}</span>`).join("")}</div></article></section><section class="reader-panel" style="margin-top:1rem"><div class="reader-panel__head"><div><p class="canvas__eyebrow">Library</p><h2>Research items</h2></div></div><div id="research-list"></div></section>`;
    const form = panel.querySelector("#research-create");
    form.elements.origin.value = "personal";
    form.addEventListener("submit", async (event) => { event.preventDefault(); await saveKnowledgeForm(form, "ResearchItem"); await renderResearch(panel); await refreshStats(); });
    await renderList(panel.querySelector("#research-list"), "ResearchItem");
  }

  async function renderNotes(panel) {
    panel.innerHTML = `<section class="study-grid"><article class="reader-panel"><div class="reader-panel__head"><div><p class="canvas__eyebrow">Capture</p><h2>New knowledge note</h2></div></div>${knowledgeForm({ type: "Note", submitId: "note-create" })}</article><article class="reader-panel"><div class="reader-panel__head"><div><p class="canvas__eyebrow">Boundary</p><h2>Personal vs. source</h2></div></div><p class="muted">Every new note records an explicit origin. A source-derived note cannot be saved without provenance, so personal conclusions do not accidentally become unattributed quotations or claims.</p></article></section><section class="reader-panel" style="margin-top:1rem"><div class="reader-panel__head"><div><p class="canvas__eyebrow">Library</p><h2>Notes</h2></div></div><div id="note-list"></div></section>`;
    const form = panel.querySelector("#note-create");
    form.addEventListener("submit", async (event) => { event.preventDefault(); await saveKnowledgeForm(form, "Note"); await renderNotes(panel); await refreshStats(); });
    await renderList(panel.querySelector("#note-list"), "Note");
  }

  async function saveKnowledgeForm(form, type) {
    const data = new FormData(form);
    const origin = normalizeKnowledgeOrigin(data.get("origin"));
    const provider = String(data.get("provider") || "").trim();
    const locator = String(data.get("locator") || "").trim();
    const provenance = origin === "personal" ? null : { provider, locator, recorded_at: new Date().toISOString() };
    if (origin !== "personal" && !provider) { alert(`${label(origin)} knowledge requires a source/provider in Provenance.`); return; }
    const input = { title: data.get("title"), content: data.get("content"), origin, provenance };
    if (type === "ResearchItem") Object.assign(input, { research_type: data.get("research_type") });
    else Object.assign(input, { note_type: data.get("note_type") });
    if (type === "ResearchItem") await saveResearchItem(input); else await saveNote(input);
  }

  async function renderList(target, type) {
    const rows = await listKnowledge({ type });
    target.innerHTML = rows.length ? rows.map((row) => `
      <article class="knowledge-card">
        <div class="knowledge-card__head"><div><h3>${escapeHtml(row.title || row.name)}</h3><div class="pill-list"><span class="pill">${escapeHtml(label(type === "ResearchItem" ? row.research_type : row.note_type || type))}</span>${row.origin ? `<span class="pill">${escapeHtml(label(row.origin))}</span>` : ""}</div></div><button class="text-button text-button--danger" data-delete-type="${type}" data-delete-id="${escapeHtml(row.id)}">Delete</button></div>
        ${row.content ? `<p>${escapeHtml(row.content)}</p>` : `<p class="muted">${escapeHtml(row.description || "No description.")}</p>`}
        ${row.provenance ? `<small>Provenance: ${escapeHtml(row.provenance.provider || "recorded source")} ${row.provenance.locator ? `· ${escapeHtml(row.provenance.locator)}` : ""}</small>` : `<small>Origin: personal knowledge</small>`}
        <div class="knowledge-card__actions"><button class="text-button" data-relate-type="${type}" data-relate-id="${escapeHtml(row.id)}">Connect</button><button class="text-button" data-details-type="${type}" data-details-id="${escapeHtml(row.id)}">Relationships</button></div>
        <div class="knowledge-card__details" data-details-for="${escapeHtml(row.id)}" hidden></div>
      </article>`).join("") : `<div class="empty-state">No ${type === "ResearchItem" ? "research items" : "notes"} yet.</div>`;
    target.querySelectorAll("[data-delete-id]").forEach((button) => button.addEventListener("click", async () => { if (!confirm("Delete this record?")) return; await deleteKnowledgeRecord(button.dataset.deleteType, button.dataset.deleteId); await refreshStats(); await renderList(target, type); }));
    target.querySelectorAll("[data-details-id]").forEach((button) => button.addEventListener("click", async () => { const box = target.querySelector(`[data-details-for="${CSS.escape(button.dataset.detailsId)}"]`); const rows = await getKnowledgeRelationships(button.dataset.detailsType, button.dataset.detailsId); box.hidden = !box.hidden; box.innerHTML = rows.length ? rows.map((r) => `<div>${escapeHtml(r.source_type)}:${escapeHtml(r.source_id)} <strong>${escapeHtml(r.relationship_type)}</strong> ${escapeHtml(r.target_type)}:${escapeHtml(r.target_id)}</div>`).join("") : `<span class="muted">No relationships yet.</span>`; }));
    target.querySelectorAll("[data-relate-id]").forEach((button) => button.addEventListener("click", async () => {
      const targetType = prompt("Connect to type: Topic, Collection, Note, ResearchItem, Source, or BibleVerse");
      if (!targetType) return;
      const targetId = prompt(`Connect to ${targetType} ID:`);
      if (!targetId) return;
      const relationshipType = prompt(`Relationship type (${RELATIONSHIP_TYPES.join(", ")}):`, "related");
      if (!relationshipType || !RELATIONSHIP_TYPES.includes(relationshipType)) return alert("Invalid relationship type.");
      try { await relateKnowledge(button.dataset.relateType, button.dataset.relateId, targetType, targetId, relationshipType); await refreshStats(); alert("Relationship saved locally."); } catch (error) { alert(error.message || String(error)); }
    }));
  }

  async function renderTopics(panel) {
    panel.innerHTML = `<section class="study-grid"><article class="reader-panel"><div class="reader-panel__head"><div><p class="canvas__eyebrow">Organize</p><h2>New topic</h2></div></div><form id="topic-create" class="tool-form"><label>Name<input name="name" required placeholder="Justification"></label><label>Description<textarea name="description" rows="4"></textarea></label><button class="button button--primary" type="submit">Save Topic</button></form></article><article class="reader-panel"><div class="reader-panel__head"><div><p class="canvas__eyebrow">Purpose</p><h2>Reusable subjects</h2></div></div><p class="muted">Topics are durable knowledge anchors. Research, notes, Scripture, confession paragraphs, and future sermon or lesson projects can all relate to a topic without copying the underlying content.</p></article></section><section class="reader-panel" style="margin-top:1rem"><div class="reader-panel__head"><div><p class="canvas__eyebrow">Index</p><h2>Topics</h2></div></div><div id="topic-list"></div></section>`;
    panel.querySelector("#topic-create").addEventListener("submit", async (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); await saveTopic({ name: data.get("name"), description: data.get("description") }); await renderTopics(panel); await refreshStats(); });
    await renderGenericCollectionList(panel.querySelector("#topic-list"), "Topic");
  }

  async function renderCollections(panel) {
    panel.innerHTML = `<section class="study-grid"><article class="reader-panel"><div class="reader-panel__head"><div><p class="canvas__eyebrow">Organize</p><h2>New collection</h2></div></div><form id="collection-create" class="tool-form"><label>Name<input name="name" required placeholder="Romans 9 research"></label><label>Description<textarea name="description" rows="4"></textarea></label><button class="button button--primary" type="submit">Save Collection</button></form></article><article class="reader-panel"><div class="reader-panel__head"><div><p class="canvas__eyebrow">Purpose</p><h2>Curated sets</h2></div></div><p class="muted">Collections are containers for curated material. The content remains authoritative in its original record; collections organize it through relationships.</p></article></section><section class="reader-panel" style="margin-top:1rem"><div class="reader-panel__head"><div><p class="canvas__eyebrow">Index</p><h2>Collections</h2></div></div><div id="collection-list"></div></section>`;
    panel.querySelector("#collection-create").addEventListener("submit", async (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); await saveCollection({ name: data.get("name"), description: data.get("description") }); await renderCollections(panel); await refreshStats(); });
    await renderGenericCollectionList(panel.querySelector("#collection-list"), "Collection");
  }

  async function renderGenericCollectionList(target, type) {
    const rows = await listKnowledge({ type });
    target.innerHTML = rows.length ? rows.map((row) => `<article class="knowledge-card"><div class="knowledge-card__head"><div><h3>${escapeHtml(row.name)}</h3><p>${escapeHtml(row.description || "")}</p></div><button class="text-button text-button--danger" data-delete-type="${type}" data-delete-id="${escapeHtml(row.id)}">Delete</button></div></article>`).join("") : `<div class="empty-state">No ${type.toLowerCase()} records yet.</div>`;
    target.querySelectorAll("[data-delete-id]").forEach((button) => button.addEventListener("click", async () => { if (!confirm("Delete this record?")) return; await deleteKnowledgeRecord(type, button.dataset.deleteId); await renderGenericCollectionList(target, type); await refreshStats(); }));
  }

  async function renderSources(panel) {
    panel.innerHTML = `<section class="study-grid"><article class="reader-panel"><div class="reader-panel__head"><div><p class="canvas__eyebrow">Provenance</p><h2>New source</h2></div></div><form id="source-create" class="tool-form"><label>Title<input name="title" required placeholder="The Works of John Owen"></label><label>Type<input name="source_type" value="book"></label><label>Author<input name="author"></label><label>Publisher<input name="publisher"></label><label>Location<input name="location" placeholder="Page, URL, chapter, file"></label><button class="button button--primary" type="submit">Save Source</button></form></article><article class="reader-panel"><div class="reader-panel__head"><div><p class="canvas__eyebrow">Rule</p><h2>Source records are metadata</h2></div></div><p class="muted">A Source identifies where knowledge came from. It does not replace the ResearchItem or Note that records what you learned. That separation preserves provenance and keeps personal conclusions distinct from source material.</p></article></section><section class="reader-panel" style="margin-top:1rem"><div class="reader-panel__head"><div><p class="canvas__eyebrow">Index</p><h2>Sources</h2></div></div><div id="source-list"></div></section>`;
    panel.querySelector("#source-create").addEventListener("submit", async (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); await saveSource({ title: data.get("title"), source_type: data.get("source_type"), author: data.get("author"), publisher: data.get("publisher"), location: data.get("location"), provenance: { kind: "user-entered-source-metadata", recorded_at: new Date().toISOString() } }); await renderSources(panel); await refreshStats(); });
    const rows = await listKnowledge({ type: "Source" });
    panel.querySelector("#source-list").innerHTML = rows.length ? rows.map((row) => `<article class="knowledge-card"><div class="knowledge-card__head"><div><h3>${escapeHtml(row.title)}</h3><div class="pill-list"><span class="pill">${escapeHtml(label(row.source_type))}</span>${row.author ? `<span class="pill">${escapeHtml(row.author)}</span>` : ""}</div></div><button class="text-button text-button--danger" data-delete-id="${escapeHtml(row.id)}">Delete</button></div><p>${escapeHtml([row.publisher, row.location].filter(Boolean).join(" · "))}</p></article>`).join("") : `<div class="empty-state">No sources yet.</div>`;
    panel.querySelectorAll("[data-delete-id]").forEach((button) => button.addEventListener("click", async () => { if (!confirm("Delete this source?")) return; await deleteKnowledgeRecord("Source", button.dataset.deleteId); await renderSources(panel); await refreshStats(); }));
  }
}
