// views/placeholderView.js
// Shared "not yet built" renderer. Every stub view (bibleWorkspaceView,
// confessionWorkspaceView, calendarView, stubView, etc.) calls this instead
// of hand-rolling its own placeholder markup, so there is one place to
// update the empty-state pattern.

export function renderPlaceholder(mount, { eyebrow, title, dek, phaseNote }) {
  mount.innerHTML = `
    <div class="canvas__header">
      <p class="canvas__eyebrow">${eyebrow}</p>
      <h1 class="canvas__title">${title}</h1>
      ${dek ? `<p class="canvas__dek">${dek}</p>` : ""}
    </div>
    <div class="placeholder-view">
      <p>This workspace has not been built yet.</p>
      ${phaseNote ? `<p class="boot-note">${phaseNote}</p>` : ""}
    </div>
  `;
}
