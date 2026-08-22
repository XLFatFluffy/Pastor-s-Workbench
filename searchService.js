// Universal Search — local-first search across Workbench records and indexed source text.
import { all } from './store.js';
import { getEntityConnections } from './connectedKnowledgeService.js';

const SOURCES = [
  ['projects','Projects','#/projects'], ['sermons','Sermons','#/sermons'], ['lessons','Lessons','#/lessons'],
  ['studies','Studies','#/studies'], ['notes','Notes','#/notes'], ['research_items','Research','#/research'],
  ['topics','Topics','#/topics'], ['collections','Collections','#/collections'], ['library_items','Books','#/books'],
  ['documents','Files','#/documents'], ['calendar_events','Calendar','#/calendar'], ['daily_tasks','Tasks','#/calendar'],
  ['bible_annotations','Bible Notes','#/bible'], ['confessions','Confession','#/confession']
];
const esc=v=>String(v??'').replace(/\s+/g,' ').trim();
function searchableText(row){return Object.entries(row||{}).filter(([k,v])=>!['id','created_at','updated_at','workspace_id','blob'].includes(k)&&(typeof v==='string'||typeof v==='number')).map(([k,v])=>`${k} ${v}`).join(' ').toLowerCase();}
function titleFor(row,fallback){return esc(row.title||row.name||row.subject||row.filename||row.content?.slice(0,90)||row.description?.slice(0,90)||fallback);}
function scoreText(hay,q,terms,title=''){let score=0; if(title.toLowerCase()===q)score+=100; else if(title.toLowerCase().includes(q))score+=50; terms.forEach(t=>{if(hay.includes(t))score+=5;}); return score;}

export async function universalSearch(query,{limit=60}={}){
  const q=esc(query).toLowerCase(); if(!q)return []; const terms=q.split(/\s+/).filter(Boolean); const results=[];
  for(const [store,type,href] of SOURCES){let rows=[];try{rows=await all(store);}catch{continue;} for(const row of rows){const text=searchableText(row); if(!terms.every(t=>text.includes(t)))continue; const title=titleFor(row,type); results.push({id:row.id,type,store,title,href,score:scoreText(text,q,terms,String(row.title||row.name||'')),preview:esc(row.description||row.content||row.primary_text||row.text||row.title||'').slice(0,220),updated_at:row.updated_at||row.created_at||null});}}
  // Search extracted document text as first-class source hits. These link back to Files and retain the parent document.
  try{const chunks=await all('document_chunks');const docs=new Map((await all('documents')).map(d=>[d.id,d])); for(const c of chunks){const hay=String(c.content||'').toLowerCase();if(!terms.every(t=>hay.includes(t)))continue;const doc=docs.get(c.document_id);if(!doc)continue;results.push({id:c.id,type:'File Content',store:'document_chunks',parent_id:c.document_id,title:doc.title,href:'#/documents',score:scoreText(hay,q,terms,doc.title)+2,preview:esc(c.content).slice(0,260),updated_at:doc.updated_at||doc.created_at||null});}}catch{}
  // If a workspace is open, connected records are ranked above unrelated matches.
  // The relationship itself is surfaced so the UI can explain why a result is relevant.
  try {
    const current = globalThis.__pwbCurrentEntity;
    if (current?.type && current?.id) {
      const connections = await getEntityConnections(current.type, current.id);
      const connected = new Map();
      for (const r of connections) {
        const id = r.source_type === current.type && r.source_id === current.id ? r.target_id : r.target_type === current.type && r.target_id === current.id ? r.source_id : null;
        if (id) connected.set(id, r.relationship_type || 'related');
      }
      for (const result of results) {
        const rel = connected.get(result.id);
        if (rel) { result.score += 35; result.connected = true; result.relationship = rel; }
      }
    }
  } catch { /* relationship ranking is optional */ }
  return results.sort((a,b)=>b.score-a.score||String(b.updated_at||'').localeCompare(String(a.updated_at||''))).slice(0,limit);
}
export async function searchCounts(query){const results=await universalSearch(query,{limit:5000});return Object.fromEntries([...SOURCES.map(([,type])=>type), 'File Content'].map(type=>[type,results.filter(r=>r.type===type).length]));}
export { label };
function label(v){return String(v||'').replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());}
