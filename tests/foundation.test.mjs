import assert from "node:assert/strict";
import fs from "node:fs";
import { ENTITY_TYPES, getSchema } from "../dataModel.js";
import { STORE_NAMES } from "../store.js";

const requiredFiles = [
  "index.html", "main.js", "store.js", "dataModel.js", "relationships.js",
  "bibleService.js", "confessionService.js", "concordanceService.js",
  "crossReferenceService.js", "researchService.js", "libraryService.js",
  "sermonService.js", "calendarService.js", "documentService.js", "styles.css",
  "views/dashboardView.js", "views/bibleWorkspaceView.js"
];
for (const file of requiredFiles) assert.ok(fs.existsSync(file), `Missing foundation file: ${file}`);

assert.equal(ENTITY_TYPES.length, 34, "Foundation data model should expose the approved core/resource/planning entities.");
for (const entity of ENTITY_TYPES) {
  const schema = getSchema(entity);
  assert.ok(schema.includes("id"), `${entity} must have a stable id field.`);
  assert.ok(schema.length >= 2, `${entity} schema is unexpectedly empty.`);
}

assert.ok(STORE_NAMES.includes("relationships"));
assert.ok(STORE_NAMES.includes("versions"));
assert.ok(STORE_NAMES.includes("changes"));
assert.ok(STORE_NAMES.includes("bible_verses"));
assert.ok(STORE_NAMES.includes("calendar_events"));
assert.ok(STORE_NAMES.includes("daily_tasks"));

const storeSource = fs.readFileSync("store.js", "utf8");
assert.match(storeSource, /export async function (get|put|all|remove|bulk)/);
assert.doesNotMatch(storeSource, /fetch\s*\(/, "store.js must not perform network access.");
assert.doesNotMatch(storeSource, /validateRecord|searchIndex|syncQueue/i, "store.js must remain a pure persistence wrapper.");

const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("styles.css", "utf8");
assert.ok(html.includes('id="rail-sections"'));
assert.ok(css.includes("--oxblood"));
assert.ok(css.includes("Source Serif 4") || css.includes("var(--font-read)"));

console.log("foundation tests passed");
