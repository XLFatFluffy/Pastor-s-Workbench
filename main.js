// main.js — Phase 0 application shell + hash router.
// UI routing only. Domain data remains behind services/data layers.

const ROUTES = Object.freeze([
  { id: "dashboard", label: "Dashboard", section: "Workspace", status: "ready", view: "./views/dashboardView.js" },
  { id: "bible", label: "Bible", section: "Study", status: "ready", view: "./views/bibleWorkspaceView.js", phase: "Phase 2" },
  { id: "confession", label: "1689 Confession", section: "Study", status: "ready", view: "./views/confessionWorkspaceView.js", phase: "Phase 3" },
  { id: "concordance", label: "Concordance", section: "Study", status: "ready", view: "./views/concordanceWorkspaceView.js", phase: "Phase 5" },
  { id: "research", label: "Research", section: "Study", status: "ready", view: "./views/researchWorkspaceView.js", phase: "Phase 6" },
  { id: "sermons", label: "Sermons", section: "Work", status: "ready", view: "./views/workWorkspaceView.js", phase: "Phase 7" },
  { id: "lessons", label: "Lessons", section: "Work", status: "ready", view: "./views/workWorkspaceView.js", phase: "Phase 7" },
  { id: "studies", label: "Studies", section: "Work", status: "ready", view: "./views/workWorkspaceView.js", phase: "Phase 7" },
  { id: "projects", label: "Projects", section: "Work", status: "ready", view: "./views/workWorkspaceView.js", phase: "Phase 7" },
  { id: "books", label: "Books", section: "Library", status: "ready", view: "./views/booksView.js", phase: "Phase 8" },
  { id: "commentaries", label: "Commentaries", section: "Library", status: "stub", view: "./views/stubView.js", phase: "Phase 8" },
      { id: "notes", label: "Notes", section: "Knowledge", status: "ready", view: "./views/researchWorkspaceView.js", phase: "Phase 6" },
  { id: "topics", label: "Topics", section: "Knowledge", status: "ready", view: "./views/researchWorkspaceView.js", phase: "Phase 6" },
  { id: "collections", label: "Collections", section: "Knowledge", status: "ready", view: "./views/researchWorkspaceView.js", phase: "Phase 6" },
  { id: "ai", label: "AI", section: "System", status: "ready", view: "./views/aiView.js", phase: "Phase 9" },
  { id: "settings", label: "Settings", section: "System", status: "ready", view: "./views/settingsView.js", phase: "Bible settings" },
]);

const DEFAULT_ROUTE = "dashboard";

function currentRouteId() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  return ROUTES.some((route) => route.id === hash) ? hash : DEFAULT_ROUTE;
}

function renderRail(activeId) {
  const container = document.getElementById("rail-sections");
  if (!container) return;

  // The HTML contains the same routes as a no-JS fallback. JS enhances rather
  // than recreates the navigation so a boot error cannot remove the buttons.
  for (const item of container.querySelectorAll("[data-route-id]")) {
    const route = ROUTES.find((candidate) => candidate.id === item.dataset.routeId);
    if (!route) continue;
    item.classList.toggle("rail__item--stub", route.status === "stub");
    if (route.status === "stub") item.dataset.phase = route.phase || "not started";
    if (route.id === activeId) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  }
}

async function renderView(routeId) {
  const route = ROUTES.find((candidate) => candidate.id === routeId) || ROUTES[0];
  const mount = document.getElementById("app-view");

  try {
    const mod = await import(route.view);
    mount.innerHTML = "";
    await mod.render(mount, route);
    mount.focus({ preventScroll: true });
  } catch (error) {
    mount.innerHTML = `
      <div class="canvas__header">
        <p class="canvas__eyebrow">Application error</p>
        <h1 class="canvas__title">${escapeHtml(route.label)} could not load</h1>
        <p class="canvas__dek">The shell is still running. The failed module is isolated so the application does not silently show a blank screen.</p>
      </div>
      <div class="error-panel">
        <strong>Module:</strong> <code>${escapeHtml(route.view)}</code>
        <pre>${escapeHtml(error?.stack || error?.message || String(error))}</pre>
      </div>
    `;
    console.error(`[Workbench] Failed to load route ${route.id}`, error);
    window.dispatchEvent(new CustomEvent('pwb:route-error', { detail: { id: route.id, label: route.label, view: route.view, error: String(error?.stack || error?.message || error) } }));
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function route() {
  const id = currentRouteId();
  globalThis.__pwbCurrentRoute = `#/${id}`;
  window.dispatchEvent(new CustomEvent("pwb:route-changed", { detail: { id, route: `#/${id}` } }));
  renderRail(id);
  renderView(id);
  closeMobileNav();
}

// Mobile nav: below the --rail-breakpoint width (see styles.css), the rail is
// an off-canvas panel opened by the hamburger button and closed by the scrim,
// Escape, or navigating to a new route. Above the breakpoint the rail is
// always visible and this control is hidden, so desktop behavior is unchanged.
function openMobileNav() {
  document.body.classList.add("rail-open");
  document.getElementById("rail-toggle")?.setAttribute("aria-expanded", "true");
  document.getElementById("rail-scrim")?.removeAttribute("hidden");
}

function closeMobileNav() {
  document.body.classList.remove("rail-open");
  document.getElementById("rail-toggle")?.setAttribute("aria-expanded", "false");
  document.getElementById("rail-scrim")?.setAttribute("hidden", "");
}

function initMobileNav() {
  const toggle = document.getElementById("rail-toggle");
  const scrim = document.getElementById("rail-scrim");
  toggle?.addEventListener("click", () => {
    if (document.body.classList.contains("rail-open")) closeMobileNav();
    else openMobileNav();
  });
  scrim?.addEventListener("click", closeMobileNav);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMobileNav();
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addEventListener("hashchange", route);
  window.addEventListener("DOMContentLoaded", () => {
    initMobileNav();
    route();
  });
  if (document.readyState !== "loading") {
    initMobileNav();
    route();
  }
}

export { ROUTES, currentRouteId };
