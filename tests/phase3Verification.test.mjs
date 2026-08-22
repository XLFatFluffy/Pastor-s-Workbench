import assert from 'node:assert/strict';
import resource from '../data/1689/seed.json' with { type: 'json' };
import verification from '../data/1689/verification.json' with { type: 'json' };
assert.equal(resource.chapters.length, 32);
assert.equal(resource.chapters.reduce((n,c)=>n+c.paragraphs.length,0), 160);
assert.equal(verification.records.length, 32);
assert.ok(verification.records.every(r => r.status === 'reference_pdf_verified'));
assert.ok(verification.records.every(r => r.proofs_reviewed === true));
console.log('phase3Verification.test.mjs: PASS — 32/32 chapters and 160/160 paragraphs reference-PDF verified');
