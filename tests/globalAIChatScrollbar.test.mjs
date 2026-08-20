import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const js = fs.readFileSync(new URL('../globalAI.js', import.meta.url), 'utf8');
assert.match(css, /\.global-ai__messages\{[^}]*overflow-y:scroll/, 'AI messages should always expose a vertical scrollbar');
assert.match(css, /scrollbar-gutter:stable/, 'AI chat should reserve space for the scrollbar');
assert.match(js, /pwb:ai-prompt/, 'AI overlay should accept contextual prompts from Workbench screens');
assert.match(js, /export function openGlobalAIWithPrompt/, 'AI overlay should expose a reusable prompt launcher');
console.log('global AI chat scrollbar contract: PASS');

assert.match(js, /global-ai__scrollbar/, 'AI chat should include an always-visible scrollbar control');
assert.match(js, /updateChatScrollbar/, 'AI scrollbar should track conversation scrolling');
assert.match(css, /global-ai__messages-wrap\{min-height:0;flex:1;display:flex/, 'AI messages need a dedicated scroll container');
console.log('custom AI scrollbar contract: PASS');

assert.match(js, /box\.scrollBy|box\.scrollTop/, 'AI scrollbar must actively change the conversation scroll position');
assert.match(js, /pointermove/, 'AI scrollbar thumb must support dragging');
assert.match(css, /pwb-taskbar-safe-bottom/, 'AI composer must reserve space above the Windows taskbar');
console.log('AI scrollbar interaction and taskbar-safe composer contract: PASS');
