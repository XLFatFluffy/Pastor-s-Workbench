import { universalSearch } from '../searchService.js';
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

export async function render(mount) {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const initial = params.get('q') || '';
  mount.innerHTML = `<div class="canvas__header"><p class="canvas__eyebrow">Knowledge</p><h1 class="canvas__title">Universal Search</h1><p class="canvas__dek">Search your Workbench across projects, sermons, lessons, studies, notes, research, books, tasks, calendar items, and more.</p></div>
  <section class="reader-panel"><form id="universal-search-form" class="search-row"><input id="universal-search-input" type="search" value="${esc(initial)}" placeholder="Search everything in Pastor's Workbench…" autocomplete="off" autofocus><button class="button button--primary">Search</button></form><div id="universal-search-status" class="muted" aria-live="polite" style="margin-top:.75rem"></div><div id="universal-search-results" style="margin-top:1rem"></div></section>`;
  const input=mount.querySelector('#universal-search-input'); const status=mount.querySelector('#universal-search-status'); const results=mount.querySelector('#universal-search-results');
  async function run(q) {
    q=String(q||'').trim(); if(!q){status.textContent='Enter a search term.';results.innerHTML='';return;}
    status.textContent='Searching your local Workbench…'; results.innerHTML='';
    const rows=await universalSearch(q); status.textContent=`${rows.length} result${rows.length===1?'':'s'} found.`;
    results.innerHTML=rows.length ? rows.map(r=>`<article class="knowledge-card"><div class="knowledge-card__head"><div><span class="pill">${esc(r.type)}</span>${r.connected?'<span class="pill">Connected to current workspace</span>':''}<h3>${esc(r.title)}</h3></div><a class="text-button" href="${r.href}">Open</a></div>${r.preview?`<p class="rich-preview">${esc(r.preview)}</p>`:''}</article>`).join('') : '<div class="empty-state">Nothing matched. Try a different word or phrase.</div>';
  }
  mount.querySelector('#universal-search-form').onsubmit=e=>{e.preventDefault(); run(input.value); history.replaceState(null,'',`#/search?q=${encodeURIComponent(input.value.trim())}`);};
  if(initial) await run(initial);
}
