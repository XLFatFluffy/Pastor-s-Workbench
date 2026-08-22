// Connected Document Cabinet — local-first ministry files with searchable text and provenance.
import { all, get, put, remove, bulk } from './store.js';
import { extractBookFile } from './libraryService.js';

const STORE='documents';
const CHUNKS='document_chunks';
const now=()=>new Date().toISOString();
const uid=p=>`${p}:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const clean=v=>String(v??'').trim();

export function normalizeDocument(input={}){
  const title=clean(input.title)||clean(input.filename)||'Untitled document';
  return { id:clean(input.id)||uid('document'), kind:'document', title, filename:clean(input.filename), mime_type:clean(input.mime_type)||'application/octet-stream', file_size:Number(input.file_size||0), page_count:Number(input.page_count||0), chunk_count:Number(input.chunk_count||0), description:clean(input.description), project_id:clean(input.project_id), source_entity_type:clean(input.source_entity_type), source_entity_id:clean(input.source_entity_id), status:clean(input.status)||'ready', source:'user-upload', created_at:input.created_at||now(), updated_at:now(), blob:input.blob||null };
}

export function chunkDocumentText(text,{chunkSize=1800,overlap=250}={}){
  const source=String(text||'').replace(/\r\n?/g,'\n').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
  if(!source)return [];
  const out=[]; let start=0,index=0;
  while(start<source.length){
    let end=Math.min(source.length,start+chunkSize);
    if(end<source.length){const boundary=Math.max(source.lastIndexOf('\n\n',end),source.lastIndexOf('. ',end)); if(boundary>start+chunkSize*.55) end=boundary+(source[boundary]==='.'?1:0);}
    const content=source.slice(start,end).trim(); if(content) out.push({index:index++,content,start,end});
    if(end>=source.length)break; start=Math.max(end-overlap,start+1);
  }
  return out;
}

export async function importDocumentFile(file,metadata={},onProgress){
  if(!file)throw new TypeError('Choose a document first.');
  const extracted=await extractBookFile(file,onProgress);
  const chunks=chunkDocumentText(extracted.text);
  if(!chunks.length)throw new Error('No readable text was found in this document.');
  const doc=normalizeDocument({...metadata,title:metadata.title||file.name.replace(/\.[^.]+$/,''),filename:file.name,mime_type:file.type||'application/octet-stream',file_size:file.size||0,page_count:extracted.pageCount,chunk_count:chunks.length,blob:file});
  await put(STORE,doc);
  await bulk(CHUNKS,chunks.map((c,i)=>({id:`${doc.id}:chunk:${i}`,document_id:doc.id,index:i,page:c.page||null,content:c.content,created_at:now()})));
  return doc;
}

export async function listDocuments(query=''){
  const q=clean(query).toLowerCase();
  return (await all(STORE)).filter(d=>!q||[d.title,d.filename,d.description,d.mime_type].join(' ').toLowerCase().includes(q)).sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)));
}
export async function getDocument(id){return get(STORE,id);}
export async function getDocumentChunks(id){return (await all(CHUNKS)).filter(c=>c.document_id===id).sort((a,b)=>a.index-b.index);}
export async function deleteDocument(id){for(const c of await getDocumentChunks(id))await remove(CHUNKS,c.id);await remove(STORE,id);}
function score(content,terms){const h=content.toLowerCase();let n=0;for(const t of terms){let at=h.indexOf(t);while(at>=0){n+=t.length>5?3:1;at=h.indexOf(t,at+t.length)}}return n;}
export async function searchDocuments(query,{limit=20,documentId=null}={}){
  const terms=clean(query).toLowerCase().split(/\s+/).filter(t=>t.length>1).slice(0,12);if(!terms.length)return [];
  const chunks=await all(CHUNKS);const docs=new Map((await listDocuments()).map(d=>[d.id,d]));
  return chunks.filter(c=>!documentId||c.document_id===documentId).map(c=>({...c,score:score(c.content,terms),document:docs.get(c.document_id)||null})).filter(c=>c.score>0).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,limit);
}
export async function getDocumentStats(){const docs=await all(STORE),chunks=await all(CHUNKS);return{documents:docs.length,chunks:chunks.length,characters:chunks.reduce((n,c)=>n+String(c.content||'').length,0)};}
