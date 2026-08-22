import assert from 'node:assert/strict';
import fs from 'node:fs';

assert.ok(fs.existsSync('assistantService.js'));
const dashboard = fs.readFileSync('views/dashboardView.js', 'utf8');
assert.match(dashboard, /Pastor's Daily Briefing/);
assert.match(dashboard, /Quick Capture/);
assert.match(dashboard, /getDailyBriefing/);
assert.match(dashboard, /saveTask/);
assert.match(dashboard, /saveNote/);
assert.match(dashboard, /saveResearchItem/);
const roadmap = fs.readFileSync('PASTORS-WORKBENCH-ROADMAP.md', 'utf8');
assert.match(roadmap, /all-around pastor's assistant/i);
assert.match(roadmap, /Universal Search/);
assert.match(roadmap, /Pastoral Care/);
assert.match(roadmap, /Morning Briefing/);
console.log('assistant core roadmap/UI contract passed');
