import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const src = await readFile(new URL('../crossReferenceService.js', import.meta.url), 'utf8');
assert.match(src, /cross_reference_index/);
assert.match(src, /importCrossReferenceCorpus/);
assert.match(src, /CC BY/);
assert.match(src, /relationship_type: "other"/);

const sample = 'GEN.1.1\tEXO.20.11\t12\nGEN.1.1\tJOH.1.1\t4\n';
const rows = sample.trim().split(/\r?\n/).map(line => line.split('\t'));
assert.equal(rows.length, 2);
assert.equal(rows[0][2], '12');
console.log('Cross-reference corpus contract: PASS');
