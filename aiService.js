// AI service — local Ollama integration with book-library retrieval context.
// The Workbench never uploads books to a remote AI provider. Ollama runs locally.
import { buildBookContext } from './libraryService.js';
import { buildWorkbenchContext } from './contextService.js';
import { buildKnowledgeContext } from './knowledgeService.js';
export { addKnowledgeSource, listKnowledgeSources, getKnowledgeSource, deleteKnowledgeSource, getKnowledgeStats } from './knowledgeService.js';
import { all as workbenchAll, get as workbenchGet } from './store.js';
import * as aiDb from './aiDatabase.js';
import { isDesktop, ollamaTags, ollamaChat } from './desktopBridge.js';

const DEFAULT_BASE = 'http://127.0.0.1:11434';
const SETTINGS_KEY = 'pwb-ai-settings';
const RECOMMENDED_LOCAL_MODEL = 'gemma3:4b';
const clean = v => String(v ?? '').trim();
const now = () => new Date().toISOString();
const uid = p => `${p}:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

let aiMigrationPromise = null;

async function ensureAIDatabaseMigrated() {
  if (aiMigrationPromise) return aiMigrationPromise;
  aiMigrationPromise = (async () => {
    const marker = await aiDb.get('meta', 'legacy-workbench-ai-migrated');
    if (marker?.value === true) return;
    // Preserve AI history created by older releases. The new AI database becomes
    // authoritative after this one-time copy; Workbench domain data stays separate.
    const migrations = [
      ['ai_conversations', 'conversations'],
      ['ai_messages', 'messages'],
      ['ai_sessions', 'sessions'],
      ['ai_responses', 'responses']
    ];
    for (const [oldStore, newStore] of migrations) {
      try {
        const rows = await workbenchAll(oldStore);
        for (const row of rows) await aiDb.put(newStore, row);
      } catch { /* older installs may not contain every legacy store */ }
    }
    await aiDb.put('meta', { id: 'legacy-workbench-ai-migrated', value: true, migrated_at: now() });
  })().catch(error => {
    aiMigrationPromise = null;
    throw error;
  });
  return aiMigrationPromise;
}

export function getAISettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return { baseUrl: DEFAULT_BASE, model: RECOMMENDED_LOCAL_MODEL, temperature: 0.2, systemPrompt: '', ...saved, model: clean(saved.model || RECOMMENDED_LOCAL_MODEL) };
  } catch { return { baseUrl: DEFAULT_BASE, model: RECOMMENDED_LOCAL_MODEL, temperature: 0.2, systemPrompt: '' }; }
}
export function getRecommendedAIModel() { return RECOMMENDED_LOCAL_MODEL; }

export function saveAISettings(input = {}) {
  const current = getAISettings();
  const next = { ...current, ...input, baseUrl: clean(input.baseUrl || current.baseUrl).replace(/\/$/, ''), model: clean(input.model ?? current.model), systemPrompt: String(input.systemPrompt ?? current.systemPrompt), temperature: Number(input.temperature ?? current.temperature) };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

async function request(path, options = {}) {
  const settings = getAISettings();
  const response = await fetch(`${settings.baseUrl}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`Ollama returned ${response.status}: ${await response.text().catch(() => '')}`);
  return response.json();
}

export async function checkOllama() {
  try { const data = isDesktop() ? await ollamaTags() : await request('/api/tags'); return { connected: true, models: data?.models || [], error: '' }; }
  catch (error) { return { connected: false, models: [], error: error?.message || String(error) }; }
}
export async function listAIModels() { return (await checkOllama()).models; }

export function buildSystemPrompt({ userAbout = '', instructions = '' } = {}) {
  const settings = getAISettings();
  return [
    'You are the AI study assistant inside Pastor\'s Workbench.',
    'Help with biblical study, expository sermon preparation, research, teaching, and pastoral writing.',
    'Do not invent quotations, sources, biblical references, or claims of what a book says.',
    'When source context is supplied, distinguish source material from your own analysis and preserve source labels.',
    userAbout ? `About the pastor: ${userAbout}` : '',
    instructions ? `Additional instructions: ${instructions}` : '',
    settings.systemPrompt ? `Workbench AI instructions: ${settings.systemPrompt}` : '',
    'ACTIONS: You can operate the Workbench when the user explicitly asks you to create, open, start, title, or save something. ' +
    'For notes/research/tasks/calendar items, use an approval action. For projects, use a project action when the user asks to start/open/create a project, study, sermon, lesson, or similar workspace. ' +
    'A project action is executed automatically because the user explicitly requested the operation. Use this exact format:\n' +
    '```pwb-action\n{"type":"project","operation":"create|open","project_type":"study|sermon|lesson|research|writing|general","title":"...","description":"..."}\n```\n' +
    'If creating a specialized study, sermon, or lesson, create its corresponding structured workspace too. If opening, prefer an existing project with the requested title; if none exists, create it. ' +
    'For notes/research/tasks/calendar and document attachments use these approval formats:\n```pwb-action\n{"type":"note"|"research_item","title":"...","content":"...","note_type":"general|exegetical|illustration|application|question","research_type":"summary|quote|argument|definition|other","project_id":"optional-id"}\n```\n```pwb-action\n{"type":"task","title":"...","description":"...","due_date":"YYYY-MM-DD","priority":"low|normal|high|urgent","project_id":"optional-id"}\n```\n```pwb-action\n{"type":"calendar_event","title":"...","description":"...","start_at":"ISO datetime","end_at":"ISO datetime","all_day":false,"project_id":"optional-id"}\n```\n```pwb-action\n{"type":"document_link","entity_type":"Project|Sermon|Lesson|Study","entity_id":"optional-id","entity_title":"exact current title","document_id":"document-id","document_title":"exact document title"}\n```\n' +
    'For planning requests, create a single approval action using this exact format:\n```pwb-action\n{"type":"plan","title":"...","goal":"...","project_id":"optional-id","tasks":[{"title":"...","description":"...","due_date":"YYYY-MM-DD","priority":"low|normal|high|urgent"}],"events":[{"title":"...","description":"...","start_at":"ISO datetime","end_at":"ISO datetime","all_day":false}]}\n```\nA plan is always approval-gated. Do not create tasks or calendar events directly when proposing a plan.\n' +
    'If the user is working on a sermon and asks you to draft, suggest, or propose a sermon point (a main point with explanation/illustration/application), use an approval action — never write it directly into the sermon without approval. Use this exact format:\\n' +
    '```pwb-action\\n{"type":"sermon_point","sermon_title":"exact title of the sermon project","title":"point title","explanation":"...","illustration":"...","application":"..."}\\n```\\n' +
    'When the user says to save, keep, capture, add, record, or make a note from your response, you MUST emit a note action containing the actual note content; do not merely say that you saved it. If no project_id is known, omit it and Workbench will attach the note to the current project/workspace when possible. Only propose actions when the user asked for the operation or explicitly asked you to save/capture something. Write the normal reply first, then action block(s) at the end.'
  ].filter(Boolean).join('\n\n');
}

const ACTION_BLOCK_RE = /```pwb-action\s*([\s\S]*?)```/g;

export function extractActions(rawText) {
  const text = String(rawText || '');
  const actions = [];
  let match;
  while ((match = ACTION_BLOCK_RE.exec(text))) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed && typeof parsed === 'object' && parsed.type) actions.push(parsed);
    } catch { /* ignore malformed action block */ }
  }
  const answer = text.replace(ACTION_BLOCK_RE, '').trim();
  return { answer, actions };
}

export async function applyAIAction(action, { model = '' } = {}) {
  const provenance = { source: 'ai-directed', model: clean(model), created_at: now() };
  if (action.type === 'project') {
    const { listProjects, saveProject, saveSermon, saveLesson, saveStudy, initializeSermonWorkflow } = await import('./sermonService.js');
    const projectType = ['study','sermon','lesson','research','writing','general'].includes(clean(action.project_type).toLowerCase()) ? clean(action.project_type).toLowerCase() : 'study';
    const title = clean(action.title) || 'New Workbench Project';
    let project = (await listProjects({ search: title })).find(p => p.title.toLowerCase() === title.toLowerCase());
    if (!project || clean(action.operation).toLowerCase() === 'create') {
      project = await saveProject({ title, description: clean(action.description), project_type: projectType, status: 'draft' });
      if (project.project_type === 'sermon') {
        const sermon = await saveSermon({ project_id: project.id, title: project.title, primary_text: '', sermon_intent: '', text_intent: '', structure: {}, manuscript: '', status: 'draft' });
        await initializeSermonWorkflow(sermon.id);
      } else if (project.project_type === 'lesson') {
        await saveLesson({ project_id: project.id, title: project.title });
      } else if (project.project_type === 'study') {
        await saveStudy({ project_id: project.id, title: project.title, description: clean(action.description) });
      }
    }
    if (typeof window !== 'undefined') {
      globalThis.__pwbPendingProjectOpen = { id: project.id, type: project.project_type };
      window.location.hash = `#/projects?project=${encodeURIComponent(project.id)}`;
    }
    return project;
  }
  if (action.type === 'sermon_point') {
    const { listSpecialized, getSermonWorkspace, saveSermonPoint } = await import('./sermonService.js');
    const sermons = await listSpecialized('sermon');
    const title = clean(action.sermon_title);
    const sermon = sermons.find(s => s.title.toLowerCase() === title.toLowerCase());
    if (!sermon) throw new Error(`No sermon titled "${title}" was found. Create the sermon first.`);
    const workspace = await getSermonWorkspace(sermon.id);
    const position = (workspace?.points || []).length;
    return saveSermonPoint({ sermon_id: sermon.id, position, title: clean(action.title) || 'Untitled point', explanation: clean(action.explanation), illustration: clean(action.illustration), application: clean(action.application) });
  }
  const { saveNote, saveResearchItem } = await import('./researchService.js');
  if (action.type === 'task') {
    const { saveTask } = await import('./calendarService.js');
    return saveTask({ title: clean(action.title), description: clean(action.description), due_date: clean(action.due_date), priority: clean(action.priority) || 'normal', project_id: clean(action.project_id) });
  }
  if (action.type === 'calendar_event') {
    const { saveEvent } = await import('./calendarService.js');
    return saveEvent({ title: clean(action.title), description: clean(action.description), start_at: clean(action.start_at), end_at: clean(action.end_at) || clean(action.start_at), all_day: Boolean(action.all_day), project_id: clean(action.project_id) });
  }
  if (action.type === 'plan') {
    const { applyPlanningProposal } = await import('./planningService.js');
    return applyPlanningProposal(action);
  }
  if (action.type === 'document_link') {
    const { linkDocumentToEntity } = await import('./connectedKnowledgeService.js');
    const entityType = ['Project','Sermon','Lesson','Study'].includes(clean(action.entity_type)) ? clean(action.entity_type) : 'Project';
    const entityId = clean(action.entity_id);
    if (!entityId) throw new Error('A document attachment needs the target project or workspace ID.');
    return linkDocumentToEntity(entityType, entityId, clean(action.document_id));
  }
  if (action.type === 'note') {
    let projectId = clean(action.project_id);
    if (!projectId) {
      const currentEntity = globalThis.__pwbCurrentEntity || null;
      if (currentEntity?.type && currentEntity?.id) {
        const { get } = await import('./store.js');
        if (currentEntity.type === 'Project') projectId = clean(currentEntity.id);
        else {
          const storeByType = { Sermon: 'sermons', Lesson: 'lessons', Study: 'studies' };
          const row = storeByType[currentEntity.type] ? await get(storeByType[currentEntity.type], currentEntity.id) : null;
          projectId = clean(row?.project_id);
        }
      }
    }
    const noteType = clean(action.note_type) || 'general';
    const allowed = ['observation','idea','question','application','reflection','theological_position','sermon_note','lesson_note','general'];
    return saveNote({ title: clean(action.title) || 'AI Note', content: clean(action.content), note_type: allowed.includes(noteType) ? noteType : 'general', project_id: projectId, origin: 'ai', provenance });
  }
  if (action.type === 'research_item') {
    return saveResearchItem({ title: clean(action.title), content: clean(action.content), research_type: clean(action.research_type) || 'summary', project_id: clean(action.project_id), origin: 'ai', provenance });
  }
  throw new Error(`Unknown action type: ${action.type}`);
}

export async function createAIConversation({ title = 'New conversation', workspaceId = 'global' } = {}) {
  await ensureAIDatabaseMigrated();
  const conversation = { id: uid('ai-conversation'), workspace_id: workspaceId, title: clean(title) || 'New conversation', created_at: now(), updated_at: now() };
  await aiDb.put('conversations', conversation);
  return conversation;
}

export async function listAIConversations() {
  await ensureAIDatabaseMigrated();
  return (await aiDb.all('conversations')).sort((a,b)=>String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)));
}

export async function getAIConversation(id) {
  await ensureAIDatabaseMigrated();
  return id ? aiDb.get('conversations', id) : null;
}
export async function getAIMessages(conversationId) {
  await ensureAIDatabaseMigrated();
  return (await aiDb.all('messages')).filter(m => m.conversation_id === conversationId).sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));
}

export async function saveAIMessage(conversationId, role, content, meta = {}) {
  await ensureAIDatabaseMigrated();
  const message = { id: uid('ai-message'), conversation_id: conversationId, role, content: String(content || ''), meta, created_at: now() };
  await aiDb.put('messages', message);
  const conversation = await getAIConversation(conversationId);
  if (conversation) {
    const plain = String(content || '').replace(/\s+/g, ' ').trim();
    if (role === 'user' && (conversation.title === 'New conversation' || !conversation.title)) conversation.title = plain.slice(0, 60) || 'New conversation';
    conversation.updated_at = now();
    await aiDb.put('conversations', conversation);
  }
  return message;
}

export async function deleteAIConversation(conversationId) {
  await ensureAIDatabaseMigrated();
  const messages = await getAIMessages(conversationId);
  for (const message of messages) await aiDb.remove('messages', message.id);
  await aiDb.remove('conversations', conversationId);
}

export async function saveAIMemory(input) { await ensureAIDatabaseMigrated(); return aiDb.saveMemory(input); }
export async function listAIMemory(options) { await ensureAIDatabaseMigrated(); return aiDb.listMemory(options); }
export async function saveAISource(input) { await ensureAIDatabaseMigrated(); return aiDb.saveSource(input); }
export async function getAIDatabaseInfo() { await ensureAIDatabaseMigrated(); return aiDb.databaseInfo; }

export async function askAI({ message, history = [], conversationId = null, includeBooks = true, includeBible = true, includeConfession = true, includeCrossReferences = true, includeCurrentScreen = true, includeWorkbench = true, includeKnowledge = true, knowledgeLimit = 6, bookLimit = 8, attachments = [], userAbout = '', instructions = '', model = null, temperature = null, signal } = {}) {
  await ensureAIDatabaseMigrated();
  const prompt = clean(message);
  if (!prompt) throw new Error('Enter a question or instruction first.');
  const settings = getAISettings();
  userAbout = userAbout || (typeof localStorage !== 'undefined' ? localStorage.getItem('pw:ai:aboutMe') || '' : '');
  const selectedModel = clean(model || settings.model);
  if (!selectedModel) throw new Error('Choose an Ollama model in AI Settings first.');

  const ctx = includeWorkbench
    ? await buildWorkbenchContext(prompt, { includeBooks, includeBible, includeConfession, includeCrossReferences, includeCurrentScreen, limit: 18 })
    : { sections: includeBooks ? [`UPLOADED BOOK LIBRARY\n${(await buildBookContext(prompt, { limit: bookLimit })).map((r,i)=>`[Book ${i+1}] ${r.citation}\n${r.content}`).join('\n\n')}`] : [], work: [], books: [], current: {} };

  const knowledgeResults = includeKnowledge ? await buildKnowledgeContext(prompt, { limit: knowledgeLimit }) : [];
  const knowledgeSection = knowledgeResults.length
    ? [`LOCAL KNOWLEDGE STORE (semantic retrieval)\n${knowledgeResults.map((r, i) => `[Source ${i + 1}] ${r.citation}\n${r.content}`).join('\n\n')}`]
    : [];

  const cleanAttachments = (Array.isArray(attachments) ? attachments : [])
    .map(a => ({ name: clean(a?.name) || 'Attachment', content: String(a?.content || '').slice(0, 20000) }))
    .filter(a => a.content.trim());
  const attachmentSection = cleanAttachments.length
    ? [`FILES ATTACHED TO THIS MESSAGE\n${cleanAttachments.map((a, i) => `[Attachment ${i + 1}: ${a.name}]\n${a.content}`).join('\n\n')}`]
    : [];

  const allSections = [...ctx.sections, ...knowledgeSection, ...attachmentSection];
  const sourceBlock = allSections.length ? `\n\nWORKBENCH CONTEXT — USE THIS AS SOURCE MATERIAL\n${allSections.join('\n\n---\n\n')}\nEND WORKBENCH CONTEXT` : '';
  const messages = [
    { role: 'system', content: buildSystemPrompt({ userAbout, instructions }) + '\n\nYou have access to structured Workbench context. Treat it as the user’s actual working material. Never claim to have read data that is not supplied in context. If the current screen is supplied, use it to understand what the user is looking at. Clearly distinguish the user’s notes/work, published sources, Scripture, Confession text, and your own analysis.' },
    ...history.slice(-12).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '') })),
    { role: 'user', content: prompt + sourceBlock }
  ];
  const data = isDesktop()
    ? await ollamaChat({ model: selectedModel, messages, temperature: Number(temperature ?? settings.temperature) })
    : await request('/api/chat', { method: 'POST', signal, body: JSON.stringify({ model: selectedModel, messages, stream: false, options: { temperature: Number(temperature ?? settings.temperature) } }) });
  const rawAnswer = data?.message?.content || '';
  const { answer, actions } = extractActions(rawAnswer);
  const sessionId = uid('ai-session');
  await aiDb.put('sessions', { id: sessionId, workspace_id: 'global', conversation_id: conversationId || null, provider: 'ollama', model: selectedModel, mode: 'workbench-context', created_at: now() });
  const provenance = { provider: 'ollama', model: selectedModel, context: { work: ctx.work.map(r => ({ type:r.type, id:r.id, label:r.label, score:r.score })), books: ctx.books.map(r => ({ book_id:r.book_id, citation:r.citation, chunk_id:r.id })), knowledge: knowledgeResults.map(r => ({ source_id:r.source_id, citation:r.citation, chunk_id:r.id, score:r.score })), attachments: cleanAttachments.map(a => ({ name:a.name })), route: ctx.current?.route || '', current_screen_included: includeCurrentScreen } };
  await aiDb.put('responses', { id: uid('ai-response'), session_id: sessionId, response: answer, provenance, approval_status: 'unreviewed', created_at: now() });
  if (conversationId) {
    await saveAIMessage(conversationId, 'user', prompt, { includeBooks, includeWorkbench, route: ctx.current?.route || '' });
    await saveAIMessage(conversationId, 'assistant', answer, { model: selectedModel, provenance, actions });
  }
  return { answer, actions, model: selectedModel, context: ctx.books, workContext: ctx.work, knowledgeContext: knowledgeResults, attachments: cleanAttachments, contextSummary: { work: ctx.work.length, books: ctx.books.length, knowledge: knowledgeResults.length, sections: allSections.length, route: ctx.current?.route || '' }, sessionId, conversationId };
}
export async function getAIHistory(limit = 20) {
  await ensureAIDatabaseMigrated(); return (await aiDb.all('responses')).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,limit); }
