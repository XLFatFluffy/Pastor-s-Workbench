// views/calendarView.js
import { renderPlaceholder } from "./placeholderView.js";

export function render(mount) {
  renderPlaceholder(mount, {
    eyebrow: "Planning",
    title: "Calendar",
    phaseNote: "Not yet scheduled in the current phase sequence.",
  });
}
