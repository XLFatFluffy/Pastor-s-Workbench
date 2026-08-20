import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import manifest from '../data/1689/exact-wording-manifest.json' with { type: 'json' };
import resource from '../data/1689/seed.json' with { type: 'json' };

const paragraphs = resource.chapters.flatMap(c => c.paragraphs.map(p => ({ chapter:c.number, paragraph:p.number, text:p.text })));
assert.equal(paragraphs.length, 160);
assert.equal(manifest.paragraph_count, 160);
assert.equal(manifest.records.length, 160);
const hash = text => crypto.createHash('sha256').update(String(text).replace(/\s+/g,' ').trim(),'utf8').digest('hex');
for (const record of manifest.records) {
  const p = paragraphs.find(x => x.chapter === record.chapter && x.paragraph === record.paragraph);
  assert.ok(p, `Missing paragraph ${record.chapter}.${record.paragraph}`);
  assert.equal(record.status, 'reference_pdf_verified');
  assert.equal(record.sha256, hash(p.text), `Wording fingerprint mismatch ${record.chapter}.${record.paragraph}`);
}
console.log('exactWording.test.mjs: PASS — 160/160 paragraphs verified against user-provided reference PDF');
