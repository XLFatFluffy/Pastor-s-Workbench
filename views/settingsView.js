import {
  getAvailableBibleVersions,
  getTranslationStatus,
  downloadKJVLocally,
  importTranslationJson,
  removeLocalTranslation
} from "../bibleService.js";
import { getAISettings, saveAISettings, checkOllama, getRecommendedAIModel, getAIDatabaseInfo, listAIMemory, addKnowledgeSource, listKnowledgeSources, deleteKnowledgeSource, getKnowledgeStats } from "../aiService.js";
import { EMBED_MODEL } from "../knowledgeService.js";
import { isDesktop, desktopInfo, desktopHealth, openAppDataFolder, checkForAppUpdate, installAppUpdate, openUpdatePage } from "../desktopBridge.js";
import { clearDismissedSuggestions, getDismissedCount } from "../suggestionsService.js";

export const ASSISTANT_SETTINGS_KEYS = Object.freeze({ briefing: "pwb:assistant:briefingEnabled", suggestions: "pwb:assistant:suggestionsEnabled" });
export function isAssistantBriefingEnabled() { return localStorage.getItem(ASSISTANT_SETTINGS_KEYS.briefing) !== "false"; }
export function isAssistantSuggestionsEnabled() { return localStorage.getItem(ASSISTANT_SETTINGS_KEYS.suggestions) !== "false"; }

export async function render(mount) {
  mount.innerHTML = `
    <section class="canvas__header">
      <p class="canvas__eyebrow">System · Preferences</p>
      <h1 class="canvas__title">Settings</h1>
      <p class="canvas__dek">Manage Workbench preferences and Bible data without crowding the main Bible workspace.</p>
    </section>

    <section class="settings-workspace panel">
      <div class="settings-tabs" role="tablist" aria-label="Settings sections">
        <button class="settings-tab settings-tab--active" type="button" role="tab" aria-selected="true" data-settings-tab="general">General</button>
        <button class="settings-tab" type="button" role="tab" aria-selected="false" data-settings-tab="bible">Bible</button>
        <button class="settings-tab" type="button" role="tab" aria-selected="false" data-settings-tab="ai">AI</button>
        <button class="settings-tab" type="button" role="tab" aria-selected="false" data-settings-tab="updates">Updates</button>
        <button class="settings-tab" type="button" role="tab" aria-selected="false" data-settings-tab="assistant">Assistant</button>
      </div>

      <div class="settings-panel" data-settings-panel="general">
        <div class="settings-section-heading"><h2>General</h2><p>General Workbench preferences will live here as they are implemented.</p></div>
        <div class="settings-row settings-row--muted"><div><strong>Application</strong><span>Pastor's Workbench</span></div><span class="status-badge">Local</span></div>
        <div class="settings-row"><div><strong>Desktop application</strong><span id="desktop-status">Checking…</span></div><button id="desktop-open-data" class="button" type="button">Open App Data</button></div>
        <div class="settings-row settings-row--muted"><div><strong>Native environment</strong><span id="desktop-health">Checking desktop services…</span></div><span id="desktop-badge" class="status-badge">Checking</span></div>
      </div>

      <div class="settings-panel" data-settings-panel="ai" hidden>
        <div class="settings-section-heading"><h2>AI</h2><p>Connect the Workbench to your local Ollama installation and control how your assistant works with your books.</p></div>
        <div class="settings-row"><div><strong>Ollama connection</strong><span id="ai-connection-status">Checking…</span></div><button id="ai-check-connection" class="button" type="button">Check connection</button></div>
        <div class="settings-row"><div><strong>Ollama address</strong><span>Usually http://127.0.0.1:11434</span></div><input id="ai-base-url" class="settings-select" type="url" placeholder="http://127.0.0.1:11434"></div>
        <div class="settings-row"><div><strong>Default local model</strong><span>Select the Ollama model the Workbench uses. Recommended for a 16 GB integrated-graphics computer: <strong>Gemma 3 4B</strong> (<code>gemma3:4b</code>).</span></div><select id="ai-default-model" class="settings-select"><option value="">Checking models…</option></select></div>
        <div class="settings-row settings-row--muted"><div><strong>Gemma 3 4B setup</strong><span>Once Ollama finishes downloading the model, click Check connection. The Workbench will detect <code>gemma3:4b</code> automatically.</span></div><span class="status-badge">Local · Private</span></div>
        <div class="settings-row"><div><strong>Temperature</strong><span>Lower is more focused; higher is more exploratory.</span></div><input id="ai-temperature" class="settings-range" type="range" min="0" max="1" step="0.1"><output id="ai-temperature-value"></output></div>
        <div class="settings-row settings-row--stacked"><div><strong>Workbench AI instructions</strong><span>Persistent instructions for the local assistant.</span></div><textarea id="ai-system-prompt" rows="5" class="tool-form-input" placeholder="For example: Be careful with theological claims. Distinguish Scripture from historical theology and identify uncertainty."></textarea><button id="ai-save-settings" class="button button--primary" type="button">Save AI Settings</button></div>
        <div class="settings-row settings-row--stacked"><div><strong>Your personal AI context</strong><span>Optional information about you that helps the assistant serve you consistently.</span></div><textarea id="ai-about-me" rows="4" class="tool-form-input" placeholder="Tell the AI what you want it to know about you, your ministry, writing preferences, and goals."></textarea></div>

        <div class="settings-section-heading"><h2>Knowledge store</h2><p>Upload books or texts (Puritan/Reformer works, commentaries, etc.) to give the AI semantic recall of their content. Each file is chunked and embedded locally with <code>nomic-embed-text</code> via Ollama — nothing leaves this computer. Requires <code>ollama pull nomic-embed-text</code> once.</p></div>
        <div class="settings-row"><div><strong>Embedding model</strong><span id="knowledge-embed-status">Checking…</span></div><button id="knowledge-check-embed" class="button" type="button">Check nomic-embed-text</button></div>
        <div class="settings-row settings-row--stacked">
          <div><strong>Add a source</strong><span>PDF, TXT, Markdown, HTML, or JSON text files.</span></div>
          <input id="knowledge-file" type="file" accept=".pdf,.txt,.md,.markdown,.html,.htm,.json" class="tool-form-input">
          <input id="knowledge-title" type="text" class="tool-form-input" placeholder="Title (optional — defaults to filename)">
          <input id="knowledge-author" type="text" class="tool-form-input" placeholder="Author (optional)">
          <button id="knowledge-add" class="button button--primary" type="button">Add to knowledge store</button>
          <div id="knowledge-progress" class="settings-row--muted" hidden></div>
          <div id="knowledge-error" class="error-panel" hidden></div>
        </div>
        <div class="settings-row"><div><strong>Knowledge store</strong><span id="knowledge-stats">Loading…</span></div></div>
        <div id="knowledge-sources" class="knowledge-list"></div>
      </div>

      <div class="settings-panel" data-settings-panel="updates" hidden>
        <div class="settings-section-heading"><h2>Updates</h2><p>Keep Pastor's Workbench current without replacing folders manually. Secure automatic installation will be enabled after the release signing endpoint is configured.</p></div>
        <div class="settings-row settings-row--muted"><div><strong>Installed version</strong><span id="app-version">0.28.0</span></div><span id="update-badge" class="status-badge">Desktop</span></div>
        <div class="settings-row"><div><strong>Update status</strong><span id="update-status">Ready to check.</span></div><button id="check-for-updates" class="button button--primary" type="button">Check for Updates</button></div>
        <div class="settings-row settings-row--stacked" id="update-result" hidden><div><strong id="update-result-title">Update</strong><span id="update-result-details"></span></div><div class="settings-actions"><button id="install-update" class="button button--primary" type="button" hidden>Download &amp; Install Update</button><button id="open-update-page" class="button" type="button" hidden>Open Release Page</button></div><span id="update-progress" aria-live="polite"></span></div>
        <div class="settings-row settings-row--muted"><div><strong>Automatic updates</strong><span>Signed Tauri updates are configured for the desktop build. Windows closes the app automatically while the installer applies the update.</span></div><span class="status-badge">Desktop Ready</span></div>
        <div class="settings-row settings-row--stacked"><div><strong>Backup before updates</strong><span>Create a backup of Workbench data before installing a future update.</span></div><button id="backup-before-update" class="button" type="button">Create Backup</button><span id="backup-status" aria-live="polite"></span></div>
      </div>

      <div class="settings-panel" data-settings-panel="assistant" hidden>
        <div class="settings-section-heading"><h2>Assistant</h2><p>Control the Dashboard's daily briefing and proactive suggestions. The model these use is whatever is selected under the AI tab above — Gemma3:4b and Qwen3:8b both work; smaller models are faster but propose more that you'll need to reject.</p></div>
        <div class="settings-row"><div><strong>AI daily briefing</strong><span>A short AI-written summary of today's appointments, tasks, and projects on the Dashboard. Cached once per day; refreshed with the Refresh button.</span></div><label class="settings-toggle"><input id="assistant-briefing-enabled" type="checkbox"><span>Enabled</span></label></div>
        <div class="settings-row"><div><strong>Proactive suggestions</strong><span>The Dashboard's Suggestions panel and "Map my Workbench" scan for unlinked Scripture, cross references, and related research. Deterministic — no AI call, nothing saved without your approval.</span></div><label class="settings-toggle"><input id="assistant-suggestions-enabled" type="checkbox"><span>Enabled</span></label></div>
        <div class="settings-row"><div><strong>AI data store</strong><span id="ai-database-status">Checking…</span></div><span class="status-badge">Local · Separate</span></div>
        <div class="settings-row"><div><strong>Dismissed suggestions</strong><span id="assistant-dismissed-count">Checking…</span></div><button id="assistant-clear-dismissed" class="button" type="button">Clear dismissed</button></div>
      </div>

      <div class="settings-panel" data-settings-panel="bible" hidden>
        <div class="settings-section-heading"><h2>Bible</h2><p>Bible downloads, translations, and reading defaults.</p></div>

        <div class="settings-row">
          <div><strong>King James Version</strong><span id="kjv-download-status">Checking local Bible data…</span></div>
          <button id="download-kjv" class="button button--primary" type="button">Download KJV</button>
        </div>
        <div class="settings-progress" id="kjv-progress" hidden><div class="settings-progress__bar"><span id="kjv-progress-bar"></span></div><span id="kjv-progress-label">Preparing…</span></div>

        <div class="settings-row">
          <div><strong>Default translation</strong><span>Used when opening the Bible workspace.</span></div>
          <select id="settings-default-translation" class="settings-select"></select>
        </div>

        <div class="settings-row">
          <div><strong>Reading font size</strong><span>Default text size for Bible reading.</span></div>
          <input id="settings-font-size" class="settings-range" type="range" min="17" max="32" step="1">
          <output id="settings-font-size-value"></output>
        </div>

        <div class="settings-row settings-row--stacked">
          <div><strong>Import another translation</strong><span>Import JSON you own or are licensed to use. This replaces the old Bible-tab importer.</span></div>
          <div class="settings-import-grid">
            <input id="custom-translation-id" maxlength="32" placeholder="ID / abbreviation (e.g. NET)">
            <input id="custom-translation-name" placeholder="Translation name">
            <input id="custom-translation-files" type="file" accept=".json,application/json" multiple>
            <button id="import-translation" class="button" type="button">Import</button>
          </div>
          <div id="translation-import-status" class="import-status" aria-live="polite"></div>
        </div>

        <div class="settings-row settings-row--stacked">
          <div><strong>Installed translations</strong><span>Locally stored Bible text available to the Workbench.</span></div>
          <div id="translation-status"></div>
        </div>
      </div>
    </section>
  `;

  const $ = (id) => document.getElementById(id);
  const desktopStatus = $("desktop-status");
  const desktopHealthEl = $("desktop-health");
  const desktopBadge = $("desktop-badge");
  const desktopOpen = $("desktop-open-data");
  if (!isDesktop()) {
    desktopStatus.textContent = "Browser mode";
    desktopHealthEl.textContent = "This window is running in a browser. The installed desktop build provides native storage integration.";
    desktopBadge.textContent = "Browser";
    desktopOpen.disabled = true;
  } else {
    const info = await desktopInfo();
    desktopStatus.textContent = `Windows desktop · ${info.arch || "native"}`;
    desktopHealthEl.textContent = info.appDataDir ? `Native app data: ${info.appDataDir}` : "Native app data is available.";
    desktopBadge.textContent = "Desktop";
    desktopOpen.addEventListener("click", async () => { await openAppDataFolder(); });
    const health = await desktopHealth();
    desktopHealthEl.textContent = health.message;
    desktopBadge.textContent = health.ollama_reachable ? "Ready · Ollama" : "Desktop Ready";
  }

  let aiSettings = getAISettings();
  $("ai-base-url").value = aiSettings.baseUrl;
  $("ai-temperature").value = aiSettings.temperature;
  $("ai-temperature-value").value = aiSettings.temperature;
  $("ai-system-prompt").value = aiSettings.systemPrompt;
  $("ai-about-me").value = localStorage.getItem("pw:ai:aboutMe") || "";
  async function refreshAISettings() {
    aiSettings = getAISettings();
    const result = await checkOllama();
    $("ai-connection-status").textContent = result.connected ? `Connected · ${result.models.length} model${result.models.length===1?"":"s"} available.` : `Not connected · ${result.error}`;
    $("ai-default-model").innerHTML = result.models.length ? result.models.map(m => `<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`).join("") : '<option value="">No models found</option>';
    const preferred = aiSettings.model || getRecommendedAIModel();
    if (result.models.some(m => m.name === preferred)) $("ai-default-model").value = preferred;
    else if (result.models.some(m => m.name === getRecommendedAIModel())) $("ai-default-model").value = getRecommendedAIModel();
  }
  $("ai-check-connection").addEventListener("click", async () => { saveAISettings({ baseUrl: $("ai-base-url").value }); await refreshAISettings(); });
  $("ai-temperature").addEventListener("input", e => $("ai-temperature-value").value = e.target.value);
  $("ai-save-settings").addEventListener("click", () => { saveAISettings({ baseUrl: $("ai-base-url").value, model: $("ai-default-model").value, temperature: Number($("ai-temperature").value), systemPrompt: $("ai-system-prompt").value }); localStorage.setItem("pw:ai:aboutMe", $("ai-about-me").value); $("ai-save-settings").textContent = "Saved"; setTimeout(()=>$("ai-save-settings").textContent="Save AI Settings",1200); });
  await refreshAISettings();

  const aiDbInfo = await getAIDatabaseInfo();
  const aiMemory = await listAIMemory();
  $("ai-database-status").textContent = `${aiDbInfo.name} · ${aiDbInfo.stores.length} AI stores · ${aiMemory.length} saved memories`;

  async function refreshKnowledgeEmbedStatus() {
    if (!isDesktop()) { $("knowledge-embed-status").textContent = "Available only in the installed desktop app."; return; }
    const result = await checkOllama();
    const has = result.models.some(m => m.name === EMBED_MODEL || m.name.startsWith(`${EMBED_MODEL}:`));
    $("knowledge-embed-status").textContent = has ? `Ready · ${EMBED_MODEL} is pulled.` : `Not found. Run: ollama pull ${EMBED_MODEL}`;
  }
  $("knowledge-check-embed").addEventListener("click", refreshKnowledgeEmbedStatus);
  await refreshKnowledgeEmbedStatus();

  async function refreshKnowledgeSources() {
    const [stats, sources] = await Promise.all([getKnowledgeStats(), listKnowledgeSources()]);
    $("knowledge-stats").textContent = `${stats.sources} source${stats.sources===1?"":"s"} · ${stats.chunks} chunks · ${Math.round(stats.characters/1000)}k characters`;
    $("knowledge-sources").innerHTML = sources.length ? sources.map(s => `<article class="knowledge-card"><div class="knowledge-card__head"><div><h4>${escapeHtml(s.title)}</h4><span class="pill">${escapeHtml(s.status)}${s.chunk_count ? ` · ${s.chunk_count} chunks` : ""}</span></div><button class="text-button" data-remove-knowledge="${escapeHtml(s.id)}">Remove</button></div><p>${escapeHtml(s.author || s.filename || "")}${s.status === "error" && s.error ? ` — ${escapeHtml(s.error)}` : ""}</p></article>`).join("") : '<div class="empty-state">No knowledge sources added yet.</div>';
    $("knowledge-sources").querySelectorAll("[data-remove-knowledge]").forEach(btn => btn.addEventListener("click", async () => {
      await deleteKnowledgeSource(btn.dataset.removeKnowledge);
      await refreshKnowledgeSources();
    }));
  }
  await refreshKnowledgeSources();

  $("knowledge-add").addEventListener("click", async () => {
    const fileInput = $("knowledge-file");
    const file = fileInput.files?.[0];
    const errorEl = $("knowledge-error");
    const progressEl = $("knowledge-progress");
    errorEl.hidden = true;
    if (!file) { errorEl.hidden = false; errorEl.textContent = "Choose a file first."; return; }
    if (!isDesktop()) { errorEl.hidden = false; errorEl.textContent = "The knowledge store requires the installed desktop app (it calls Ollama directly)."; return; }
    const addButton = $("knowledge-add");
    addButton.disabled = true;
    progressEl.hidden = false;
    progressEl.textContent = "Reading file…";
    try {
      await addKnowledgeSource(
        { file, title: $("knowledge-title").value, author: $("knowledge-author").value },
        (progress) => {
          if (progress.stage === "extract") progressEl.textContent = progress.totalPages ? `Reading page ${progress.page} of ${progress.totalPages}…` : "Reading file…";
          else if (progress.stage === "embed") progressEl.textContent = `Embedding chunk ${progress.done} of ${progress.total}…`;
        }
      );
      fileInput.value = "";
      $("knowledge-title").value = "";
      $("knowledge-author").value = "";
      progressEl.textContent = "Done.";
      await refreshKnowledgeSources();
    } catch (error) {
      errorEl.hidden = false;
      errorEl.textContent = error?.message || String(error);
    } finally {
      addButton.disabled = false;
      setTimeout(() => { progressEl.hidden = true; }, 1500);
    }
  });

  const $briefingToggle = $("assistant-briefing-enabled");
  const $suggestionsToggle = $("assistant-suggestions-enabled");
  $briefingToggle.checked = isAssistantBriefingEnabled();
  $suggestionsToggle.checked = isAssistantSuggestionsEnabled();
  $briefingToggle.addEventListener("change", () => localStorage.setItem(ASSISTANT_SETTINGS_KEYS.briefing, String($briefingToggle.checked)));
  $suggestionsToggle.addEventListener("change", () => localStorage.setItem(ASSISTANT_SETTINGS_KEYS.suggestions, String($suggestionsToggle.checked)));
  const refreshDismissedCount = () => { const n = getDismissedCount(); $("assistant-dismissed-count").textContent = n ? `${n} suggestion${n === 1 ? "" : "s"} currently hidden.` : "No suggestions are currently hidden."; };
  refreshDismissedCount();
  $("assistant-clear-dismissed").addEventListener("click", () => { clearDismissedSuggestions(); refreshDismissedCount(); });

  const tabs = [...mount.querySelectorAll("[data-settings-tab]")];
  const panels = [...mount.querySelectorAll("[data-settings-panel]")];

  tabs.forEach(tab => tab.addEventListener("click", () => {
    tabs.forEach(t => {
      const active = t === tab;
      t.classList.toggle("settings-tab--active", active);
      t.setAttribute("aria-selected", String(active));
    });
    panels.forEach(panel => { panel.hidden = panel.dataset.settingsPanel !== tab.dataset.settingsTab; });
  }));

  function renderStatus(status) {
    return Object.values(status).map(item => {
      const localBooks = item.cachedBookCount || 0;
      const complete = item.id === "KJV" && localBooks >= 66;
      const label = `${localBooks}/${item.bookCount || 66} books local`;
      return `<div class="settings-translation"><div><strong>${escapeHtml(item.name)} (${escapeHtml(item.abbreviation)})</strong><span>${escapeHtml(label)}</span></div><div>${complete ? '<span class="status-badge status-badge--ready">Offline Ready</span>' : `<span class="status-badge">${localBooks ? "Partial" : "Online"}</span>`}${item.source === "local-upload" ? `<button class="text-button text-button--danger" data-delete-translation="${escapeHtml(item.id)}">Remove</button>` : ""}</div></div>`;
    }).join("");
  }

  async function refresh() {
    const status = await getTranslationStatus();
    const kjv = status.KJV;
    const local = Math.min(Number(kjv?.cachedBookCount || 0), 66);
    $("kjv-download-status").textContent = local >= 66 ? "66/66 books are stored locally and ready for offline use." : `${local}/66 books are stored locally. Download the complete KJV for offline use and concordance indexing.`;
    $("download-kjv").textContent = local >= 66 ? "Re-download KJV" : "Download KJV";
    $("translation-status").innerHTML = renderStatus(status);
    $("translation-status").querySelectorAll("[data-delete-translation]").forEach(button => button.addEventListener("click", async () => {
      const id = button.dataset.deleteTranslation;
      if (!window.confirm(`Remove local translation ${id}? This removes its locally imported Bible text.`)) return;
      await removeLocalTranslation(id);
      await refresh();
    }));

    const versions = await getAvailableBibleVersions();
    const select = $("settings-default-translation");
    const current = localStorage.getItem("pw:bible:translation") || "KJV";
    select.innerHTML = versions.map(v => `<option value="${escapeHtml(v.id)}">${escapeHtml(v.name)} (${escapeHtml(v.abbreviation)})</option>`).join("");
    select.value = versions.some(v => v.id === current) ? current : "KJV";
  }

  $("download-kjv").addEventListener("click", async () => {
    const button = $("download-kjv");
    const progress = $("kjv-progress");
    const bar = $("kjv-progress-bar");
    const label = $("kjv-progress-label");
    button.disabled = true;
    progress.hidden = false;
    try {
      const result = await downloadKJVLocally(({ completed, total, book }) => {
        const percent = Math.round((completed / total) * 100);
        bar.style.width = `${percent}%`;
        label.textContent = `Downloading ${book} · ${completed}/${total}`;
      });
      bar.style.width = "100%";
      label.textContent = `Complete · ${result.booksDownloaded} books and ${result.versesDownloaded.toLocaleString()} verses stored locally.`;
      await refresh();
    } catch (error) {
      label.textContent = `Download stopped: ${error.message}`;
    } finally {
      button.disabled = false;
    }
  });

  $("settings-default-translation").addEventListener("change", event => {
    localStorage.setItem("pw:bible:translation", event.target.value);
  });

  const initialFont = Number(localStorage.getItem("pw:bible:fontSize")) || 22;
  $("settings-font-size").value = initialFont;
  $("settings-font-size-value").value = `${initialFont}px`;
  $("settings-font-size").addEventListener("input", event => {
    const value = Number(event.target.value);
    localStorage.setItem("pw:bible:fontSize", value);
    $("settings-font-size-value").value = `${value}px`;
  });

  $("import-translation").addEventListener("click", async () => {
    const files = [...($("custom-translation-files").files || [])];
    const id = $("custom-translation-id").value.trim();
    const name = $("custom-translation-name").value.trim();
    const status = $("translation-import-status");
    if (!files.length) { status.textContent = "Choose at least one JSON file."; return; }
    if (!id) { status.textContent = "Enter a translation ID or abbreviation."; return; }
    status.textContent = `Reading ${files.length} JSON file${files.length === 1 ? "" : "s"}…`;
    try {
      let total = { booksImported: 0, chaptersImported: 0, versesImported: 0 };
      for (const file of files) {
        const parsed = JSON.parse(await file.text());
        const result = await importTranslationJson(parsed, { id, name: name || id, filename: file.name });
        total.booksImported += result.booksImported;
        total.chaptersImported += result.chaptersImported;
        total.versesImported += result.versesImported;
      }
      localStorage.setItem("pw:bible:translation", id.toUpperCase());
      status.textContent = `Imported ${total.booksImported} book(s), ${total.chaptersImported} chapter(s), and ${total.versesImported} verse(s). Stored locally.`;
      $("custom-translation-files").value = "";
      await refresh();
    } catch (error) {
      status.textContent = `Import failed: ${error.message}`;
    }
  });

  const appVersion = "0.30.0";
  $("app-version").textContent = appVersion;
  $("check-for-updates").addEventListener("click", async () => {
    const statusEl = $("update-status");
    const resultEl = $("update-result");
    const titleEl = $("update-result-title");
    const detailsEl = $("update-result-details");
    const openBtn = $("open-update-page");
    const installBtn = $("install-update");
    const progressEl = $("update-progress");
    statusEl.textContent = "Checking for updates…";
    resultEl.hidden = true;
    openBtn.hidden = true;
    installBtn.hidden = true;
    progressEl.textContent = "";
    try {
      const result = await checkForAppUpdate(appVersion);
      if (!result?.configured) {
        statusEl.textContent = isDesktop() ? "Update service is not configured yet." : "Updates are available in the desktop app.";
        titleEl.textContent = "Desktop updater";
        detailsEl.textContent = "Install the Windows desktop build to use signed in-app updates.";
        resultEl.hidden = false;
        return;
      }
      if (result.error) throw new Error(result.error);
      if (result.updateAvailable) {
        statusEl.textContent = `Version ${result.version} is available.`;
        titleEl.textContent = `Pastor's Workbench ${result.version} is available`;
        detailsEl.textContent = result.notes || "A newer signed release is available.";
        if (isDesktop()) {
          installBtn.hidden = false;
          installBtn.onclick = async () => {
            installBtn.disabled = true;
            openBtn.hidden = true;
            progressEl.textContent = "Downloading and installing… Windows will close Workbench during installation.";
            try { await installAppUpdate(); }
            catch (error) { progressEl.textContent = `Update failed: ${error?.message || String(error)}`; installBtn.disabled = false; }
          };
        }
        if (result.url) { openBtn.hidden = false; openBtn.onclick = () => openUpdatePage(result.url); }
      } else {
        statusEl.textContent = "You're up to date.";
        titleEl.textContent = "You're up to date";
        detailsEl.textContent = `Pastor's Workbench ${appVersion} is the current release.`;
      }
      resultEl.hidden = false;
    } catch (error) {
      statusEl.textContent = "Update check failed.";
      titleEl.textContent = "Could not check for updates";
      detailsEl.textContent = error?.message || String(error);
      resultEl.hidden = false;
    }
  });
  $("backup-before-update").addEventListener("click", () => {
    const payload = { version: appVersion, createdAt: new Date().toISOString(), note: "Application-level backup manifest. Full data backup should use the Workbench persistence/export layer before production updater activation." };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download=`pastors-workbench-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    $("backup-status").textContent = "Backup manifest downloaded.";
  });

  await refresh();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
