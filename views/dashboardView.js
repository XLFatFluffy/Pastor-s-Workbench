// Dashboard — live overview of the user's Workbench and AI entry points.
import { listProjects, listSpecialized, saveProject, saveSermon, initializeSermonWorkflow } from "../sermonService.js";
import { listKnowledge, getKnowledgeStats } from "../researchService.js";
import { listBooks, getBookStats } from "../libraryService.js";

const esc = v => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const fmtDate = value => value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";

export async function render(mount) {
  const [projects, sermons, lessons, studies, knowledge, books, knowledgeStats, bookStats] = await Promise.all([
    listProjects(), listSpecialized("sermon"), listSpecialized("lesson"), listSpecialized("study"),
    listKnowledge({ type: "all" }), listBooks(), getKnowledgeStats(), getBookStats()
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
}

function stat(label, value, href) {
  return `<a class="dashboard-stat" href="${href}"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>Open</small></a>`;
}
