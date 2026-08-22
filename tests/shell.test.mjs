import assert from "node:assert/strict";
import fs from "node:fs";
import { ROUTES } from "../main.js";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
assert.ok(html.includes('id="rail-sections"'));
assert.ok(html.includes('data-route-id="dashboard"'));
assert.ok(html.includes('data-route-id="bible"'));
assert.ok(html.includes('data-route-id="ai"'));

const ids = ROUTES.map((route) => route.id);
assert.equal(new Set(ids).size, ids.length);
assert.ok(ids.includes("dashboard"));
assert.ok(ids.includes("bible"));
assert.ok(ids.includes("settings"));
assert.ok(ROUTES.every((route) => route.view));

console.log("shell tests passed");
