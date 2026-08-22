import {
  deleteLesson, deleteProject, deleteSermon, deleteStudy, getLessonWorkspace, getSermonWorkspace,
  listProjects, normalizeLesson, normalizeProject, normalizeSermon, saveLesson, saveLessonSection,
  saveProject, saveSermon, saveSermonPoint, saveSermonStage, saveStudy, initializeSermonWorkflow, getSermonProgress
} from "../sermonService.js";
import { SERMON_STAGE_KEYS, EXPOSITORY_STAGE_KEYS, SERMON_STAGE_META } from "../dataModel.js";
import { listKnowledge, saveResearchItem, saveNote } from "../researchService.js";
import { getPassage, getAvailableBibleVersions } from "../bibleService.js";
import { search as searchConfession } from "../confessionService.js";
import { listCrossReferences } from "../crossReferenceService.js";
import { getProjectKnowledge, linkKnowledgeToProject, linkScripture, linkEntities, getEntityConnections, getConnectedBooks, linkBookToEntity, getConnectedDocuments, linkDocumentToEntity } from "../connectedKnowledgeService.js";

const esc = (v) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const label = (v) => String(v || "").replaceAll("_", " ").replace(/\b\w/g, m => m.toUpperCase());
const tabs = [["sermon", "Sermons"], ["lesson", "Lessons"], ["study", "Studies"], ["all", "Projects"]];

  async function mountConnectedDocuments(panel, entityType, entityId) {
    const section = document.createElement('section');
    section.className = 'reader-panel';
    section.style.marginTop = '1rem';
    section.innerHTML = `<div class="reader-panel__head"><div><p class="canvas__eyebrow">Connected Sources</p><h3>Files &amp; Documents</h3></div><span class="pill">Reusable source</span></div>
      <p class="muted">Attach local ministry files to this workspace without copying their contents. Attached documents are available to AI retrieval.</p>
      <div id="connected-documents-list" class="knowledge-list"></div>
      <div class="toolbar" style="margin-top:1rem"><input id="connected-doc-search" class="field" placeholder="Search imported documents…"><button id="connected-doc-search-button" class="text-button">Find</button></div>
      <div id="connected-doc-results" class="knowledge-list"></div>`;
    panel.appendChild(section);
    const list = section.querySelector('#connected-documents-list');
    const results = section.querySelector('#connected-doc-results');
    async function refreshAttached() {
      const docs = await getConnectedDocuments(entityType, entityId);
      list.innerHTML = docs.length ? docs.map(d => `<article class="knowledge-card"><div class="knowledge-card__head"><div><h4>${esc(d.title)}</h4><span class="pill">Document</span></div></div><p>${esc(d.filename || d.description || 'Local source file')}</p></article>`).join('') : '<div class="empty-state">No documents attached yet.</div>';
    }
    async function searchDocs() {
      const q = String(section.querySelector('#connected-doc-search').value || '').trim();
      const { listDocuments } = await import('../documentService.js');
      const docs = await listDocuments(q);
      results.innerHTML = docs.length ? docs.slice(0, 12).map(d => `<article class="knowledge-card"><div class="knowledge-card__head"><div><h4>${esc(d.title)}</h4><span class="pill">Document</span></div><button class="text-button" data-attach-document="${esc(d.id)}">Attach</button></div><p>${esc(d.filename || d.description || '')}</p></article>`).join('') : '<div class="empty-state">No matching documents.</div>';
      results.querySelectorAll('[data-attach-document]').forEach(btn => btn.onclick = async () => {
        await linkDocumentToEntity(entityType, entityId, btn.dataset.attachDocument);
        await refreshAttached();
        btn.textContent = 'Attached';
        btn.disabled = true;
      });
    }
    section.querySelector('#connected-doc-search-button').onclick = searchDocs;
    section.querySelector('#connected-doc-search').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); searchDocs(); } });
    await refreshAttached();
  }


export async function render(mount, route = {}) {
  const initial = route.id === "sermons" ? "sermon" : route.id === "lessons" ? "lesson" : route.id === "studies" ? "study" : "all";
  mount.innerHTML = `<div class="canvas__header"><p class="canvas__eyebrow">Phase 7 · Workbench</p><h1 class="canvas__title">Sermons, Lessons &amp; Studies</h1><p class="canvas__dek">Build teaching projects from structured stages, reusable research, and manuscript material. Nothing is generated or finalized automatically.</p></div><nav class="knowledge-tabs" aria-label="Work sections">${tabs.map(([id,text])=>`<button class="knowledge-tab" data-tab="${id}">${text}</button>`).join("")}</nav><section id="work-panel"></section>`;
  mount.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => show(b.dataset.tab)));
  await show(initial);
  const pending = globalThis.__pwbPendingProjectOpen;
  if (pending?.id) {
    delete globalThis.__pwbPendingProjectOpen;
    const projects = await listProjects();
    const project = projects.find(p => p.id === pending.id);
    if (project) {
      const panel = mount.querySelector("#work-panel");
      const tab = project.project_type === "sermon" || project.project_type === "lesson" || project.project_type === "study" ? project.project_type : "all";
      await show(tab);
      await openProject(panel, project.id, project.project_type);
    }
  }

  async function show(tab) {
    mount.querySelectorAll("[data-tab]").forEach(b => b.classList.toggle("knowledge-tab--active", b.dataset.tab === tab));
    const panel = mount.querySelector("#work-panel");
    if (tab === "sermon") return renderProjects(panel, "sermon");
    if (tab === "lesson") return renderProjects(panel, "lesson");
    if (tab === "study") return renderProjects(panel, "study");
    return renderProjects(panel, null);
  }

  async function renderProjects(panel, type) {
    const projects = await listProjects({ type });
    panel.innerHTML = `<section class="study-grid"><article class="reader-panel"><div class="reader-panel__head"><div><p class="canvas__eyebrow">New</p><h2>Create a ${type ? label(type) : "Project"}</h2></div></div>${projectForm(type)}</article><article class="reader-panel"><div class="reader-panel__head"><div><p class="canvas__eyebrow">Workflow</p><h2>Structured preparation</h2></div></div><p class="muted">Projects are containers. Sermons, lessons, and studies store their own structured content inside the container so research can be reused without copying it.</p><div class="pill-list"><span class="pill">Research</span><span class="pill">Scripture</span><span class="pill">Outline</span><span class="pill">Manuscript</span><span class="pill">Application</span></div></article></section><section class="reader-panel" style="margin-top:1rem"><div class="reader-panel__head"><div><p class="canvas__eyebrow">Projects</p><h2>${type ? label(type) : "All projects"}</h2></div></div><div class="knowledge-list">${projects.length ? projects.map(projectCard).join("") : `<div class="empty-state">No projects yet.</div>`}</div></section>`;
    panel.querySelector("form")?.addEventListener("submit", async e => { e.preventDefault(); const d = new FormData(e.currentTarget); const project = await saveProject({ title:d.get("title"), description:d.get("description"), project_type:d.get("project_type"), status:"draft" }); if (project.project_type === "sermon") { const sermon = await saveSermon({ project_id:project.id, title:project.title, primary_text:"", sermon_intent:"", text_intent:"", structure:{}, manuscript:"", status:"draft" }); await initializeSermonWorkflow(sermon.id); } if (project.project_type === "lesson") await saveLesson({ project_id:project.id, title:project.title }); if (project.project_type === "study") await saveStudy({ project_id:project.id, title:project.title }); await renderProjects(panel,type); });
    panel.querySelectorAll("[data-open]").forEach(b=>b.addEventListener("click",()=>openProject(panel,b.dataset.open,b.dataset.type)));
    panel.querySelectorAll("[data-delete-project]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("Delete this project and its structured content?"))return;await deleteProject(b.dataset.deleteProject);await renderProjects(panel,type);}));
  }

  function projectForm(type) { return `<form class="tool-form"><label>Title<input name="title" required placeholder="${type === "sermon" ? "Sermon on 1 John 1:1–4" : type === "lesson" ? "Christian Discipleship — Week 1" : type === "study" ? "Romans 9 Study" : "New Workbench Project"}"></label><label>Type<select name="project_type">${["sermon","lesson","study","research","writing","general"].map(v=>`<option value="${v}" ${v===type?"selected":""}>${label(v)}</option>`).join("")}</select></label><label>Description<textarea name="description" rows="4"></textarea></label><button class="button button--primary">Create Project</button></form>`; }
  function projectCard(p) { return `<article class="knowledge-card"><div class="knowledge-card__head"><div><h3>${esc(p.title)}</h3><div class="pill-list"><span class="pill">${esc(label(p.project_type))}</span><span class="pill">${esc(label(p.status))}</span></div></div><button class="text-button text-button--danger" data-delete-project="${esc(p.id)}">Delete</button></div><p>${esc(p.description || "No description.")}</p><div class="knowledge-card__actions"><button class="text-button" data-open="${esc(p.id)}" data-type="${esc(p.project_type)}">Open workspace</button></div></article>`; }

  async function openProject(panel, projectId, type) {
    if (type === "sermon") return openSermon(panel, projectId);
    if (type === "lesson") return openLesson(panel, projectId);
    if (type === "study") return openStudy(panel, projectId);
    globalThis.__pwbCurrentEntity = { type: 'Project', id: projectId };
    const projects = await listProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    panel.innerHTML = `<div class="reader-panel"><div class="reader-panel__head"><div><p class="canvas__eyebrow">Project workspace</p><h2>${esc(project.title)}</h2></div><button class="text-button" id="back">Back</button></div>
      <p>${esc(project.description || 'General Workbench project.')}</p>
      <div id="project-connected-sources" style="margin-top:1rem"></div></div>`;
    panel.querySelector("#back").onclick=()=>renderProjects(panel,type);
    await mountGenericProjectSources(panel.querySelector("#project-connected-sources"), projectId);
  }

  async function mountGenericProjectSources(panel, projectId) {
    panel.innerHTML = `<section class="reader-panel"><div class="reader-panel__head"><div><p class="canvas__eyebrow">Connected Sources</p><h3>Project knowledge</h3></div><span class="pill">Reusable</span></div>
      <p class="muted">Connect notes, research, books, and documents without duplicating their contents. These relationships are available to Universal Search and AI context.</p>
      <div id="project-source-list" class="knowledge-list"></div>
      <div class="toolbar" style="margin-top:1rem"><input id="project-doc-q" class="field" placeholder="Search documents…"><button id="project-doc-find" class="text-button">Find</button></div>
      <div id="project-doc-results" class="knowledge-list"></div></section>`;
    const list = panel.querySelector('#project-source-list');
    async function refresh() {
      const rows = await getProjectKnowledge(projectId);
      const docs = await getConnectedDocuments('Project', projectId);
      const books = await getConnectedBooks('Project', projectId);
      const connections = await getEntityConnections('Project', projectId);
      const scriptureCount = connections.filter(r => r.target_type === 'BibleVerse' || r.source_type === 'BibleVerse').length;
      const cards = [
        ...rows.map(r => `<article class="knowledge-card"><div class="knowledge-card__head"><div><span class="pill">${esc(r._type)}</span><h4>${esc(r.title || r.name)}</h4></div></div><p>${esc(r.content || r.description || '')}</p></article>`),
        ...books.map(b => `<article class="knowledge-card"><div class="knowledge-card__head"><div><span class="pill">Book</span><h4>${esc(b.title)}</h4></div></div><p>${esc(b.author || 'Indexed library source')}</p></article>`),
        ...docs.map(d => `<article class="knowledge-card"><div class="knowledge-card__head"><div><span class="pill">Document</span><h4>${esc(d.title)}</h4></div></div><p>${esc(d.filename || 'Local source file')}</p></article>`)
      ];
      list.innerHTML = cards.length ? cards.join('') : '<div class="empty-state">No connected sources yet.</div>';
      if (scriptureCount) list.insertAdjacentHTML('afterbegin', `<p class="muted">Connected Scripture references: ${scriptureCount}</p>`);
    }
    async function findDocuments() {
      const q = panel.querySelector('#project-doc-q').value.trim();
      if (!q) return;
      const { listDocuments } = await import('../documentService.js');
      const docs = await listDocuments(q);
      panel.querySelector('#project-doc-results').innerHTML = docs.slice(0,12).map(d => `<article class="knowledge-card"><div class="knowledge-card__head"><div><span class="pill">Document</span><h4>${esc(d.title)}</h4></div><button class="text-button" data-project-doc="${esc(d.id)}">Attach</button></div><p>${esc(d.filename || '')}</p></article>`).join('') || '<div class="empty-state">No matching documents.</div>';
      panel.querySelectorAll('[data-project-doc]').forEach(btn => btn.onclick = async () => { await linkDocumentToEntity('Project', projectId, btn.dataset.projectDoc); btn.textContent='Attached'; btn.disabled=true; await refresh(); });
    }
    panel.querySelector('#project-doc-find').onclick = findDocuments;
    panel.querySelector('#project-doc-q').addEventListener('keydown', e => { if (e.key==='Enter') { e.preventDefault(); findDocuments(); }});
    await refresh();
  }

  async function openSermon(panel, projectId) {
    const projects = await listProjects();
    const project = projects.find(p => p.id === projectId);
    const sermon = await getSermonWorkspaceByProject(projectId);
    if (!sermon) return;
    await initializeSermonWorkflow(sermon.sermon.id);
    const w = await getSermonWorkspaceByProject(projectId);
    globalThis.__pwbCurrentEntity = { type: 'Sermon', id: w.sermon.id };
    const stageMap = Object.fromEntries(w.stages.map(s => [s.stage_key, s]));
    const progress = await getSermonProgress(w.sermon.id);
    const preparationKeys = EXPOSITORY_STAGE_KEYS;
    let activeStage = preparationKeys.find(k => !(stageMap[k]?.content || '').trim()) || preparationKeys[0];

    const stageOptions = () => preparationKeys.map(k => {
      const meta = SERMON_STAGE_META[k];
      const done = !!(stageMap[k]?.content || '').trim();
      return `<option value="${k}" ${k===activeStage?'selected':''}>${meta.number}. ${esc(meta.title)}${done ? ' — Complete' : ''}</option>`;
    }).join('');

    const richToolbar = (id) => `<div class="rich-toolbar" data-toolbar-for="${id}">
      <button type="button" data-cmd="bold"><strong>B</strong></button>
      <button type="button" data-cmd="italic"><em>I</em></button>
      <button type="button" data-cmd="underline"><u>U</u></button>
      <button type="button" data-cmd="insertUnorderedList">• List</button>
      <button type="button" data-cmd="insertOrderedList">1. List</button>
      <button type="button" data-cmd="formatBlock" data-value="blockquote">Quote</button>
      <select data-format-size aria-label="Font size"><option value="">Size</option><option value="2">Small</option><option value="3">Normal</option><option value="4">Large</option><option value="5">XL</option></select>
      <button type="button" data-cmd="removeFormat">Clear</button>
    </div>`;

    const sanitizeRich = (html='') => String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/ on[a-z]+\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+)/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/<\/?(?!p\b|br\b|strong\b|b\b|em\b|i\b|u\b|ul\b|ol\b|li\b|blockquote\b|h[1-6]\b|div\b|span\b)[^>]+>/gi, '');

    const getRich = (id) => sanitizeRich(panel.querySelector(`#${id}`)?.innerHTML || '');
    const wireRichEditors = () => {
      panel.querySelectorAll('.rich-editor').forEach(editor => {
        editor.addEventListener('input', () => editor.dataset.dirty = '1');
        editor.addEventListener('paste', () => setTimeout(() => { editor.innerHTML = sanitizeRich(editor.innerHTML); }, 0));
      });
      panel.querySelectorAll('.rich-toolbar button[data-cmd]').forEach(btn => btn.addEventListener('mousedown', e => {
        e.preventDefault();
        const toolbar = btn.closest('.rich-toolbar');
        const editor = panel.querySelector(`#${toolbar.dataset.toolbarFor}`);
        editor?.focus();
        document.execCommand(btn.dataset.cmd, false, btn.dataset.value || null);
      }));
      panel.querySelectorAll('.rich-toolbar select[data-format-size]').forEach(select => select.addEventListener('change', e => {
        const toolbar = select.closest('.rich-toolbar');
        const editor = panel.querySelector(`#${toolbar.dataset.toolbarFor}`);
        editor?.focus();
        if (e.target.value) document.execCommand('fontSize', false, e.target.value);
        e.target.value = '';
      }));
    };

    const renderStage = () => {
      const meta = SERMON_STAGE_META[activeStage];
      const value = stageMap[activeStage]?.content || '';
      const done = !!value.trim();
      const index = preparationKeys.indexOf(activeStage);
      const previous = preparationKeys[index-1];
      const next = preparationKeys[index+1];
      const priorIncomplete = preparationKeys.slice(0,index).filter(k => !(stageMap[k]?.content || '').trim()).length;
      panel.querySelector('#stage-editor').innerHTML = `<div class="reader-panel__head"><div><p class="canvas__eyebrow">Step ${meta.number} of 8</p><h3>${esc(meta.title)}</h3><p class="muted">${esc(meta.focus)}</p></div><span class="pill">${done ? 'Complete' : 'In progress'}</span></div>
        <div class="foundation-strip"><div><span class="foundation-strip__label">Better question</span><strong>${esc(meta.prompt)}</strong></div>${priorIncomplete ? `<p class="muted">${priorIncomplete} earlier step${priorIncomplete===1?' is':'s are'} incomplete. The workflow is designed to move from the text toward intent, structure, and preaching.</p>` : ''}</div>
        ${richToolbar('active-stage-content')}<div id="active-stage-content" class="rich-editor" contenteditable="true" data-placeholder="Work this step here. Use your own observations and conclusions; keep them grounded in the biblical text.">${sanitizeRich(value)}</div>
        <div class="workflow-actions"><button class="button button--primary button--large" id="save-active-stage">Save Step ${meta.number}</button>${previous?`<button class="button button--secondary button--large" id="previous-stage">Previous</button>`:''}${next?`<button class="button button--primary button--large" id="next-stage">Save &amp; Next</button>`:''}</div>`;
      wireRichEditors();
      panel.querySelector('#save-active-stage').onclick = async () => { const content=getRich('active-stage-content'); await saveSermonStage({...stageMap[activeStage], sermon_id:w.sermon.id, stage_key:activeStage, content}); stageMap[activeStage]={...(stageMap[activeStage]||{}), sermon_id:w.sermon.id, stage_key:activeStage, content}; await refresh(); };
      panel.querySelector('#previous-stage')?.addEventListener('click', async()=>{ await saveCurrentSilently(); activeStage=previous; panel.querySelector('#stage-select').value=activeStage; renderStage(); });
      panel.querySelector('#next-stage')?.addEventListener('click', async()=>{ await saveCurrentSilently(); activeStage=next; panel.querySelector('#stage-select').value=activeStage; renderStage(); });
    };

    const saveCurrentSilently = async () => { const el=panel.querySelector('#active-stage-content'); if(!el)return; const content=sanitizeRich(el.innerHTML); await saveSermonStage({...stageMap[activeStage], sermon_id:w.sermon.id, stage_key:activeStage, content}); stageMap[activeStage]={...(stageMap[activeStage]||{}), sermon_id:w.sermon.id, stage_key:activeStage, content}; };
    const refresh = async () => { const latest=await getSermonWorkspaceByProject(projectId); const latestProgress=await getSermonProgress(w.sermon.id); panel.querySelector('#progress-count').textContent=`${latestProgress.completed}/8 steps complete`; panel.querySelector('#progress-bar').style.width=`${latestProgress.percent}%`; const freshMap=Object.fromEntries(latest.stages.map(s=>[s.stage_key,s])); Object.assign(stageMap,freshMap); panel.querySelector('#stage-select').innerHTML=stageOptions(); renderStage(); };

    panel.innerHTML = `<div class="reader-panel sermon-workspace"><div class="reader-panel__head"><div><p class="canvas__eyebrow">Expository Sermon Engine</p><h2>${esc(w.sermon.title)}</h2><p class="muted">${esc(project?.description || '')}</p></div><button class="text-button" id="back">Back</button></div>
      <div class="foundation-strip"><div><span class="foundation-strip__label">Primary text</span><strong>${esc(w.sermon.primary_text || 'Not set')}</strong><span class="foundation-strip__ok" id="progress-count">${progress.completed}/8 steps complete</span></div><div style="min-width:220px"><div class="progress-track"><div id="progress-bar" class="progress-track__bar" style="width:${progress.percent}%"></div></div></div></div>
      <section class="reader-panel workflow-foundation"><div class="reader-panel__head"><div><p class="canvas__eyebrow">Start here</p><h3>Passage &amp; sermon identity</h3></div></div><form id="sermon-core" class="tool-form"><div class="study-grid"><label>Primary text<input name="primary_text" value="${esc(w.sermon.primary_text)}" placeholder="1 John 1:1–4"></label><label>Working title<input name="title" value="${esc(w.sermon.title)}"></label></div><label>Text intent<textarea name="text_intent" rows="4" placeholder="What is the passage saying? Keep this concise and text-driven.">${esc(w.sermon.text_intent)}</textarea></label><label>Sermon intent<textarea name="sermon_intent" rows="4" placeholder="What should this congregation understand, believe, or do because this text is preached?">${esc(w.sermon.sermon_intent)}</textarea></label><button class="button button--primary button--large">Save foundation</button></form></section>
      <section class="workflow-section project-knowledge-section">
        <div class="workflow-section__header">
          <div><p class="canvas__eyebrow">Connected knowledge</p><h3>Research &amp; Notes for this sermon</h3>
          <p class="muted">Bring your existing Phase 6 research into this project without copying it into the sermon. New research created here stays attached to this sermon.</p></div>
        </div>
        <div class="project-knowledge-grid">
          <div class="reader-panel">
            <div class="reader-panel__head"><div><h4>Attach existing knowledge</h4><p class="muted">Search your local research and notes, then attach the record to this sermon.</p></div></div>
            <div class="search-row"><input id="knowledge-search" placeholder="Search research or notes..." aria-label="Search research or notes"><button class="button" id="knowledge-search-button">Search</button></div>
            <div id="knowledge-results" class="knowledge-list"></div>
          </div>
          <div class="reader-panel">
            <div class="reader-panel__head"><div><h4>Add a research item</h4><p class="muted">Use this for an observation, question, argument, word study, application, or other structured research.</p></div></div>
            <form id="project-research-form" class="tool-form">
              <label>Title<input name="title" required placeholder="Observation from the passage"></label>
              <label>Type<select name="research_type">${["observation","question","argument","counterargument","linguistic","theological_connection","application","conclusion"].map(v=>`<option value="${v}">${label(v)}</option>`).join("")}</select></label>
              <label>Content<textarea name="content" rows="5" required placeholder="Record the research here..."></textarea></label>
              <button class="button button--primary">Save Research</button>
            </form>
            <form id="project-note-form" class="tool-form" style="margin-top:1rem">
              <label>Quick note title<input name="title" required placeholder="Pastoral note"></label>
              <label>Note<textarea name="content" rows="4" required placeholder="Write a personal note..."></textarea></label>
              <button class="button">Save Note</button>
            </form>
          </div>
        </div>
        <div id="attached-knowledge" class="knowledge-list" style="margin-top:1rem"></div>
      </section>
      <section class="workflow-section connected-books-section">
        <div class="workflow-section__header"><div><p class="canvas__eyebrow">Connected library</p><h3>Books for this sermon</h3><p class="muted">Attach books already indexed in Workbench. The sermon keeps a relationship to the source instead of copying the book into the sermon.</p></div></div>
        <div class="search-row"><input id="sermon-book-search" placeholder="Search your indexed books..." aria-label="Search books"><button class="button" id="sermon-book-search-button">Search</button></div>
        <div id="sermon-book-results" class="knowledge-list"></div><div id="sermon-connected-books" class="knowledge-list" style="margin-top:1rem"></div>
      </section>
      <section class="workflow-section sermon-research-desk"><div class="workflow-section__header"><div><p class="canvas__eyebrow">Integrated study desk</p><h3>Scripture, Confession &amp; Cross-References</h3><p class="muted">Research the primary text and supporting theology without leaving the sermon. Results can be inserted into the current preparation step as provisional working material.</p></div></div>
        <div class="study-grid">
          <article class="reader-panel"><div class="reader-panel__head"><div><h4>Scripture passage</h4><p class="muted">Load a passage from a locally available translation.</p></div></div>
            <form id="sermon-scripture-form" class="tool-form"><label>Reference<input name="reference" value="${esc(w.sermon.primary_text || '')}" placeholder="John 3:16-18"></label><label>Translation<select name="translation" id="sermon-translation"></select></label><button class="button">Load passage</button></form><div id="sermon-scripture-results" class="knowledge-list"></div>
          </article>
          <article class="reader-panel"><div class="reader-panel__head"><div><h4>1689 Confession</h4><p class="muted">Search the verified local confession and its paragraph text.</p></div></div>
            <form id="sermon-confession-form" class="search-row"><input name="query" placeholder="Search doctrine or phrase"><button class="button">Search</button></form><div id="sermon-confession-results" class="knowledge-list"></div>
          </article>
          <article class="reader-panel"><div class="reader-panel__head"><div><h4>Cross-references</h4><p class="muted">Find stored relationships for a canonical verse.</p></div></div>
            <form id="sermon-cross-form" class="search-row"><input name="verse" placeholder="john-3-16"><button class="button">Find</button></form><div id="sermon-cross-results" class="knowledge-list"></div>
          </article>
        </div>
      </section>
      <section class="workflow-section"><div class="workflow-section__header"><div><p class="canvas__eyebrow">MacArthur-aligned preparation</p><h3>Eight-step expository workflow</h3><p class="muted">Choose a step from the dropdown and work downward. The application saves each step independently.</p></div><div class="workflow-step-select"><label for="stage-select">Current step<select id="stage-select">${stageOptions()}</select></label></div></div><article id="stage-editor" class="reader-panel"></article></section>
      <section class="workflow-section manuscript-section"><div class="workflow-section__header"><div><p class="canvas__eyebrow">After the eight steps</p><h3>Write the manuscript</h3><p class="muted">Finish your exegesis and sermon preparation first. Then write the sermon in full prose. Your preaching points come after the manuscript is complete.</p></div></div>${richToolbar('manuscript-editor')}<div id="manuscript-editor" class="rich-editor rich-editor--manuscript" contenteditable="true" data-placeholder="Write the sermon manuscript here...">${sanitizeRich(w.sermon.manuscript || '')}</div><div class="workflow-actions"><button class="button button--primary button--large" id="save-manuscript">Save Manuscript</button></div></section>
      <section class="workflow-section"><div class="workflow-section__header"><div><p class="canvas__eyebrow">After the manuscript</p><h3>Derive the preaching points</h3><p class="muted">Your manuscript comes first. Once it is saved, build the preaching points from the finished manuscript and the structure already established in the text.</p></div></div><div id="outline-list"></div>${w.sermon.manuscript?.trim() ? `<form id="point-form" class="tool-form"><label>Point title<input name="title" required placeholder="Main preaching point"></label>${richToolbar('point-explanation')}<div id="point-explanation" class="rich-editor" contenteditable="true" data-placeholder="Explain the point from the text..."></div>${richToolbar('point-illustration')}<div id="point-illustration" class="rich-editor" contenteditable="true" data-placeholder="Illustration (optional)..."></div>${richToolbar('point-application')}<div id="point-application" class="rich-editor" contenteditable="true" data-placeholder="Application (optional)..."></div><button class="button button--primary button--large">Add preaching point</button></form>` : `<div class="foundation-strip"><div><span class="foundation-strip__label">Locked until manuscript</span><strong>Write and save the manuscript first.</strong></div><p class="muted">This keeps the workflow in the order you requested: eight-step preparation → manuscript → preaching points.</p></div>`}</section>
      <section class="workflow-section"><div class="workflow-section__header"><div><p class="canvas__eyebrow">Review</p><h3>Post-sermon review</h3></div></div>${richToolbar('review-editor')}<div id="review-editor" class="rich-editor" contenteditable="true" data-placeholder="What was clear? What was unclear? What should be improved next time?">${sanitizeRich(stageMap.post_sermon_review?.content || '')}</div><div class="workflow-actions"><button class="button button--primary button--large" id="save-review">Save Review</button></div></section></div>`;

    panel.querySelector('#back').onclick=()=>renderProjects(panel,'sermon');
    panel.querySelector('#sermon-core').onsubmit=async e=>{e.preventDefault();const d=new FormData(e.currentTarget);await saveSermon({...w.sermon,title:d.get('title'),primary_text:d.get('primary_text'),text_intent:d.get('text_intent'),sermon_intent:d.get('sermon_intent')});await openSermon(panel,projectId);};
    const renderProjectKnowledge = async (search = "") => {
      const rows = await listKnowledge({ type: "all", search });
      const candidates = rows.filter(r => ["ResearchItem","Note"].includes(r._store === "research_items" ? "ResearchItem" : r._store === "notes" ? "Note" : "") && r.project_id !== projectId);
      const attached = rows.filter(r => r.project_id === projectId);
      panel.querySelector('#knowledge-results').innerHTML = candidates.length
        ? candidates.slice(0, 30).map(r => {
            const type = r._store === "research_items" ? "ResearchItem" : "Note";
            return `<article class="knowledge-card"><div class="knowledge-card__head"><div><h4>${esc(r.title)}</h4><span class="pill">${esc(type === "ResearchItem" ? label(r.research_type) : label(r.note_type))}</span></div><button class="text-button" data-attach-knowledge="${esc(r.id)}" data-attach-type="${type}">Attach</button></div><p>${esc(r.content).slice(0,320)}${r.content.length>320?"…":""}</p></article>`;
          }).join("")
        : '<div class="empty-state">No unattached research or notes matched that search.</div>';
      panel.querySelector('#attached-knowledge').innerHTML = `<div class="reader-panel__head"><div><p class="canvas__eyebrow">Attached</p><h4>${attached.length} connected record${attached.length===1?"":"s"}</h4></div></div>` +
        (attached.length ? attached.map(r => `<article class="knowledge-card"><div class="knowledge-card__head"><div><h4>${esc(r.title)}</h4><span class="pill">${esc(r._store === "research_items" ? label(r.research_type) : label(r.note_type))}</span></div></div><p>${esc(r.content)}</p></article>`).join("") : '<div class="empty-state">Nothing is attached yet. Attach existing knowledge or create a new item above.</div>');
      panel.querySelectorAll('[data-attach-knowledge]').forEach(btn => btn.onclick = async () => {
        const type = btn.dataset.attachType;
        const row = rows.find(r => r.id === btn.dataset.attachKnowledge);
        if (!row) return;
        if (type === "ResearchItem") await saveResearchItem({ ...row, project_id: projectId });
        else await saveNote({ ...row, project_id: projectId });
        await renderProjectKnowledge(panel.querySelector('#knowledge-search').value);
      });
    };
    panel.querySelector('#knowledge-search-button').onclick = () => renderProjectKnowledge(panel.querySelector('#knowledge-search').value);
    panel.querySelector('#knowledge-search').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); renderProjectKnowledge(e.currentTarget.value); } };
    panel.querySelector('#project-research-form').onsubmit = async e => {
      e.preventDefault(); const d = new FormData(e.currentTarget);
      await saveResearchItem({ project_id: projectId, title: d.get('title'), research_type: d.get('research_type'), content: d.get('content'), origin: 'personal' });
      e.currentTarget.reset(); await renderProjectKnowledge(panel.querySelector('#knowledge-search').value);
    };
    panel.querySelector('#project-note-form').onsubmit = async e => {
      e.preventDefault(); const d = new FormData(e.currentTarget);
      await saveNote({ project_id: projectId, title: d.get('title'), content: d.get('content'), note_type: 'sermon_note', origin: 'personal' });
      e.currentTarget.reset(); await renderProjectKnowledge(panel.querySelector('#knowledge-search').value);
    };
    await renderProjectKnowledge();
    const availableVersions = await getAvailableBibleVersions();
    panel.querySelector('#sermon-translation').innerHTML = availableVersions.map(v => `<option value="${esc(v.id)}" ${v.id === 'KJV' ? 'selected' : ''}>${esc(v.name)} (${esc(v.abbreviation || v.id)})</option>`).join('');
    const parseReference = raw => { const m=String(raw||'').trim().match(/^(.*)\s+(\d+):(\d+)(?:[-–](\d+))?$/); return m ? { book:m[1], chapter:Number(m[2]), start:Number(m[3]), end:Number(m[4]||m[3]) } : null; };
    const insertIntoCurrentStep = text => { const editor=panel.querySelector('#active-stage-content'); if(!editor)return; editor.focus(); document.execCommand('insertText',false,text); };
    panel.querySelector('#sermon-scripture-form').onsubmit=async e=>{e.preventDefault(); const d=new FormData(e.currentTarget); const ref=parseReference(d.get('reference')); const box=panel.querySelector('#sermon-scripture-results'); if(!ref){box.innerHTML='<div class="empty-state">Use a reference such as John 3:16-18.</div>';return;} const verses=await getPassage(ref.book,ref.chapter,ref.start,ref.end,d.get('translation')); box.innerHTML=verses?.length ? `<article class="knowledge-card"><div class="knowledge-card__head"><div><h4>${esc(ref.book)} ${ref.chapter}:${ref.start}${ref.end!==ref.start?'–'+ref.end:''}</h4><span class="pill">${esc(d.get('translation'))}</span></div><button class="text-button" id="insert-scripture">Insert into current step</button></div>${verses.map(v=>`<p><strong>${esc(v.verse)}</strong> ${esc(v.text)}</p>`).join('')}</article>` : '<div class="empty-state">Passage not available in the selected translation. If it has not been downloaded/imported, use Settings &gt; Bible.</div>'; panel.querySelector('#insert-scripture')?.addEventListener('click',()=>insertIntoCurrentStep(`${ref.book} ${ref.chapter}:${ref.start}${ref.end!==ref.start?'–'+ref.end:''} (${d.get('translation')})`)); };
    panel.querySelector('#sermon-confession-form').onsubmit=async e=>{e.preventDefault(); const q=new FormData(e.currentTarget).get('query'); const rows=await searchConfession(q,'all'); panel.querySelector('#sermon-confession-results').innerHTML=rows.length ? rows.slice(0,12).map(r=>`<article class="knowledge-card"><div class="knowledge-card__head"><div><h4>${esc(r.type==='paragraph'?'Chapter '+r.chapter_number+', Paragraph '+r.paragraph_number:r.title)}</h4><span class="pill">${esc(r.type)}</span></div><button class="text-button" data-insert-conf="${esc(r.id)}">Insert reference</button></div><p>${esc(r.text || '')}</p></article>`).join('') : '<div class="empty-state">No confession results found.</div>'; panel.querySelectorAll('[data-insert-conf]').forEach(b=>b.onclick=()=>{const r=rows.find(x=>x.id===b.dataset.insertConf); if(r)insertIntoCurrentStep(`1689 London Baptist Confession — Chapter ${r.chapter_number}, Paragraph ${r.paragraph_number}`);}); };
    panel.querySelector('#sermon-cross-form').onsubmit=async e=>{e.preventDefault(); const verse=String(new FormData(e.currentTarget).get('verse')||'').trim(); const rows=await listCrossReferences({verseId:verse,direction:'both'}); panel.querySelector('#sermon-cross-results').innerHTML=rows.length ? rows.slice(0,20).map(r=>`<article class="knowledge-card"><div class="knowledge-card__head"><div><h4>${esc(r.source_verse_id)} ↔ ${esc(r.target_verse_id)}</h4><span class="pill">${esc(r.relationship_type)}</span></div><button class="text-button" data-insert-xref="${esc(r.id)}">Insert</button></div><p>${esc(r.notes || 'Stored cross-reference')}</p></article>`).join('') : '<div class="empty-state">No stored cross-references found. Use canonical IDs such as john-3-16.</div>'; panel.querySelectorAll('[data-insert-xref]').forEach(b=>b.onclick=()=>{const r=rows.find(x=>x.id===b.dataset.insertXref);if(r)insertIntoCurrentStep(`${r.source_verse_id} ↔ ${r.target_verse_id}`);}); };
    panel.querySelector('#stage-select').onchange=e=>{activeStage=e.target.value;renderStage();};
    panel.querySelector('#save-manuscript').onclick=async()=>{await saveSermon({...w.sermon,manuscript:getRich('manuscript-editor')});await openSermon(panel,projectId);};
    panel.querySelector('#save-review').onclick=async()=>{const content=getRich('review-editor');await saveSermonStage({...stageMap.post_sermon_review,sermon_id:w.sermon.id,stage_key:'post_sermon_review',content});await openSermon(panel,projectId);};
    panel.querySelector('#point-form')?.addEventListener('submit',async e=>{e.preventDefault();const d=new FormData(e.currentTarget);await saveSermonPoint({sermon_id:w.sermon.id,position:w.points.length+1,title:d.get('title'),explanation:getRich('point-explanation'),illustration:getRich('point-illustration'),application:getRich('point-application')});await openSermon(panel,projectId);});
    wireRichEditors();
    renderStage();
    const renderOutline = () => { const points = w.points.map(p=>`<article class="knowledge-card"><div class="knowledge-card__head"><div><h4>${esc(p.position + '. ' + p.title)}</h4></div></div><div class="rich-preview">${sanitizeRich(p.explanation || '')}</div>${p.illustration?`<div class="rich-preview"><strong>Illustration:</strong> ${sanitizeRich(p.illustration)}</div>`:''}${p.application?`<div class="rich-preview"><strong>Application:</strong> ${sanitizeRich(p.application)}</div>`:''}</article>`).join(''); panel.querySelector('#outline-list').innerHTML = points || '<div class="empty-state">Your preaching points will appear here after you complete the manuscript.</div>'; };
    const renderConnectedBooks = async () => { const books = await getConnectedBooks('Sermon', w.sermon.id); panel.querySelector('#sermon-connected-books').innerHTML = books.length ? `<p class="muted">Attached books</p>` + books.map(b=>`<article class="knowledge-card"><div class="knowledge-card__head"><div><h4>${esc(b.title)}</h4><span class="pill">Book</span></div></div><p>${esc(b.author || b.filename || '')}</p></article>`).join('') : '<div class="empty-state">No books attached to this sermon yet.</div>'; };
    const searchSermonBooks = async () => { const q=String(panel.querySelector('#sermon-book-search').value||'').trim(); const { listBooks } = await import('../libraryService.js'); const books=await listBooks(q); panel.querySelector('#sermon-book-results').innerHTML = books.length ? books.slice(0,12).map(b=>`<article class="knowledge-card"><div class="knowledge-card__head"><div><h4>${esc(b.title)}</h4><span class="pill">${esc(b.author || 'Book')}</span></div><button class="text-button" data-attach-sermon-book="${esc(b.id)}">Attach</button></div><p>${esc(b.description || b.filename || '')}</p></article>`).join('') : '<div class="empty-state">No matching books.</div>'; panel.querySelectorAll('[data-attach-sermon-book]').forEach(btn=>btn.onclick=async()=>{await linkBookToEntity('Sermon',w.sermon.id,btn.dataset.attachSermonBook);await renderConnectedBooks();btn.textContent='Attached';btn.disabled=true;}); };
    panel.querySelector('#sermon-book-search-button')?.addEventListener('click',searchSermonBooks); panel.querySelector('#sermon-book-search')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchSermonBooks();}}); await renderConnectedBooks();
    renderOutline();
    await mountConnectedDocuments(panel, 'Sermon', w.sermon.id);
  }

  async function getSermonWorkspaceByProject(projectId){ const rows=await listProjects({}); const p=rows.find(x=>x.id===projectId); if(!p)return null; const sermons=await import("../sermonService.js").then(m=>m.listSpecialized("sermon")); const s=sermons.find(x=>x.project_id===projectId); return s ? getSermonWorkspace(s.id) : null; }

  async function openLesson(panel, projectId) {
    const lessonRows=await import("../sermonService.js").then(m=>m.listSpecialized("lesson")); const lesson=lessonRows.find(x=>x.project_id===projectId); if(!lesson)return;
    const w=await getLessonWorkspace(lesson.id); globalThis.__pwbCurrentEntity = { type: 'Lesson', id: lesson.id }; panel.innerHTML=`<div class="reader-panel"><div class="reader-panel__head"><div><p class="canvas__eyebrow">Lesson workspace</p><h2>${esc(w.lesson.title)}</h2></div><button class="text-button" id="back">Back</button></div><form id="lesson-core" class="tool-form"><label>Subtitle<input name="subtitle" value="${esc(w.lesson.subtitle)}"></label><label>Purpose<textarea name="purpose" rows="3">${esc(w.lesson.purpose)}</textarea></label><label>Overview<textarea name="overview" rows="4">${esc(w.lesson.overview)}</textarea></label><label>Key truth<textarea name="key_truth" rows="3">${esc(w.lesson.key_truth)}</textarea></label><label>Key Scripture<input name="key_scripture" value="${esc(w.lesson.key_scripture)}"></label><label>Personal application<textarea name="personal_application" rows="3">${esc(w.lesson.personal_application)}</textarea></label><label>Memory verse<input name="memory_verse" value="${esc(w.lesson.memory_verse)}"></label><label>Takeaway<textarea name="takeaway" rows="3">${esc(w.lesson.takeaway)}</textarea></label><button class="button button--primary">Save lesson</button></form><section class="reader-panel" style="margin-top:1rem"><div class="reader-panel__head"><div><p class="canvas__eyebrow">Connected library</p><h3>Books for this lesson</h3></div></div><div class="search-row"><input id="lesson-book-search" placeholder="Search your indexed books..." aria-label="Search books"><button class="button" id="lesson-book-search-button">Search</button></div><div id="lesson-book-results" class="knowledge-list"></div><div id="lesson-connected-books" class="knowledge-list" style="margin-top:1rem"></div></section><h3>Teaching sections</h3><div>${w.sections.map(s=>`<article class="knowledge-card"><h4>${esc(s.position+". "+s.title)}</h4><p>${esc(s.content)}</p>${s.scripture_references.length?`<small>${esc(s.scripture_references.join(", "))}</small>`:""}</article>`).join("")||`<div class="empty-state">No teaching sections yet.</div>`}</div><form id="section-form" class="tool-form"><label>Section title<input name="title" required></label><label>Content<textarea name="content" rows="7"></textarea></label><label>Scripture references<input name="scripture_references" placeholder="John 3:16; Romans 8:1"></label><button class="button">Add teaching section</button></form></div>`;
    panel.querySelector("#back").onclick=()=>renderProjects(panel,"lesson");
    panel.querySelector("#lesson-core").onsubmit=async e=>{e.preventDefault();const d=new FormData(e.currentTarget);await saveLesson({...w.lesson,subtitle:d.get("subtitle"),purpose:d.get("purpose"),overview:d.get("overview"),key_truth:d.get("key_truth"),key_scripture:d.get("key_scripture"),personal_application:d.get("personal_application"),memory_verse:d.get("memory_verse"),takeaway:d.get("takeaway")});await openLesson(panel,projectId);};
    panel.querySelector("#section-form").onsubmit=async e=>{e.preventDefault();const d=new FormData(e.currentTarget);await saveLessonSection({lesson_id:w.lesson.id,position:w.sections.length+1,title:d.get("title"),content:d.get("content"),scripture_references:String(d.get("scripture_references")||"").split(";").map(x=>x.trim()).filter(Boolean)});await openLesson(panel,projectId);};
    const renderConnectedLessonBooks=async()=>{const books=await getConnectedBooks('Lesson',lesson.id);panel.querySelector('#lesson-connected-books').innerHTML=books.length?'<p class="muted">Attached books</p>'+books.map(b=>`<article class="knowledge-card"><div class="knowledge-card__head"><div><h4>${esc(b.title)}</h4><span class="pill">Book</span></div></div><p>${esc(b.author||b.filename||'')}</p></article>`).join(''):'<div class="empty-state">No books attached to this lesson yet.</div>';};
    const searchLessonBooks=async()=>{const q=String(panel.querySelector('#lesson-book-search').value||'').trim();const {listBooks}=await import('../libraryService.js');const books=await listBooks(q);panel.querySelector('#lesson-book-results').innerHTML=books.length?books.slice(0,12).map(b=>`<article class="knowledge-card"><div class="knowledge-card__head"><div><h4>${esc(b.title)}</h4><span class="pill">${esc(b.author||'Book')}</span></div><button class="text-button" data-attach-lesson-book="${esc(b.id)}">Attach</button></div><p>${esc(b.description||b.filename||'')}</p></article>`).join(''):'<div class="empty-state">No matching books.</div>';panel.querySelectorAll('[data-attach-lesson-book]').forEach(btn=>btn.onclick=async()=>{await linkBookToEntity('Lesson',lesson.id,btn.dataset.attachLessonBook);await renderConnectedLessonBooks();btn.textContent='Attached';btn.disabled=true;});};
    panel.querySelector('#lesson-book-search-button')?.addEventListener('click',searchLessonBooks);panel.querySelector('#lesson-book-search')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchLessonBooks();}});await renderConnectedLessonBooks();
    await mountConnectedDocuments(panel, 'Lesson', lesson.id);
  }

  async function openStudy(panel, projectId) {
    const rows=await import("../sermonService.js").then(m=>m.listSpecialized("study")); const study=rows.find(x=>x.project_id===projectId); if(!study)return;
    globalThis.__pwbCurrentEntity = { type: 'Study', id: study.id };
    const projectKnowledge = await getProjectKnowledge(projectId);
    const connections = await getEntityConnections("Study", study.id);
    const connectedResearch = connections.filter(r => ["ResearchItem","Note"].includes(r.target_type)).length;
    panel.innerHTML=`<div class="reader-panel"><div class="reader-panel__head"><div><p class="canvas__eyebrow">Study workspace</p><h2>${esc(study.title)}</h2></div><button class="text-button" id="back">Back</button></div><form id="study-form" class="tool-form"><label>Description<textarea name="description" rows="4">${esc(study.description)}</textarea></label><label>Primary question<textarea name="primary_question" rows="4">${esc(study.primary_question)}</textarea></label><label>Conclusion<textarea name="conclusion" rows="8">${esc(study.conclusion)}</textarea></label><button class="button button--primary">Save study</button></form><section class="reader-panel" style="margin-top:1rem"><div class="reader-panel__head"><div><p class="canvas__eyebrow">Connected Knowledge</p><h3>Research &amp; Notes</h3></div><span class="pill">${projectKnowledge.length} project items</span></div><p class="muted">Attach existing observations and research to this study without copying their content.</p><div id="study-knowledge-list">${projectKnowledge.length ? projectKnowledge.map(r=>`<article class="knowledge-card"><div class="knowledge-card__head"><div><h4>${esc(r.title)}</h4><span class="pill">${esc(r._type)}</span></div><button class="text-button" data-link-knowledge="${esc(r.id)}" data-link-type="${esc(r._type)}">Link to study</button></div><p>${esc(r.content || '')}</p></article>`).join('') : '<div class="empty-state">No project-linked research or notes yet. Use Quick Capture or Research to add material.</div>'}</div></section><section class="reader-panel" style="margin-top:1rem"><div class="reader-panel__head"><div><p class="canvas__eyebrow">Scripture</p><h3>Link Bible passages</h3></div></div><form id="study-scripture-form" class="tool-form"><label>Reference<input name="reference" required placeholder="1 John 1:1-4"></label><label>Translation<select name="translation"><option value="KJV">KJV</option></select></label><button class="button">Link Scripture</button></form><div id="study-scripture-status" class="muted"></div></section><section class="reader-panel" style="margin-top:1rem"><div class="reader-panel__head"><div><p class="canvas__eyebrow">Connections</p><h3>Related material</h3></div><span class="pill">${connections.length + connectedResearch}</span></div><p class="muted">The same study can feed sermons and lessons later without duplicating your work.</p></section></div>`;
    panel.querySelector("#back").onclick=()=>renderProjects(panel,"study"); panel.querySelector("#study-form").onsubmit=async e=>{e.preventDefault();const d=new FormData(e.currentTarget);await saveStudy({...study,description:d.get("description"),primary_question:d.get("primary_question"),conclusion:d.get("conclusion")});await openStudy(panel,projectId);};
    panel.querySelectorAll('[data-link-knowledge]').forEach(b=>b.onclick=async()=>{await linkKnowledgeToProject(b.dataset.linkType,b.dataset.linkKnowledge,projectId);await linkEntities('Study',study.id,b.dataset.linkType,b.dataset.linkKnowledge,b.dataset.linkType==='ResearchItem'?'research':'note');await openStudy(panel,projectId);});
    panel.querySelector('#study-scripture-form').onsubmit=async e=>{e.preventDefault();const d=new FormData(e.currentTarget);const status=panel.querySelector('#study-scripture-status');try{const result=await linkScripture('Study',study.id,d.get('reference'),d.get('translation'));status.textContent=`Linked ${result.reference} to this study (${result.links.length} verse${result.links.length===1?'':'s'}).`;await openStudy(panel,projectId);}catch(err){status.textContent=err?.message||String(err);}};
    await mountConnectedDocuments(panel, 'Study', study.id);
  }
}
