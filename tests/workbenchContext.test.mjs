import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);

test("global AI context can read the user's structured Workbench", () => {
  const source = fs.readFileSync(path.join(root, "contextService.js"), "utf8");
  for (const store of ["projects","sermons","sermon_stages","sermon_points","lessons","studies","notes","research_items","topics","collections"]) assert.match(source, new RegExp(`['\"]${store}['\"]`));
  assert.match(source, /CURRENT WORKBENCH SCREEN/);
  assert.match(source, /UPLOADED BOOK LIBRARY/);
  assert.match(source, /BIBLE SEARCH RESULTS/);
  assert.match(source, /1689 CONFESSION SEARCH RESULTS/);
});

test("AI service passes Workbench context to Ollama", () => {
  const source = fs.readFileSync(path.join(root, "aiService.js"), "utf8");
  assert.match(source, /buildWorkbenchContext/);
  assert.match(source, /includeWorkbench/);
  assert.match(source, /WORKBENCH CONTEXT/);
});
