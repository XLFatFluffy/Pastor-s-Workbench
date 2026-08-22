// views/stubView.js — generic placeholder for any route not yet built.
import { renderPlaceholder } from "./placeholderView.js";

export function render(mount, route) {
  renderPlaceholder(mount, {
    eyebrow: route.section,
    title: route.label,
    phaseNote: "Scoped in the rebuild plan; not yet scheduled in the current phase.",
  });
}
