import { askAI, checkOllama, getAISettings, saveAISettings } from '../aiService.js';
import { listBooks } from '../libraryService.js';

const esc = v => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

export async function render(mount) {
  mount.innerHTML = `
    <section class="canvas__header"><p class="canvas__eyebrow">System · Local AI</p><h1 class="canvas__title">AI Study Assistant</h1><p class="canvas__dek">Your local Ollama model can work with your Bible study, sermons, research, and uploaded books. Book material is retrieved as context; it does not retrain the model.</p></section>
    <section class="study-grid ai-workspace">
      <div class="reader-panel"><div class="reader-panel__head"><div><p class="canvas__eyebrow">Conversation</p><h2>Ask your Workbench</h2></div><span id="ai-status" class="pill">Checking Ollama…</span></div>
        <div id="ai-messages" class="ai-messages"><div class="empty-state">Ask a question to begin. Book Library context is enabled by default.</div></div>
        <form id="ai-form" class="tool-form"><label>Question or instruction<textarea id="ai-input" rows="5" required placeholder="Ask about a passage, sermon, doctrine, book, or research question…"></textarea></label><div class="ai-toolbar"><label class="ai-check"><input id="ai-books" type="checkbox" checked> Use my Book Library</label><label>Model<select id="ai-model"></select></label><button class="button button--primary button--large" type="submit">Ask AI</button></div><div id="ai-error" class="error-panel" hidden></div></form>
      </div>
      <aside class="reader-panel"><div class="reader-panel__head"><div><p class="canvas__eyebrow">Sources</p><h2>Retrieved books</h2></div></div><div id="ai-sources" class="empty-state">Sources used for the current answer will appear here.</div><div class="knowledge-card"><strong>What this AI does</strong><p>Ollama runs the selected model locally. The Workbench searches your uploaded books and supplies relevant passages to the model. The response records which passages were supplied so you can check the source.</p></div><a class="button" href="#/settings">Open AI Settings</a></aside>
    </section>`;
  const settings = getAISettings();
  const modelSelect = mount.querySelector('#ai-model');
  const status = mount.querySelector('#ai-status');
  const messages = mount.querySelector('#ai-messages');
  const sources = mount.querySelector('#ai-sources');
  const result = await checkOllama();
  status.textContent = result.connected ? 'Ollama connected' : 'Ollama unavailable';
  if (!result.connected) status.title = result.error;
  modelSelect.innerHTML = result.models.length ? result.models.map(m=>`<option value="${esc(m.name)}">${esc(m.name)}</option>`).join('') : '<option value="">No models found</option>';
  if (settings.model && result.models.some(m=>m.name === settings.model)) modelSelect.value = settings.model;
  modelSelect.onchange = () => saveAISettings({ model: modelSelect.value });
  const history = [];
  mount.querySelector('#ai-form').onsubmit = async e => {
    e.preventDefault();
    const input = mount.querySelector('#ai-input'); const prompt = input.value.trim(); if (!prompt) return;
    if (!modelSelect.value) { mount.querySelector('#ai-error').hidden=false; mount.querySelector('#ai-error').textContent='No Ollama model is available. Install/pull a model and check AI Settings.'; return; }
    const err = mount.querySelector('#ai-error'); err.hidden=true;
    messages.querySelector('.empty-state')?.remove();
    messages.insertAdjacentHTML('beforeend', `<article class="ai-message ai-message--user"><strong>You</strong><p>${esc(prompt)}</p></article><article id="ai-working" class="ai-message"><strong>Workbench AI</strong><p>Thinking…</p></article>`);
    input.value='';
    try {
      const out = await askAI({ message: prompt, history, includeBooks: mount.querySelector('#ai-books').checked, model: modelSelect.value });
      history.push({ role:'user', content:prompt }, { role:'assistant', content:out.answer });
      mount.querySelector('#ai-working')?.remove();
      messages.insertAdjacentHTML('beforeend', `<article class="ai-message"><strong>Workbench AI · ${esc(out.model)}</strong><p class="rich-preview">${esc(out.answer)}</p></article>`);
      sources.innerHTML = out.context.length ? out.context.map((r,i)=>`<article class="knowledge-card"><div class="knowledge-card__head"><div><h3>${esc(r.book?.title || 'Book')}</h3><small>${esc(r.citation)}</small></div><button class="text-button" data-copy-source="${esc(r.id)}">Copy passage</button></div><p>${esc(r.content)}</p></article>`).join('') : '<div class="empty-state">No book passages were retrieved for this answer.</div>';
      sources.querySelectorAll('[data-copy-source]').forEach(b=>b.onclick=async()=>{const r=out.context.find(x=>x.id===b.dataset.copySource);if(r){await navigator.clipboard.writeText(`${r.citation}\n\n${r.content}`);b.textContent='Copied';}});
    } catch (error) { mount.querySelector('#ai-working')?.remove(); err.hidden=false; err.textContent=error?.message || String(error); }
  };
}
