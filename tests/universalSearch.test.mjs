import assert from 'node:assert/strict';
import fs from 'node:fs';
assert.ok(fs.existsSync('searchService.js'));
assert.ok(fs.existsSync('views/searchView.js'));
const main=fs.readFileSync('main.js','utf8');
const index=fs.readFileSync('index.html','utf8');
assert.match(main,/id: "search"/);
assert.match(index,/href="#\/search"/);
console.log('universal search contract: PASS');
