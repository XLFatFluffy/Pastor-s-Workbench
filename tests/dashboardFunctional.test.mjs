import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../views/dashboardView.js', import.meta.url), 'utf8');
assert.match(source, /listProjects\(\)/, 'dashboard should load live projects');
assert.match(source, /listSpecialized\("sermon"\)/, 'dashboard should load live sermons');
assert.match(source, /getKnowledgeStats\(\)/, 'dashboard should load live knowledge stats');
assert.match(source, /getBookStats\(\)/, 'dashboard should load live book stats');
assert.match(source, /pwb:ai-prompt/, 'dashboard should launch the global AI overlay with contextual prompts');
assert.match(source, /saveProject\(/, 'dashboard should support creating a sermon project');
assert.match(source, /initializeSermonWorkflow\(/, 'new dashboard sermons should initialize the expository workflow');
console.log('dashboard functional contract: PASS');
