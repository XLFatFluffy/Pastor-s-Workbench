import { askAI, checkOllama, createAIConversation, deleteAIConversation, getAIMessages, listAIConversations, getAISettings, saveAISettings } from './aiService.js';

const esc = v => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
let activeConversation = null;
let conversations = [];
let busy = false;

function shell() {
  const existing = document.getElementById('global-ai');
  if (!existing || existing.dataset.ready) return;
  existing.innerHTML = `
    <header class="global-ai__head">
      <div><p class="canvas__eyebrow">Workbench AI</p><h2>Study Assistant</h2><span id="global-ai-status" class="pill">Checking Ollama…</span></div>
      <div class="global-ai__head-actions"><button id="global-ai-new" class="button" type="button">New chat</button><button id="global-ai-close" class="icon-button" type="button" aria-label="Close AI">×</button></div>
    </header>
    <div class="global-ai__body">
      <aside class="global-ai__conversations"><div class="global-ai__conv-head"><strong>Conversations</strong><button id="global-ai-new-small" class="text-button" type="button">＋ New</button></div><div id="global-ai-conversations"></div></aside>
      <section class="global-ai__chat">
        <div id="global-ai-title" class="global-ai__chat-title">New conversation</div>
        <div id="global-ai-context" class="global-ai__context-bar"><span>Workbench context: ready</span><button id="global-ai-context-toggle" class="text-button" type="button">Context settings</button></div>
        <div class="global-ai__messages-wrap"><div id="global-ai-messages" class="global-ai__messages"><div class="empty-state">Start a conversation. The same AI follows you everywhere in the Workbench.</div></div><div id="global-ai-scrollbar" class="global-ai__scrollbar" aria-label="Conversation scrollbar"><button type="button" class="global-ai__scroll-arrow" data-scroll-dir="up" aria-label="Scroll conversation up">▲</button><div class="global-ai__scroll-track"><div id="global-ai-scroll-thumb" class="global-ai__scroll-thumb"></div></div><button type="button" class="global-ai__scroll-arrow" data-scroll-dir="down" aria-label="Scroll conversation down">▼</button></div></div>
        <form id="global-ai-form" class="global-ai__composer"><textarea id="global-ai-input" rows="3" placeholder="Ask about Scripture, a sermon, a book, doctrine, research…" required></textarea><div class="global-ai__composer-bar"><label><input id="global-ai-workbench" type="checkbox" checked> Read my Workbench</label><label><input id="global-ai-screen" type="checkbox" checked> Current screen</label><label><input id="global-ai-books" type="checkbox" checked> Books</label><select id="global-ai-model" aria-label="AI model"></select><button class="button button--primary" type="submit">Send</button></div><div id="global-ai-error" class="error-panel" hidden></div></form>
      </section>
    </div>`;
  existing.dataset.ready = 'true';
}

function open() { const panel=document.getElementById('global-ai'); panel?.classList.add('global-ai--open'); panel?.setAttribute('aria-hidden','false'); document.getElementById('global-ai-scrim')?.removeAttribute('hidden'); document.getElementById('global-ai-input')?.focus(); }
function close() { const panel=document.getElementById('global-ai'); panel?.classList.remove('global-ai--open'); panel?.setAttribute('aria-hidden','true'); document.getElementById('global-ai-scrim')?.setAttribute('hidden',''); }

async function ensureConversation() {
  if (activeConversation) return activeConversation;
  activeConversation = await createAIConversation();
  conversations = await listAIConversations();
  renderConversations();
  return activeConversation;
}

function renderConversations() {
  const el=document.getElementById('global-ai-conversations'); if(!el) return;
  el.innerHTML = conversations.length ? conversations.map(c=>`<div class="global-ai__conversation-row"><button type="button" class="global-ai__conversation ${c.id===activeConversation?.id?'is-active':''}" data-conversation="${esc(c.id)}"><strong>${esc(c.title || 'New conversation')}</strong><small>${new Date(c.updated_at || c.created_at).toLocaleDateString()}</small></button><button type="button" class="global-ai__conversation-delete" data-delete-conversation="${esc(c.id)}" aria-label="Delete ${esc(c.title || 'conversation')}" title="Delete conversation">×</button></div>`).join('') : '<div class="empty-state">No conversations yet.</div>';
  el.querySelectorAll('[data-conversation]').forEach(b=>b.onclick=()=>selectConversation(b.dataset.conversation));
  el.querySelectorAll('[data-delete-conversation]').forEach(b=>b.onclick=()=>deleteConversation(b.dataset.deleteConversation));
}

async function selectConversation(id) {
  const c=conversations.find(x=>x.id===id) || await import('./aiService.js').then(m=>m.getAIConversation(id));
  if(!c) return; activeConversation=c; renderConversations(); document.getElementById('global-ai-title').textContent=c.title || 'New conversation';
  const msgs=await getAIMessages(c.id); renderMessages(msgs);
}

function updateChatScrollbar(){
  const box=document.getElementById('global-ai-messages');
  const bar=document.getElementById('global-ai-scrollbar');
  const thumb=document.getElementById('global-ai-scroll-thumb');
  const track=bar?.querySelector('.global-ai__scroll-track');
  if(!box||!bar||!thumb||!track)return;
  const maxScroll=Math.max(0,box.scrollHeight-box.clientHeight);
  const trackH=track.clientHeight;
  if(maxScroll<=0 || trackH<=0){
    bar.classList.add('is-disabled');
    thumb.style.height='100%';
    thumb.style.top='0px';
    return;
  }
  bar.classList.remove('is-disabled');
  const ratio=Math.min(1,box.clientHeight/box.scrollHeight);
  const thumbH=Math.max(28,Math.min(trackH,trackH*ratio));
  const maxThumbTravel=Math.max(0,trackH-thumbH);
  const top=(box.scrollTop/maxScroll)*maxThumbTravel;
  thumb.style.height=`${thumbH}px`;
  thumb.style.top=`${top}px`;
  thumb.style.transform='none';
}
function initChatScrollbar(){
  const box=document.getElementById('global-ai-messages');
  const bar=document.getElementById('global-ai-scrollbar');
  const track=bar?.querySelector('.global-ai__scroll-track');
  const thumb=document.getElementById('global-ai-scroll-thumb');
  if(!box||!bar||!track||!thumb||bar.dataset.ready)return;
  bar.dataset.ready='true';
  box.addEventListener('scroll',updateChatScrollbar,{passive:true});
  box.addEventListener('wheel',e=>{
    if (box.scrollHeight > box.clientHeight) {
      e.preventDefault();
      box.scrollTop += e.deltaY;
    }
  },{passive:false});
  window.addEventListener('resize',updateChatScrollbar);
  bar.addEventListener('wheel',e=>{
    e.preventDefault();
    box.scrollTop += e.deltaY;
    updateChatScrollbar();
  },{passive:false});
  bar.querySelectorAll('[data-scroll-dir]').forEach(btn=>btn.addEventListener('click',()=>{
    box.scrollBy({top:(btn.dataset.scrollDir==='up'?-1:1)*Math.max(180,box.clientHeight*.65),behavior:'smooth'});
  }));
  track.addEventListener('pointerdown',e=>{
    if(e.target===thumb)return;
    const r=track.getBoundingClientRect();
    const maxScroll=Math.max(0,box.scrollHeight-box.clientHeight);
    const ratio=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));
    box.scrollTop=ratio*maxScroll;
  });
  let dragging=false,startY=0,startScroll=0;
  thumb.addEventListener('pointerdown',e=>{
    dragging=true;
    startY=e.clientY;
    startScroll=box.scrollTop;
    thumb.setPointerCapture?.(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  });
  thumb.addEventListener('pointermove',e=>{
    if(!dragging)return;
    const trackH=track.clientHeight;
    const thumbH=thumb.offsetHeight;
    const travel=Math.max(1,trackH-thumbH);
    const maxScroll=Math.max(0,box.scrollHeight-box.clientHeight);
    box.scrollTop=startScroll+((e.clientY-startY)/travel)*maxScroll;
  });
  const stopDrag=()=>{dragging=false;};
  thumb.addEventListener('pointerup',stopDrag);
  thumb.addEventListener('pointercancel',stopDrag);
  thumb.addEventListener('lostpointercapture',stopDrag);
  updateChatScrollbar();
}

function renderMessages(msgs) {
  const el=document.getElementById('global-ai-messages');
  el.innerHTML=msgs.length ? msgs.map(m=>`<article class="global-ai__message ${m.role==='user'?'global-ai__message--user':''}"><strong>${m.role==='user'?'You':'Workbench AI'}</strong><p>${esc(m.content)}</p></article>`).join('') : '<div class="empty-state">Start a conversation. The same AI follows you everywhere in the Workbench.</div>';
  el.scrollTop=el.scrollHeight;
  initChatScrollbar(); updateChatScrollbar();
}

async function refreshStatus() {
  const result=await checkOllama(); const status=document.getElementById('global-ai-status'); const select=document.getElementById('global-ai-model');
  if(!status||!select)return; status.textContent=result.connected?'Ollama connected':'Ollama unavailable'; if(!result.connected)status.title=result.error;
  const settings=getAISettings(); select.innerHTML=result.models.length?result.models.map(m=>`<option value="${esc(m.name)}">${esc(m.name)}</option>`).join(''):'<option value="">No models found</option>';
  if(settings.model && result.models.some(m=>m.name===settings.model)) select.value=settings.model;
  select.onchange=()=>saveAISettings({model:select.value});
}

async function send(event) {
  event.preventDefault(); if(busy)return; const input=document.getElementById('global-ai-input'); const prompt=input.value.trim(); if(!prompt)return;
  const model=document.getElementById('global-ai-model').value; const err=document.getElementById('global-ai-error'); err.hidden=true;
  if(!model){err.hidden=false;err.textContent='No Ollama model is available. Open AI Settings and make sure Ollama is running with a model installed.';return;}
  const c=await ensureConversation(); const history=(await getAIMessages(c.id)).map(m=>({role:m.role,content:m.content}));
  const messages=document.getElementById('global-ai-messages'); messages.querySelector('.empty-state')?.remove(); messages.insertAdjacentHTML('beforeend',`<article class="global-ai__message global-ai__message--user"><strong>You</strong><p>${esc(prompt)}</p></article><article id="global-ai-working" class="global-ai__message"><strong>Workbench AI</strong><p>Thinking…</p></article>`); messages.scrollTop=messages.scrollHeight; input.value=''; busy=true;
  try { const out=await askAI({message:prompt,history,conversationId:c.id,includeWorkbench:document.getElementById('global-ai-workbench').checked,includeCurrentScreen:document.getElementById('global-ai-screen').checked,includeBooks:document.getElementById('global-ai-books').checked,model}); document.getElementById('global-ai-working')?.remove(); messages.insertAdjacentHTML('beforeend',`<article class="global-ai__message"><strong>Workbench AI · ${esc(out.model)}</strong><p>${esc(out.answer)}</p><small class="global-ai__source-note">Context: ${out.contextSummary?.work || 0} work records · ${out.contextSummary?.books || 0} book passages · ${out.contextSummary?.sections || 0} context sections</small></article>`); messages.scrollTop=messages.scrollHeight; conversations=await listAIConversations(); activeConversation=conversations.find(x=>x.id===c.id)||c; document.getElementById('global-ai-title').textContent=activeConversation.title; renderConversations();
  } catch(error){document.getElementById('global-ai-working')?.remove();err.hidden=false;err.textContent=error?.message||String(error);} finally{busy=false;input.focus();}
}

async function deleteConversation(id) {
  const conversation = conversations.find(c => c.id === id);
  if (!conversation) return;
  const title = conversation.title || 'this conversation';
  if (!window.confirm(`Delete “${title}”? This will permanently remove the conversation and its messages.`)) return;
  await deleteAIConversation(id);
  conversations = await listAIConversations();
  if (activeConversation?.id === id) {
    activeConversation = conversations[0] || await createAIConversation();
    conversations = await listAIConversations();
    await selectConversation(activeConversation.id);
  } else {
    renderConversations();
  }
}

async function newConversation(){ activeConversation=await createAIConversation(); conversations=await listAIConversations(); renderConversations(); document.getElementById('global-ai-title').textContent=activeConversation.title; renderMessages([]); document.getElementById('global-ai-input')?.focus(); }

export function openGlobalAIWithPrompt(prompt = '') {
  const panel=document.getElementById('global-ai');
  panel?.classList.add('global-ai--open'); panel?.setAttribute('aria-hidden','false');
  document.getElementById('global-ai-scrim')?.removeAttribute('hidden');
  const input=document.getElementById('global-ai-input');
  if(input && prompt){ input.value=prompt; input.focus(); }
  else input?.focus();
}

export async function initGlobalAI(){
  shell();
  initChatScrollbar();
  conversations=await listAIConversations();
  if(conversations.length) activeConversation=conversations[0]; else activeConversation=await createAIConversation();
  conversations=await listAIConversations(); renderConversations();
  await selectConversation(activeConversation.id); await refreshStatus();
  document.getElementById('global-ai-launcher').onclick=open; document.getElementById('global-ai-close').onclick=close; document.getElementById('global-ai-scrim').onclick=close; document.getElementById('global-ai-new').onclick=newConversation; document.getElementById('global-ai-new-small').onclick=newConversation; document.getElementById('global-ai-form').onsubmit=send;
  const bindContextToggle=()=>{ const button=document.getElementById('global-ai-context-toggle'); if(!button) return; button.onclick=()=>{ const bar=document.getElementById('global-ai-context'); if(!bar) return; const expanded=bar.classList.toggle('is-expanded'); bar.innerHTML=expanded ? '<span><strong>AI can read:</strong> your saved sermons, sermon stages and points, projects, lessons, studies, notes, research, topics, collections, sources, documents, Bible annotations, uploaded books, Bible search results, 1689 Confession results, cross-references, and the text of the current screen when enabled.</span><button id="global-ai-context-toggle" class="text-button" type="button">Hide</button>' : '<span>Workbench context: ready</span><button id="global-ai-context-toggle" class="text-button" type="button">Context settings</button>'; bindContextToggle(); }; }; bindContextToggle();
  window.addEventListener('keydown',e=>{if(e.key==='Escape')close(); if((e.ctrlKey||e.metaKey)&&e.key==='j'){e.preventDefault();open();}});
  window.addEventListener('pwb:ai-prompt', event => openGlobalAIWithPrompt(event.detail?.prompt || ''));
  window.addEventListener('pwb:route-changed', () => { if(document.getElementById('global-ai')?.classList.contains('global-ai--open')) refreshStatus().catch(()=>{}); });
}
