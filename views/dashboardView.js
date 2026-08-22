// Dashboard — live overview of the user's Workbench and AI entry points.
import { listProjects, listSpecialized, saveProject, saveSermon, initializeSermonWorkflow } from "../sermonService.js";
import { listKnowledge, getKnowledgeStats } from "../researchService.js";
import { listBooks, getBookStats } from "../libraryService.js";
import { getDailyBriefing, getAIDailyNarrative } from "../assistantService.js";
import { saveTask } from "../calendarService.js";
import { saveNote, saveResearchItem } from "../researchService.js";
import { all } from "../store.js";
import { getWorkbenchSuggestions, getWorkbenchMap, applySuggestion, dismissSuggestion } from "../suggestionsService.js";
import { isAssistantBriefingEnabled, isAssistantSuggestionsEnabled } from "./settingsView.js";

const esc = v => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const fmtDate = value => value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";

export async function render(mount) {
  const briefingEnabled = isAssistantBriefingEnabled();
  const suggestionsEnabled = isAssistantSuggestionsEnabled();
  const [projects, sermons, lessons, studies, knowledge, books, knowledgeStats, bookStats, briefing, suggestions] = await Promise.all([
    listProjects(), listSpecialized("sermon"), listSpecialized("lesson"), listSpecialized("study"),
    listKnowledge({ type: "all" }), listBooks(), getKnowledgeStats(), getBookStats(), getDailyBriefing(),
    suggestionsEnabled ? getWorkbenchSuggestions().catch(() => []) : Promise.resolve([])
  ]);

  const activeProjects = projects.filter(p => p.status !== "archived");
  const recent = [
    ...sermons.map(x => ({ kind: "Sermon", title: x.title, date: x.updated_at, href: "#/sermons", prompt: `Review my sermon work and help me identify the most important next step for “${x.title}”.` })),
    ...lessons.map(x => ({ kind: "Lesson", title: x.title, date: x.updated_at, href: "#/lessons", prompt: `Review my lesson “${x.title}” and tell me what I should strengthen next.` })),
    ...studies.map(x => ({ kind: "Study", title: x.title, date: x.updated_at, href: "#/studies", prompt: `Help me continue my study “${x.title}”. Look at my Workbench context and identify the next useful research question.` })),
    ...knowledge.map(x => ({ kind: x.type || "Knowledge", title: x.title || x.name || "Untitled", date: x.updated_at || x.created_at, href: "#/research", prompt: `Help me evaluate this Workbench knowledge item: “${x.title || x.name || "Untitled"}”.` }))
  ].sort((a,b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, 8);

  mount.innerHTML = `
    <div class="canvas__header dashboard-header">
      <div><p class="canvas__eyebrow">Workspace</p><h1 class="canvas__title">Dashboard</h1><p class="canvas__dek">Your starting point for Scripture study, sermon preparation, research, books, and your AI study assistant.</p></div>
      <button class="button button--primary" id="dashboard-ai">Ask AI about my Workbench</button>
    </div>

    <section class="reader-panel dashboard-card dashboard-briefing">
      <div class="reader-panel__head"><div><p class="canvas__eyebrow">Today</p><h2>Pastor's Daily Briefing</h2></div><div><button class="text-button" id="dashboard-briefing-refresh" type="button" ${briefingEnabled ? "" : "hidden"}>Refresh AI summary</button><a class="text-button" href="#/calendar">Open planner</a></div></div>
      <div id="dashboard-briefing-narrative" class="dashboard-briefing__narrative">${briefingEnabled ? '<span class="muted">Generating AI summary…</span>' : '<span class="muted">AI daily summary is turned off. Enable it under Settings &gt; Assistant.</span>'}</div>
      <div class="dashboard-briefing__grid">
        <div><strong>${briefing.events.length}</strong><span>appointments</span></div>
        <div><strong>${briefing.openTasks.length}</strong><span>open tasks</span></div>
        <div><strong>${briefing.urgentTasks.length}</strong><span>high priority</span></div>
        <div><strong>${briefing.activeProjects.length}</strong><span>active projects</span></div>
      </div>
      <div class="dashboard-briefing__list">${briefing.events.slice(0,4).map(e=>`<div><span class="pill">Event</span><strong>${esc(e.title)}</strong><small>${esc(new Date(e.start_at).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}))}</small></div>`).join('') || '<div class="empty-state">No calendar events today.</div>'}${briefing.openTasks.slice(0,4).map(t=>`<div><span class="pill">${esc(labelPriority(t.priority))}</span><strong>${esc(t.title)}</strong><small>Task</small></div>`).join('')}</div>
    </section>

    <section class="reader-panel dashboard-card dashboard-suggestions" aria-live="polite">
      <div class="reader-panel__head"><div><p class="canvas__eyebrow">Noticed</p><h2>Suggestions</h2></div><button class="text-button" id="dashboard-map-workbench" type="button" ${suggestionsEnabled ? "" : "hidden"}>Map my Workbench</button></div>
      <div id="dashboard-suggestions-list">${!suggestionsEnabled ? '<div class="empty-state">Proactive suggestions are turned off. Enable them under Settings &gt; Assistant.</div>' : suggestions.length ? suggestions.map(s => suggestionCard(s)).join("") : '<div class="empty-state">Nothing to suggest right now — as you work on sermons, lessons, and studies, the Workbench will point out unlinked Scripture, cross references, and related research here. Nothing is ever saved until you approve it.</div>'}</div>
      <div id="dashboard-map-results"></div>
    </section>

    <section class="dashboard-stats" aria-label="Workbench totals">
      ${stat("Projects", activeProjects.length, "#/projects")}
      ${stat("Sermons", sermons.length, "#/sermons")}
      ${stat("Research", knowledgeStats?.research ?? knowledge.filter(x => x.type === "research").length, "#/research")}
      ${stat("Books", bookStats.books, "#/books")}
      ${stat("Book sections", bookStats.chunks.toLocaleString(), "#/books")}
    </section>

    <section class="dashboard-grid">
      <article class="reader-panel dashboard-card">
        <div class="reader-panel__head"><div><p class="canvas__eyebrow">Quick start</p><h2>What are you working on?</h2></div></div>
        <div class="dashboard-actions">
          <button class="dashboard-action" data-ai-prompt="Help me begin my next sermon. Ask me the questions you need, then use my Workbench context as we work."><strong>Start sermon work</strong><span>Let AI help you work through the preparation.</span></button>
          <button class="dashboard-action" data-ai-prompt="Look across my Workbench and tell me what unfinished work would be most useful to continue today. Do not invent anything; use only the context supplied."><strong>What should I work on?</strong><span>Let AI find useful next steps from your existing work.</span></button>
          <button class="dashboard-action" data-ai-prompt="Help me research a theological question. Start by asking what question I am trying to answer, then use my books, research, Scripture, and 1689 context as appropriate."><strong>Start research</strong><span>Turn a question into a focused research session.</span></button>
          <button class="dashboard-action" data-ai-prompt="Review the current state of my Workbench. Identify gaps, unfinished projects, and areas where my existing notes or books could be used more effectively. Be concise and practical."><strong>Review my Workbench</strong><span>Get an AI overview of your current study environment.</span></button>
        </div>
      </article>

      <article class="reader-panel dashboard-card">
        <div class="reader-panel__head"><div><p class="canvas__eyebrow">Create</p><h2>New sermon</h2></div></div>
        <form id="dashboard-sermon-form" class="tool-form">
          <label>Title<input name="title" required placeholder="Sunday sermon title"></label>
          <label>Primary text<input name="primary_text" placeholder="Romans 8:1–17"></label>
          <button class="button button--primary" type="submit">Create sermon</button>
          <div id="dashboard-create-status" class="muted" aria-live="polite"></div>
        </form>
      </article>
    </section>

    <section class="reader-panel dashboard-card" style="margin-top:1rem">
      <div class="reader-panel__head"><div><p class="canvas__eyebrow">Quick Capture</p><h2>Save an idea before it gets away</h2></div></div>
      <form id="quick-capture-form" class="tool-form">
        <label>Capture<textarea name="text" rows="3" required placeholder="Sermon idea, pastoral reminder, research question, or anything you need to remember…"></textarea></label>
        <div class="form-row"><label>Type<select name="type"><option value="note">Note</option><option value="research">Research</option><option value="idea">Idea</option><option value="reminder">Reminder</option><option value="task">Task</option></select></label><label>Due date (optional)<input type="date" name="due_date"></label></div><label>Project (optional)<select name="project_id"><option value="">No project</option>${activeProjects.map(p=>`<option value="${esc(p.id)}">${esc(p.title)}</option>`).join()}</select></label>
        <button class="button button--primary">Capture</button><div id="quick-capture-status" class="muted" aria-live="polite"></div>
      </form>
    </section>

    <section class="reader-panel dashboard-card" style="margin-top:1rem">
      <div class="reader-panel__head"><div><p class="canvas__eyebrow">Continue</p><h2>Recent work</h2></div><a class="text-button" href="#/projects">View projects</a></div>
      <div class="dashboard-recent">${recent.length ? recent.map(item => `<article class="dashboard-recent__item"><div><span class="pill">${esc(item.kind)}</span><h3>${esc(item.title)}</h3><small>Updated ${esc(fmtDate(item.date))}</small></div><div class="dashboard-recent__actions"><a class="text-button" href="${item.href}">Open</a><button class="text-button" data-ai-prompt="${esc(item.prompt)}">Ask AI</button></div></article>`).join("") : `<div class="empty-state">Your recent work will appear here as you build the Workbench.</div>`}</div>
    </section>

    <section class="foundation-strip dashboard-foundation" aria-label="System status">
      <div><span class="foundation-strip__label">Storage</span><strong>Local IndexedDB</strong><span class="foundation-strip__ok">Active</span></div>
      <div><span class="foundation-strip__label">AI</span><strong>Global assistant</strong><span class="foundation-strip__ok">Available from every screen</span></div>
      <div><span class="foundation-strip__label">Library</span><strong>${bookStats.books} books</strong><span class="foundation-strip__ok">${bookStats.chunks.toLocaleString()} searchable sections</span></div>
    </section>
  `;

  mount.querySelectorAll("[data-ai-prompt]").forEach(button => button.addEventListener("click", () => window.dispatchEvent(new CustomEvent("pwb:ai-prompt", { detail: { prompt: button.dataset.aiPrompt } }))));
  mount.querySelector("#dashboard-ai")?.addEventListener("click", () => window.dispatchEvent(new CustomEvent("pwb:ai-prompt", { detail: { prompt: "Review my Workbench and help me decide what I should work on next. Use my saved sermons, projects, research, notes, books, Scripture-related material, and current dashboard context. Do not invent missing information." } })));

  mount.querySelector("#quick-capture-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = String(data.get('text') || '').trim();
    const type = String(data.get('type') || 'note');
    const dueDate = String(data.get('due_date') || '').trim();
    const projectId = String(data.get('project_id') || '').trim();
    if (!text) return;
    const title = text.length > 80 ? `${text.slice(0,77)}…` : text;
    if (type === 'research') await saveResearchItem({ title, content: text, research_type: 'observation', origin: 'personal', project_id: projectId });
    else if (type !== 'task') await saveNote({ title, content: text, note_type: type === 'idea' ? 'idea' : 'general', origin: 'personal', project_id: projectId });
    if (type === 'task' || dueDate) {
      const taskDate = dueDate || new Date().toISOString().slice(0,10);
      await saveTask({ title, description: text, due_date: taskDate, priority: 'normal', project_id: projectId });
    }
    event.currentTarget.reset();
    mount.querySelector('#quick-capture-status').textContent = dueDate ? 'Captured and scheduled.' : 'Captured to your Workbench.';
  });

  mount.querySelector("#dashboard-sermon-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const status = mount.querySelector("#dashboard-create-status");
    const title = String(data.get("title") || "").trim();
    const primaryText = String(data.get("primary_text") || "").trim();
    if (!title) return;
    const project = await saveProject({ title, project_type: "sermon", status: "draft", description: primaryText ? `Primary text: ${primaryText}` : "" });
    const sermon = await saveSermon({ project_id: project.id, title, primary_text: primaryText, status: "draft" });
    await initializeSermonWorkflow(sermon.id);
    status.textContent = "Sermon created. Opening it…";
    window.location.hash = "#/sermons";
  });

  const narrativeEl = mount.querySelector("#dashboard-briefing-narrative");
  const loadNarrative = async (force = false) => {
    if (!narrativeEl || !briefingEnabled) return;
    narrativeEl.innerHTML = '<span class="muted">Generating AI summary…</span>';
    try {
      const narrative = await getAIDailyNarrative(briefing, { force });
      narrativeEl.innerHTML = `<p>${esc(narrative.text)}</p><small class="muted">${esc(narrative.model)} · ${force ? "refreshed" : "cached for today"}</small>`;
    } catch (error) {
      narrativeEl.innerHTML = `<span class="muted">AI summary unavailable (${esc(error?.message || String(error))}). Open AI Settings to check your Ollama connection.</span>`;
    }
  };
  if (briefingEnabled) loadNarrative();
  mount.querySelector("#dashboard-briefing-refresh")?.addEventListener("click", () => loadNarrative(true));

  if (!suggestionsEnabled) return;
  const suggestionRegistry = new Map(suggestions.map(s => [s.id, s]));
  const suggestionsSection = mount.querySelector(".dashboard-suggestions");
  const mapResultsEl = mount.querySelector("#dashboard-map-results");
  const mapButton = mount.querySelector("#dashboard-map-workbench");

  async function applyOne(card, suggestion) {
    const applyBtn = card.querySelector("[data-suggestion-apply]");
    applyBtn.disabled = true;
    applyBtn.textContent = "Adding…";
    try {
      await applySuggestion(suggestion);
      card.querySelector(".global-ai__action-buttons").innerHTML = '<span class="pill">Added ✓</span>';
      return true;
    } catch (error) {
      applyBtn.disabled = false;
      applyBtn.textContent = "Add to Workbench";
      card.insertAdjacentHTML("beforeend", `<small class="global-ai__action-error">${esc(error?.message || String(error))}</small>`);
      return false;
    }
  }

  suggestionsSection?.addEventListener("click", async event => {
    const applyBtn = event.target.closest("[data-suggestion-apply]");
    const dismissBtn = event.target.closest("[data-suggestion-dismiss]");
    const groupApproveBtn = event.target.closest("[data-map-approve-group]");
    if (applyBtn) {
      const card = applyBtn.closest("[data-suggestion]");
      const suggestion = suggestionRegistry.get(card?.dataset.suggestion);
      if (suggestion) await applyOne(card, suggestion);
    } else if (dismissBtn) {
      const card = dismissBtn.closest("[data-suggestion]");
      if (card?.dataset.suggestion) dismissSuggestion(card.dataset.suggestion);
      card?.remove();
    } else if (groupApproveBtn) {
      groupApproveBtn.disabled = true;
      groupApproveBtn.textContent = "Approving…";
      const group = mapResultsEl.querySelector(`[data-map-group="${CSS.escape(groupApproveBtn.dataset.mapApproveGroup)}"]`);
      const cards = [...(group?.querySelectorAll("[data-suggestion]") || [])];
      for (const card of cards) {
        const suggestion = suggestionRegistry.get(card.dataset.suggestion);
        if (suggestion && !card.querySelector(".global-ai__action-buttons .pill")) await applyOne(card, suggestion);
      }
      groupApproveBtn.textContent = "Approved ✓";
    }
  });

  mapButton?.addEventListener("click", async () => {
    mapButton.disabled = true;
    mapButton.textContent = "Mapping…";
    mapResultsEl.innerHTML = '<div class="muted" id="dashboard-map-progress">Scanning your Workbench…</div>';
    try {
      const map = await getWorkbenchMap({
        onProgress: ({ done, total }) => {
          const progressEl = mount.querySelector("#dashboard-map-progress");
          if (progressEl) progressEl.textContent = `Scanning your Workbench… ${done} of ${total} projects checked.`;
        }
      });
      for (const group of map.groups) for (const s of group.suggestions) suggestionRegistry.set(s.id, s);
      mapResultsEl.innerHTML = map.totalSuggestions
        ? `<div class="muted" style="margin-bottom:10px">Checked ${map.projectsScanned} active project(s) — found ${map.totalSuggestions} possible connection(s). Nothing is saved until you approve it.</div>${map.groups.map(g => mapGroupHTML(g)).join("")}`
        : `<div class="empty-state">Checked ${map.projectsScanned} active project(s) — everything already linked appears to be connected. Nothing new to suggest.</div>`;
    } catch (error) {
      mapResultsEl.innerHTML = `<div class="empty-state">Could not complete the scan: ${esc(error?.message || String(error))}</div>`;
    } finally {
      mapButton.disabled = false;
      mapButton.textContent = "Map my Workbench";
    }
  });
}

function labelPriority(value) { return String(value || "normal").replace(/^\w/, c => c.toUpperCase()); }

function stat(label, value, href) {
  return `<a class="dashboard-stat" href="${href}"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>Open</small></a>`;
}

const SUGGESTION_KIND_LABEL = { scripture: "Unlinked Scripture", crossref: "Cross reference", research: "Related research" };

function suggestionCard(s) {
  return `<article class="knowledge-card" data-suggestion="${esc(s.id)}">
    <div class="knowledge-card__head"><span class="pill pill--muted">${esc(SUGGESTION_KIND_LABEL[s.kind] || s.kind)}</span><strong>${esc(s.label)}</strong></div>
    <p>${esc(s.detail)}</p>
    <div class="global-ai__action-buttons"><button type="button" class="button button--primary button--small" data-suggestion-apply>Add to Workbench</button><button type="button" class="text-button" data-suggestion-dismiss>Dismiss</button></div>
  </article>`;
}

function mapGroupHTML(group) {
  return `<article class="dashboard-map-group" data-map-group="${esc(group.projectId)}">
    <div class="dashboard-map-group__head"><strong>${esc(group.projectTitle)}</strong><span class="pill pill--muted">${group.suggestions.length} found</span><button type="button" class="text-button" data-map-approve-group="${esc(group.projectId)}">Approve all in this project</button></div>
    <div class="dashboard-map-group__list">${group.suggestions.map(s => suggestionCard(s)).join("")}</div>
  </article>`;
}
