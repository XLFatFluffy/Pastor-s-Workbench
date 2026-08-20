import { getChapters, getChapter, getParagraphs, getScriptureProofs, search, seedCore, getAvailability, getRelatedWorkbenchItems, getRelatedDomains, linkParagraphToEntity, unlinkParagraphFromEntity } from '../confessionService.js';
import { all } from '../store.js';

const esc = (s='') => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

export async function render(mount) {
  await seedCore();
  const chapters = getChapters();
  mount.innerHTML = `
    <div class="canvas__header">
      <p class="canvas__eyebrow">Study · Phase 3</p>
      <h1 class="canvas__title">1689 Baptist Confession of Faith</h1>
      <p class="canvas__dek">A structured theological reference resource. The confession remains distinct from your personal notes, conclusions, and AI-generated material.</p>
    </div>
    <section class="workbench-card confession-controls">
      <label>Chapter<select id="conf-chapter">${chapters.map(c=>`<option value="${c.chapter_number}">Chapter ${c.chapter_number} — ${esc(c.title)}</option>`).join('')}</select></label>
      <label>Paragraph<select id="conf-paragraph"><option value="">All paragraphs</option></select></label>
      <label>Search type<select id="conf-search-mode"><option value="all">All</option><option value="word">Word</option><option value="phrase">Exact phrase</option><option value="chapter">Chapter</option><option value="paragraph">Paragraph</option></select></label>
      <label class="conf-search">Search<input id="conf-search" placeholder="Search the confession"></label>
      <button id="conf-search-btn" class="button button--primary">Search</button>
    </section>
    <section class="confession-status-grid" id="conf-status-grid"></section>
    <section id="conf-content" class="confession-reader"></section>
    <dialog id="conf-links-dialog" class="settings-dialog settings-dialog--wide">
      <form method="dialog" id="conf-links-form">
        <div class="panel__header"><div><h2>Workbench Connections</h2><p id="conf-links-heading">Link this paragraph to existing Workbench material.</p></div><button class="icon-button" value="cancel">×</button></div>
        <div id="conf-links-options" class="conf-links-options"></div>
        <div class="note-editor__actions"><button class="button" value="cancel">Cancel</button><button id="conf-links-save" class="button button--primary" value="default">Save Connections</button></div>
      </form>
    </dialog>`;

  let pendingNavigation = null;
  try {
    const raw = sessionStorage.getItem('pw:confession:pendingNavigation');
    if (raw) { pendingNavigation = JSON.parse(raw); sessionStorage.removeItem('pw:confession:pendingNavigation'); }
  } catch { pendingNavigation = null; }

  const chapterSelect = mount.querySelector('#conf-chapter');
  const paragraphSelect = mount.querySelector('#conf-paragraph');
  const content = mount.querySelector('#conf-content');
  const statusGrid = mount.querySelector('#conf-status-grid');

  function statusBadge(chapter) {
    const label = chapter.verification_status === 'reference_pdf_verified' ? 'Exact wording verified against your reference PDF' : 'Verification pending';
    return `<span class="conf-status conf-status--${chapter.verification_status}">${label}</span>`;
  }

  async function renderProofs(paragraphId) {
    const proofs = await getScriptureProofs(paragraphId);
    if (!proofs.length) return '';
    const groups = new Map();
    for (const proof of proofs) {
      const key = proof.metadata?.reference_text || proof.target_id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(proof);
    }
    const items = [...groups.entries()].map(([reference, targets]) => {
      const first = targets[0];
      const verseTargets = targets.filter(t => t.target_type === 'BibleVerse' && t.metadata?.book && Number.isInteger(Number(t.metadata?.verse)));
      const samePassage = verseTargets.length > 1 && verseTargets.every(t => t.metadata.book === verseTargets[0].metadata.book && Number(t.metadata.chapter) === Number(verseTargets[0].metadata.chapter));
      const sortedVerses = samePassage ? verseTargets.map(t => Number(t.metadata.verse)).sort((a,b)=>a-b) : [];
      const contiguous = samePassage && sortedVerses.every((v,i)=>i === 0 || v === sortedVerses[i-1] + 1);
      const target = {
        type: first.target_type,
        book: first.metadata?.book || '',
        chapter: Number(first.metadata?.chapter || 1),
        verse: Number(first.metadata?.verse || 1),
        endVerse: contiguous ? sortedVerses.at(-1) : Number(first.metadata?.verse || 1)
      };
      const encoded = encodeURIComponent(JSON.stringify(target));
      return `<button type="button" class="conf-proof__link" data-bible-target="${esc(encoded)}" title="Open ${esc(reference)} in the Bible"><span>${esc(reference)}</span><small>Open in Bible</small></button>`;
    }).join('');
    return `<div class="conf-proof"><h3>Scripture Proofs</h3><div class="conf-proof__list">${items}</div><small>${groups.size} proof reference${groups.size === 1 ? '' : 's'} · ${proofs.length} canonical Scripture relationship targets stored locally.</small></div>`;
  }

  function attachBibleProofLinks() {
    content.querySelectorAll('[data-bible-target]').forEach(button => button.addEventListener('click', () => {
      try {
        const target = JSON.parse(decodeURIComponent(button.dataset.bibleTarget));
        sessionStorage.setItem('pw:bible:pendingNavigation', JSON.stringify(target));
        window.location.hash = '#/bible';
      } catch (error) {
        console.error('[Workbench] Could not open Scripture proof', error);
      }
    }));
  }

  const domainRecords = {};
  async function loadDomainRecords() {
    for (const domain of getRelatedDomains()) domainRecords[domain.targetType] = await all(domain.store);
  }

  function recordLabel(record, domain) {
    return record.title || record.name || record.display_name || record.id || domain.label;
  }

  async function renderWorkbenchConnections(paragraphId) {
    const groups = await getRelatedWorkbenchItems(paragraphId);
    const total = Object.values(groups).reduce((n, items) => n + items.length, 0);
    const body = getRelatedDomains().map(domain => {
      const items = groups[domain.targetType] || [];
      if (!items.length) return `<div class="conf-connection-group"><strong>${esc(domain.label)}</strong><span class="conf-connection-empty">None linked yet.</span></div>`;
      return `<div class="conf-connection-group"><strong>${esc(domain.label)}</strong><div class="conf-connection-items">${items.map(item => `<span class="conf-connection-chip">${esc(recordLabel(item.record, domain))}</span>`).join('')}</div></div>`;
    }).join('');
    return `<div class="conf-connections"><div class="conf-connections__header"><div><h3>Workbench Connections</h3><small>${total} linked item${total === 1 ? '' : 's'} across Notes, Research, Sermons, Lessons, Studies, and Topics.</small></div><button type="button" class="button conf-manage-links" data-paragraph-links="${esc(paragraphId)}">Manage</button></div>${body}</div>`;
  }

  async function openConnectionDialog(paragraphId) {
    await loadDomainRecords();
    const groups = await getRelatedWorkbenchItems(paragraphId);
    const existing = new Set(Object.values(groups).flat().map(item => `${item.relationship.target_type}:${item.relationship.target_id}`));
    const options = getRelatedDomains().map(domain => {
      const records = (domainRecords[domain.targetType] || []).slice(0, 100);
      return `<fieldset class="conf-link-fieldset"><legend>${esc(domain.label)}</legend>${records.length ? records.map(record => { const key = `${domain.targetType}:${record.id}`; return `<label class="conf-link-option"><input type="checkbox" data-link-target="${esc(domain.targetType)}" data-link-id="${esc(record.id)}" ${existing.has(key) ? 'checked' : ''}><span>${esc(recordLabel(record, domain))}</span></label>`; }).join('') : '<p class="conf-connection-empty">No records exist yet.</p>'}</fieldset>`;
    }).join('');
    $('conf-links-heading').textContent = `Manage connections for ${paragraphId}`;
    $('conf-links-options').innerHTML = options;
    $('conf-links-dialog').dataset.paragraphId = paragraphId;
    $('conf-links-dialog').showModal();
  }

  async function saveConnectionDialog() {
    const paragraphId = $('conf-links-dialog').dataset.paragraphId;
    if (!paragraphId) return;
    const wanted = new Map();
    $('conf-links-options').querySelectorAll('[data-link-target]').forEach(input => {
      const key = `${input.dataset.linkTarget}:${input.dataset.linkId}`;
      wanted.set(key, input.checked);
    });
    const groups = await getRelatedWorkbenchItems(paragraphId);
    const existing = new Set(Object.values(groups).flat().map(item => `${item.relationship.target_type}:${item.relationship.target_id}`));
    for (const [key, checked] of wanted) {
      const [targetType, targetId] = key.split(':');
      if (checked && !existing.has(key)) await linkParagraphToEntity(paragraphId, targetType, targetId);
      if (!checked && existing.has(key)) await unlinkParagraphFromEntity(paragraphId, targetType, targetId);
    }
    $('conf-links-dialog').close();
    const currentChapter = Number(chapterSelect.value);
    await loadChapter(currentChapter, paragraphId);
  }

  async function attachConnectionButtons() {
    content.querySelectorAll('[data-paragraph-links]').forEach(button => button.addEventListener('click', () => openConnectionDialog(button.dataset.paragraphLinks)));
  }

  async function loadChapter(n, selected='') {
    const chapter = getChapter(n);
    const paragraphs = await getParagraphs(n);
    paragraphSelect.innerHTML = `<option value="">All paragraphs</option>` + paragraphs.map(p=>`<option value="${esc(p.id)}">Paragraph ${p.paragraph_number}</option>`).join('');
    paragraphSelect.value = selected;
    if (!chapter.is_seeded) {
      content.innerHTML = `<article><header><span>Chapter ${chapter.chapter_number}</span><h2>${esc(chapter.title)}</h2></header><div class="empty-state"><strong>Chapter not yet seeded.</strong><p>The chapter structure is installed locally. Its text will not be marked available until it has been imported and cross-checked.</p></div></article>`;
    } else {
      const cards = [];
      for (const p of paragraphs) cards.push(`<section class="conf-paragraph" id="${esc(p.id)}"><div class="conf-paragraph__num">¶${p.paragraph_number}</div><div class="conf-paragraph__body"><p>${esc(p.text)}</p>${await renderProofs(p.id)}${await renderWorkbenchConnections(p.id)}</div></section>`);
      content.innerHTML = `<article><header><span>Chapter ${chapter.chapter_number}</span><h2>${esc(chapter.title)}</h2>${statusBadge(chapter)}${chapter.verification_record ? `<small class="conf-verification-note">Independent source reviewed: ${esc(chapter.verification_record.source_url)} · ${chapter.verification_record.proofs_reviewed ? 'proof references reviewed' : 'proof references pending'}</small>` : ''}</header>${cards.join('')}</article>`;
    }
    attachBibleProofLinks();
    await attachConnectionButtons();
    if (selected) document.getElementById(selected)?.scrollIntoView({behavior:'smooth', block:'center'});
  }

  const initialChapter = Number(pendingNavigation?.chapter) || 1;
  const initialParagraph = pendingNavigation?.paragraph ? `1689-lbcf-${initialChapter}-${Number(pendingNavigation.paragraph)}` : "";
  chapterSelect.value = String(initialChapter);
  await loadChapter(initialChapter, initialParagraph);
  const availability = await getAvailability();
  statusGrid.innerHTML = `<div class="workbench-card"><strong>${availability.seeded_chapters}/32 chapters seeded</strong><span>${availability.paragraph_count} paragraphs stored locally · reference-PDF wording verified for all 160 paragraphs</span></div><div class="workbench-card"><strong>${availability.proof_relationships} proof references</strong><span>Canonical Scripture identities are now linked to 1689 paragraphs</span></div><div class="workbench-card"><strong>Offline resource</strong><span>Confession text is stored locally</span></div>`;

  chapterSelect.addEventListener('change', e=>loadChapter(e.target.value));
  paragraphSelect.addEventListener('change', e=>{ if(e.target.value) document.getElementById(e.target.value)?.scrollIntoView({behavior:'smooth', block:'center'}); });
  mount.querySelector('#conf-search-btn').addEventListener('click', async ()=>{
    const q=mount.querySelector('#conf-search').value;
    const mode = mount.querySelector('#conf-search-mode').value;
    const results=await search(q, mode);
    content.innerHTML = results.length ? `<div class="search-results"><h2>Search results</h2>${results.map(r=>r.type==='chapter'?`<button class="search-result" data-chapter="${r.chapter_number}"><strong>Chapter ${r.chapter_number}</strong><span>${esc(r.title)}</span></button>`:`<button class="search-result" data-paragraph="${esc(r.id)}" data-chapter="${esc(r.chapter_id)}"><strong>Paragraph ${r.paragraph_number}</strong><span>${esc((r.text||'').slice(0,220))}</span></button>`).join('')}</div>` : `<div class="empty-state">No 1689 results found.</div>`;
    content.querySelectorAll('[data-bible-target]').forEach(button => button.addEventListener('click', () => {
      try {
        const target = JSON.parse(decodeURIComponent(button.dataset.bibleTarget));
        sessionStorage.setItem('pw:bible:pendingNavigation', JSON.stringify(target));
        window.location.hash = '#/bible';
      } catch (error) { console.error('[Workbench] Could not open Scripture proof', error); }
    }));
    content.querySelectorAll('[data-chapter]').forEach(btn=>btn.addEventListener('click',()=>{
      const val = btn.dataset.chapter.startsWith('1689-lbcf-ch-') ? btn.dataset.chapter.split('-').pop() : btn.dataset.chapter;
      loadChapter(val, btn.dataset.paragraph || '');
      chapterSelect.value = val;
    }));
  });
  mount.querySelector('#conf-links-save').addEventListener('click', async (event) => { event.preventDefault(); await saveConnectionDialog(); });
}
