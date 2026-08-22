// theme.js — Phase 3 visual overhaul (see PASTORS-WORKBENCH-ROADMAP.md).
// Handles the two additive ambiance features that sit outside any single
// view: the rotating Puritan/Reformation-era quote strip, and the
// Focus Mode / Immersive Mode toggles. Pure UI chrome — no domain data,
// no AI calls, safe to run on every route.

const STORAGE_KEY_FOCUS = "pwb:focus-mode";
const STORAGE_KEY_IMMERSIVE = "pwb:immersive-mode";

// Public-domain quotations from Puritan and Reformation-era writers, used
// only as ambient chrome (never cited by the AI as source material — the
// AI's mandatory-citation requirement in the roadmap applies to retrieval
// answers, not to this decorative strip).
const QUOTES = [
  { text: "A Christian should always have two books open before him: the Bible, and the book of Providence.", by: "C. H. Spurgeon" },
  { text: "He is no fool who parts with that which he cannot keep, when he is sure to be recompensed with that which he cannot lose.", by: "Jim Elliot" },
  { text: "The mercy of God is so unspeakably great that He will pardon sin, in whomsoever He finds true faith to lay hold on Christ.", by: "Martin Luther" },
  { text: "Prayer is nothing but the promises turned into arguments.", by: "Thomas Manton" },
  { text: "Communion with God is the very life and marrow of religion.", by: "John Owen" },
  { text: "The greatest and sweetest glory of a Christian is to be found continually in the practice of holiness.", by: "John Flavel" },
  { text: "A man that hath a wife and children wants not more affliction, but more sanctified affliction, than a single life doth afford.", by: "Richard Baxter" },
  { text: "Faith is the eye by which the soul sees Christ, the hand by which we lay hold on Him.", by: "Ralph Erskine" },
  { text: "It is our duty to keep close to the Word of God, and to hold fast the form of sound words.", by: "Thomas Watson" },
  { text: "The Scriptures teach us the best way of living, the noblest way of suffering, and the most comfortable way of dying.", by: "John Flavel" },
  { text: "Every accession of gospel light gives new discoveries of the vileness of the human heart.", by: "Charles Hodge" },
  { text: "Sound doctrine is the very lifeblood of a healthy church.", by: "J. C. Ryle" }
];

function pickDailyQuote() {
  const dayIndex = Math.floor(Date.now() / 86400000);
  return QUOTES[dayIndex % QUOTES.length];
}

function renderQuote() {
  const mount = document.getElementById("ambient-quote");
  if (!mount) return;
  if (document.body.classList.contains("focus-mode")) {
    mount.innerHTML = "";
    return;
  }
  const quote = pickDailyQuote();
  mount.innerHTML = `\u201C${quote.text}\u201D<span class="ambient-quote__attribution">${quote.by}</span>`;
}

function applyStoredModes() {
  const focusOn = localStorage.getItem(STORAGE_KEY_FOCUS) === "1";
  const immersiveOn = localStorage.getItem(STORAGE_KEY_IMMERSIVE) === "1";
  document.body.classList.toggle("focus-mode", focusOn);
  document.body.classList.toggle("immersive-mode", immersiveOn);
  syncButton("focus-mode-toggle", focusOn);
  syncButton("immersive-mode-toggle", immersiveOn);
}

function syncButton(id, isOn) {
  const btn = document.getElementById(id);
  if (btn) btn.setAttribute("aria-pressed", String(isOn));
}

function wireToggle(buttonId, storageKey, bodyClass) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.addEventListener("click", () => {
    const next = !document.body.classList.contains(bodyClass);
    document.body.classList.toggle(bodyClass, next);
    localStorage.setItem(storageKey, next ? "1" : "0");
    syncButton(buttonId, next);
    renderQuote();
  });
}

function initTheme() {
  applyStoredModes();
  renderQuote();
  wireToggle("focus-mode-toggle", STORAGE_KEY_FOCUS, "focus-mode");
  wireToggle("immersive-mode-toggle", STORAGE_KEY_IMMERSIVE, "immersive-mode");

  // Views are swapped in and out of #app-view by main.js's hash router;
  // re-render the quote whenever the route changes so it never goes stale
  // or disappears after navigation.
  window.addEventListener("hashchange", renderQuote);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTheme);
} else {
  initTheme();
}
