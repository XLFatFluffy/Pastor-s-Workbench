import { parseScriptureReference, getProofSeedEntries } from '../confessionService.js';
import assert from 'node:assert/strict';
import resource from '../data/1689/seed.json' with { type: 'json' };
import chapters from '../data/1689/chapters.json' with { type: 'json' };

assert.equal(resource.chapters.length, 32);
assert.equal(chapters.chapters.length, 32);
assert.equal(resource.chapters.reduce((n,c)=>n+c.paragraphs.length,0), 160);
assert.equal(resource.chapters[0].paragraphs.length, 10);
assert.equal(resource.chapters.find(c => c.number === 3).paragraphs[0].number, 1);
for (const chapter of resource.chapters) {
  const nums = chapter.paragraphs.map(p => p.number);
  assert.deepEqual(nums, Array.from({length: nums.length}, (_, i) => i + 1), `Paragraph numbering broken in chapter ${chapter.number}`);
  for (const paragraph of chapter.paragraphs) assert.ok(paragraph.text.trim(), `Missing text in ${chapter.number}.${paragraph.number}`);
}
assert.equal(resource.metadata.source, 'User-provided baptist confession of faith.pdf');
assert.equal(resource.metadata.wording_status, 'reference_pdf_verified');

const proofEntries = getProofSeedEntries();
assert.ok(proofEntries.length > 800, 'Expected the full imported proof-text set.');
assert.ok(proofEntries.every(entry => Number.isInteger(entry.chapterNumber) && Number.isInteger(entry.paragraphNumber) && entry.reference.trim()));
assert.ok(proofEntries.every(entry => !entry.reference.trim().startsWith('*')));

// Canonical Scripture identity regression tests.
assert.deepEqual(parseScriptureReference('Rom 9:15'), [{ kind:'verse', book:'Rom', chapter:9, verse:15, canonicalVerseId:'romans-9-15' }]);
assert.equal(parseScriptureReference('Rom 4:5-8').length, 4);
assert.deepEqual(parseScriptureReference('Psa 51').map(x=>x.kind), ['chapter']);
assert.equal(parseScriptureReference('3Jo 8-10').length, 3);
assert.equal(parseScriptureReference('Rev 2-3').length, 2);
assert.equal(parseScriptureReference('Rom 1:19-21; 2:14-15').length, 5);
assert.equal(parseScriptureReference('1Co 11:13-14; 14:26,40').length, 4);
assert.ok(parseScriptureReference('Rom 3:20; 7:7; etc.').every(x => x.kind === 'verse'));
assert.equal(parseScriptureReference('*').length, 0);
console.log('confession.test.mjs: PASS');
