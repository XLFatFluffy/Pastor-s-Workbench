import { addCrossReference, CROSS_REFERENCE_TYPES, FULL_OPENBIBLE_CORPUS_INFO, getCrossReferenceIndexStatus, getCrossReferenceStats, importCrossReferenceCorpus, installFullOpenBibleCorpus, listCrossReferences, seedStarterSample } from "../crossReferenceService.js";

const escapeHtml = (v) => String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

export async function render(mount) {
  await seedStarterSample();
  mount.innerHTML = `
    <div class="canvas__header">
      <p class="canvas__eyebrow">Phase 4 · Scripture Study</p>
      <h1 class="canvas__title">Cross-References</h1>
      <p class="canvas__dek">A local, indexed Scripture connection layer. Imported corpus relationships retain provenance and source votes; semantic classifications are never invented.</p>
    </div>
    <section class="foundation-strip" id="crossref-stats"></section>
    <section class="study-grid">
      <article class="reader-panel">
        <div class="reader-panel__head"><div><p class="canvas__eyebrow">Lookup</p><h2>Find connections</h2></div></div>
        <form id="crossref-search" class="tool-form">
          <label>Verse ID<input name="verse" placeholder="GEN.1.1" required></label>
          <label>Direction<select name="direction"><option value="both">Both directions</option><option value="outgoing">From this verse</option><option value="incoming">To this verse</option></select></label>
          <label>Type<select name="type"><option value="">All types</option>${CROSS_REFERENCE_TYPES.map(t=>`<option value="${t}">${t}</option>`).join("")}</select></label>
          <button class="button button--primary" type="submit">Find Cross-References</button>
        </form>
        <div id="crossref-results" class="crossref-results"><p class="muted">Enter a canonical verse ID such as <strong>GEN.1.1</strong>.</p></div>
      </article>
      <aside class="reader-panel">
        <div class="reader-panel__head"><div><p class="canvas__eyebrow">Personal Study</p><h2>Add a relationship</h2></div></div>
        <form id="crossref-add" class="tool-form">
          <label>Source verse<input name="source" placeholder="GEN.1.1" required></label>
          <label>Target verse<input name="target" placeholder="JOH.1.1" required></label>
          <label>Relationship type<select name="type">${CROSS_REFERENCE_TYPES.map(t=>`<option value="${t}">${t}</option>`).join("")}</select></label>
          <label>Note<textarea name="notes" rows="3" placeholder="Why you see this relationship..."></textarea></label>
          <button class="button button--primary" type="submit">Save Relationship</button>
          <p class="muted">Personal relationships are stored locally. Source-derived relationships retain their original provenance.</p>
        </form>
      </aside>
    </section>
    <section class="reader-panel" style="margin-top:1rem">
      <div class="reader-panel__head"><div><p class="canvas__eyebrow">Corpus</p><h2>Import a cross-reference dataset</h2></div></div>
      <p class="muted">The engine accepts JSON or tab-separated files. The recommended full corpus is the OpenBible.info dataset (CC BY). Imported corpus records remain typed as <strong>other</strong> unless the source explicitly supplies a semantic relationship type.</p>
      <div class="tool-form" style="margin-bottom:1rem">
        <button id="install-openbible" class="button button--primary" type="button">Install Full OpenBible Corpus</button>
        <p id="openbible-install-status" class="muted">Official corpus delivery: ${FULL_OPENBIBLE_CORPUS_INFO.expectedReferences.toLocaleString()} relationships across ${FULL_OPENBIBLE_CORPUS_INFO.books} books / ${FULL_OPENBIBLE_CORPUS_INFO.chapters} chapters. The installer validates every target verse before storing it locally.</p>
      </div>
      <form id="crossref-import" class="tool-form">
        <label>Dataset file<input name="file" type="file" accept=".json,.tsv,.txt,.csv" required></label>
        <label>Corpus ID<input name="corpus" value="openbible-info"></label>
        <button class="button" type="submit">Import &amp; Index Dataset</button>
        <p id="crossref-import-status" class="muted">Manual import remains available for other documented datasets.</p>
      </form>
      <div id="crossref-index-status" class="muted"></div>
    </section>
  `;
  await refreshStats();
  mount.querySelector("#crossref-search").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const verse = String(data.get("verse")).trim().toUpperCase();
    const results = await listCrossReferences({ verseId: verse, direction: String(data.get("direction")), relationshipType: String(data.get("type")) || null });
    const box = mount.querySelector("#crossref-results");
    box.innerHTML = results.length ? results.map(r => `<article class="crossref-card"><div><strong>${escapeHtml(r.source_verse_id)}</strong> <span class="crossref-arrow">→</span> <strong>${escapeHtml(r.target_verse_id)}</strong></div><span class="pill">${escapeHtml(r.relationship_type)}</span>${r.votes != null ? `<span class="pill">votes ${escapeHtml(r.votes)}</span>` : ""}<p>${escapeHtml(r.notes || "No note supplied.")}</p><small>${escapeHtml(r.provenance?.provider || r.source || "Workbench")}</small></article>`).join("") : `<p class="muted">No local cross-references found for <strong>${escapeHtml(verse)}</strong>.</p>`;
  });
  mount.querySelector("#crossref-add").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await addCrossReference({ source_verse_id: String(data.get("source")).trim().toUpperCase(), target_verse_id: String(data.get("target")).trim().toUpperCase(), relationship_type: String(data.get("type")), notes: String(data.get("notes") || ""), source: "Pastor's Workbench — user-created", provenance: { provider: "user", kind: "personal" }, confidence: 1 });
    event.currentTarget.reset();
    await refreshStats();
    alert("Cross-reference saved locally.");
  });
  mount.querySelector("#install-openbible").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const status = mount.querySelector("#openbible-install-status");
    button.disabled = true;
    status.textContent = "Downloading and validating the full OpenBible corpus… This will fetch 1,189 chapter files and then store the validated relationships locally.";
    try {
      const result = await installFullOpenBibleCorpus({
        replace: true,
        concurrency: 8,
        onProgress: (progress) => {
          if (progress.phase === "download") status.textContent = `Downloading chapters: ${progress.completed.toLocaleString()} / ${progress.total.toLocaleString()} · references discovered ${progress.referenceRows.toLocaleString()}`;
          if (progress.phase === "store") status.textContent = `Storing validated relationships locally: ${progress.stored.toLocaleString()} / ${progress.imported?.toLocaleString?.() || FULL_OPENBIBLE_CORPUS_INFO.expectedReferences.toLocaleString()}`;
        }
      });
      status.textContent = `Installed ${result.imported.toLocaleString()} validated OpenBible relationships locally. The corpus is now offline-ready in this browser. Source: OpenBible.info · CC BY.`;
      await refreshStats();
    } catch (error) {
      status.textContent = `Full corpus installation failed: ${error.message || error}. The existing local corpus was not replaced unless validation completed.`;
    } finally {
      button.disabled = false;
    }
  });

  mount.querySelector("#crossref-import").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const file = form.elements.file.files[0];
    const status = mount.querySelector("#crossref-import-status");
    if (!file) return;
    status.textContent = `Reading ${file.name}…`;
    try {
      const text = await file.text();
      const result = await importCrossReferenceCorpus(text, { format: file.name.toLowerCase().endsWith(".json") ? "json" : "tsv", corpusId: String(form.elements.corpus.value || "openbible-info").trim() || "imported-corpus" });
      status.textContent = `Imported ${result.imported.toLocaleString()} relationships and rebuilt the local index.`;
      await refreshStats();
    } catch (error) {
      status.textContent = `Import failed: ${error.message || error}`;
    }
  });
  async function refreshStats(){
    const [s, idx] = await Promise.all([getCrossReferenceStats(), getCrossReferenceIndexStatus()]);
    const corpusNames = Object.keys(s.corpora).join(", ");
    mount.querySelector("#crossref-stats").innerHTML=`<div><span class="foundation-strip__label">Local relationships</span><strong>${s.total.toLocaleString()}</strong><span class="foundation-strip__ok">Stored</span></div><div><span class="foundation-strip__label">Index rows</span><strong>${idx.indexRows.toLocaleString()}</strong><span class="foundation-strip__ok">${idx.ready ? "Ready" : "Needs rebuild"}</span></div><div><span class="foundation-strip__label">Corpora</span><strong>${Object.keys(s.corpora).length}</strong><span class="foundation-strip__ok">${escapeHtml(corpusNames || "None")}</span></div>`;
    mount.querySelector("#crossref-index-status").textContent = `Index integrity: ${idx.ready ? "ready" : "needs rebuild"}. Each relationship has two lookup rows (incoming and outgoing).`;
  }
}
