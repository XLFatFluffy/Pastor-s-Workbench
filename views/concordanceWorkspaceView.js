// concordanceWorkspaceView.js — Phase 5 Concordance workspace.

import {
  buildKjvConcordance,
  getConcordanceStatus,
  searchConcordance
} from "../concordanceService.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderStatus(status) {
  const completeness = `${status.localBookCount}/${status.expectedBookCount} KJV books stored locally`;
  const indexed = `${status.indexedWordCount.toLocaleString()} indexed words`;
  const occurrences = `${status.occurrenceCount.toLocaleString()} verse occurrences`;
  return `
    <div class="concordance-status" id="concordance-status">
      <div><span>Local Bible</span><strong>${escapeHtml(completeness)}</strong></div>
      <div><span>Index</span><strong>${escapeHtml(indexed)}</strong></div>
      <div><span>Occurrences</span><strong>${escapeHtml(occurrences)}</strong></div>
      <div><span>Status</span><strong>${status.ready ? "Ready" : status.completeLocalBible ? "Not built" : "KJV incomplete"}</strong></div>
    </div>`;
}

function resultMarkup(result) {
  const reference = `${result.book} ${result.chapter}:${result.verse}`;
  return `
    <button class="concordance-result" type="button"
      data-book="${escapeHtml(result.book)}"
      data-chapter="${result.chapter}"
      data-verse="${result.verse}">
      <strong>${escapeHtml(reference)}</strong>
      <span>${escapeHtml(result.text)}</span>
    </button>`;
}

export async function render(mount) {
  mount.innerHTML = `
    <div class="canvas__header">
      <p class="canvas__eyebrow">Study · Phase 5</p>
      <h1 class="canvas__title">Concordance</h1>
      <p class="canvas__dek">Search the locally indexed King James Version by word and move directly to any occurrence in the Bible.</p>
    </div>
    <div class="workspace-grid concordance-workspace">
      <section class="panel panel--wide">
        <div class="panel__header">
          <div>
            <h2>KJV Word Index</h2>
            <p>The concordance is built from Bible text already stored locally. It will never silently fetch Scripture from the network.</p>
          </div>
          <button class="button button--primary" id="build-concordance" type="button">Build / Rebuild Index</button>
        </div>
        <div id="concordance-status-mount"></div>
        <div id="concordance-message" class="concordance-message" role="status" aria-live="polite"></div>
      </section>

      <section class="panel panel--wide">
        <div class="panel__header">
          <div>
            <h2>Search KJV</h2>
            <p>Search an exact word, or switch to prefix mode to find words beginning with the same letters.</p>
          </div>
        </div>
        <form class="search-row concordance-search" id="concordance-form">
          <input id="concordance-query" type="search" autocomplete="off" placeholder="Search a word, e.g. grace" aria-label="Search KJV concordance" />
          <select id="concordance-mode" aria-label="Search mode">
            <option value="exact">Exact word</option>
            <option value="prefix">Starts with</option>
          </select>
          <button class="button button--primary" type="submit">Search</button>
        </form>
        <div id="concordance-results" class="concordance-results" aria-live="polite"></div>
      </section>
    </div>
  `;

  const statusMount = mount.querySelector("#concordance-status-mount");
  const message = mount.querySelector("#concordance-message");
  const results = mount.querySelector("#concordance-results");
  const form = mount.querySelector("#concordance-form");
  const query = mount.querySelector("#concordance-query");
  const mode = mount.querySelector("#concordance-mode");
  const buildButton = mount.querySelector("#build-concordance");

  async function refreshStatus() {
    const status = await getConcordanceStatus();
    statusMount.innerHTML = renderStatus(status);
    buildButton.disabled = !status.completeLocalBible;
    if (!status.completeLocalBible) {
      message.textContent = `The complete KJV is not stored locally yet (${status.localBookCount}/${status.expectedBookCount} books). Load all KJV books in the local Bible store before building the index.`;
    } else if (!status.ready) {
      message.textContent = "The complete local KJV is available. Build the concordance index to begin searching.";
    } else {
      message.textContent = "The concordance index is ready.";
    }
    return status;
  }

  await refreshStatus();

  buildButton.addEventListener("click", async () => {
    buildButton.disabled = true;
    message.textContent = "Building the KJV word index from local Scripture…";
    try {
      const status = await buildKjvConcordance({ replace: true });
      statusMount.innerHTML = renderStatus(status);
      message.textContent = `Index rebuilt: ${status.indexedWordCount.toLocaleString()} words across ${status.occurrenceCount.toLocaleString()} verse occurrences.`;
    } catch (error) {
      message.textContent = error?.message || String(error);
    } finally {
      buildButton.disabled = !(await getConcordanceStatus()).completeLocalBible;
    }
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const term = query.value.trim();
    results.innerHTML = "";
    if (!term) {
      message.textContent = "Enter a word to search.";
      return;
    }

    const status = await getConcordanceStatus();
    if (!status.ready) {
      message.textContent = "Build the concordance index before searching.";
      return;
    }

    message.textContent = "Searching…";
    try {
      const found = await searchConcordance(term, { mode: mode.value, limit: 500 });
      results.innerHTML = found.length
        ? `<div class="concordance-result-count">${found.length.toLocaleString()} occurrence${found.length === 1 ? "" : "s"} shown</div>${found.map(resultMarkup).join("")}`
        : `<div class="empty-state">No KJV occurrences found for “${escapeHtml(term)}”.</div>`;
      message.textContent = "";
    } catch (error) {
      message.textContent = error?.message || String(error);
    }
  });

  results.addEventListener("click", event => {
    const button = event.target.closest("[data-book]");
    if (!button) return;
    // One-shot navigation only — matches the pattern used by Confession's
    // Scripture proof links (confessionWorkspaceView.js). Using sessionStorage
    // here (rather than writing directly into the persisted pw:bible:* keys)
    // means a concordance lookup jumps to the verse without permanently
    // overwriting the reader's saved translation/position for next time.
    const target = {
      type: "BibleVerse",
      book: button.dataset.book,
      chapter: Number(button.dataset.chapter),
      verse: Number(button.dataset.verse),
      endVerse: Number(button.dataset.verse)
    };
    sessionStorage.setItem("pw:bible:pendingNavigation", JSON.stringify(target));
    window.location.hash = "#/bible";
  });
}
