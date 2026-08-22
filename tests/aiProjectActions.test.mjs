import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const ai = fs.readFileSync(new URL("../aiService.js", import.meta.url), "utf8");
const globalAI = fs.readFileSync(new URL("../globalAI.js", import.meta.url), "utf8");
const main = fs.readFileSync(new URL("../main.js", import.meta.url), "utf8");
const work = fs.readFileSync(new URL("../views/workWorkspaceView.js", import.meta.url), "utf8");

test("AI system prompt supports automatic project actions", () => {
  assert.match(ai, /type\":\"project\"/);
  assert.match(ai, /operation\":\"create\|open\"/);
  assert.match(ai, /project_type\":\"study\|sermon\|lesson/);
  assert.match(ai, /executed automatically/);
});

test("project AI actions create specialized study workspaces and navigate to them", () => {
  assert.match(ai, /saveStudy\(\{ project_id: project.id/);
  assert.match(ai, /initializeSermonWorkflow\(sermon.id\)/);
  assert.match(ai, /window.location.hash = `#\/projects\?project=/);
});

test("project route accepts query parameters without breaking routing", () => {
  assert.match(main, /const id = hash.split\(\"\?\"\)\[0\];/);
});

test("work view consumes the pending project and opens its workspace", () => {
  assert.match(work, /__pwbPendingProjectOpen/);
  assert.match(work, /await openProject\(panel, project.id, project.project_type\)/);
});

test("automatic project actions are not shown as approval cards", () => {
  assert.match(globalAI, /isAutomaticAction/);
  assert.match(globalAI, /filter\(a => !isAutomaticAction\(a\)\)/);
});
