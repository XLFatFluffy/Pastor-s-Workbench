import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);

test("global AI context toggle safely rebinds after replacing its button", () => {
  const source = fs.readFileSync(path.join(root, "globalAI.js"), "utf8");
  assert.match(source, /const bindContextToggle=/);
  assert.match(source, /bindContextToggle\(\);/);
  assert.doesNotMatch(source, /onclick=\(\)=>document\.getElementById\('global-ai-context-toggle'\)\?\.click\(\)/);
});
