// AI service — local Ollama integration with book-library retrieval context.
// The Workbench never uploads books to a remote AI provider. Ollama runs locally.
import { buildBookContext } from './libraryService.js';
import { buildWorkbenchContext } from './contextService.js';
import { all, get, put } from './store.js';
import { isDesktop, ollamaTags, ollamaChat } from './desktopBridge.js';

const DEFAULT_BASE = 'http://127.0.0.1:11434';
const SETTINGS_KEY = 'pwb-ai-settings';
const RECOMMENDED_LOCAL_MODEL = 'qwen3:8b';
const clean = v => String(v ?? '').trim();
const now = () => new Date().toISOString();
const uid = p => `${p}:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

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
    settings.systemPrompt ? `Workbench AI instructions: ${settings.systemPrompt}` : ''
  ].filter(Boolean).join('\n\n');
}

export async function createAIConversation({ title = 'New conversation', workspaceId = 'global' } = {}) {
  const conversation = { id: uid('ai-conversation'), workspace_id: workspaceId, title: clean(title) || 'New conversation', created_at: now(), updated_at: now() };
  await put('ai_conversations', conversation);
  return conversation;
}

export async function listAIConversations() {
  return (await all('ai_conversations')).sort((a,b)=>String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)));
}

export async function getAIConversation(id) { return id ? get('ai_conversations', id) : null; }
export async function getAIMessages(conversationId) {
  return (await all('ai_messages')).filter(m => m.conversation_id === conversationId).sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));
}

export async function saveAIMessage(conversationId, role, content, meta = {}) {
  const message = { id: uid('ai-message'), conversation_id: conversationId, role, content: String(content || ''), meta, created_at: now() };
  await put('ai_messages', message);
  const conversation = await getAIConversation(conversationId);
  if (conversation) {
    const plain = String(content || '').replace(/\s+/g, ' ').trim();
    if (role === 'user' && (conversation.title === 'New conversation' || !conversation.title)) conversation.title = plain.slice(0, 60) || 'New conversation';
    conversation.updated_at = now();
    await put('ai_conversations', conversation);
  }
  return message;
}

export async function deleteAIConversation(conversationId) {
  const messages = await getAIMessages(conversationId);
  const { remove } = await import('./store.js');
  for (const message of messages) await remove('ai_messages', message.id);
  await remove('ai_conversations', conversationId);
}

export async function askAI({ message, history = [], conversationId = null, includeBooks = true, includeBible = true, includeConfession = true, includeCrossReferences = true, includeCurrentScreen = true, includeWorkbench = true, bookLimit = 8, userAbout = '', instructions = '', model = null, temperature = null, signal } = {}) {
  const prompt = clean(message);
  if (!prompt) throw new Error('Enter a question or instruction first.');
  const settings = getAISettings();
  userAbout = userAbout || (typeof localStorage !== 'undefined' ? localStorage.getItem('pw:ai:aboutMe') || '' : '');
  const selectedModel = clean(model || settings.model);
  if (!selectedModel) throw new Error('Choose an Ollama model in AI Settings first.');

  const ctx = includeWorkbench
    ? await buildWorkbenchContext(prompt, { includeBooks, includeBible, includeConfession, includeCrossReferences, includeCurrentScreen, limit: 18 })
    : { sections: includeBooks ? [`UPLOADED BOOK LIBRARY\n${(await buildBookContext(prompt, { limit: bookLimit })).map((r,i)=>`[Book ${i+1}] ${r.citation}\n${r.content}`).join('\n\n')}`] : [], work: [], books: [], current: {} };
  const sourceBlock = ctx.sections.length ? `\n\nWORKBENCH CONTEXT — USE THIS AS SOURCE MATERIAL\n${ctx.sections.join('\n\n---\n\n')}\nEND WORKBENCH CONTEXT` : '';
  const messages = [
    { role: 'system', content: buildSystemPrompt({ userAbout, instructions }) + '\n\nYou have access to structured Workbench context. Treat it as the user’s actual working material. Never claim to have read data that is not supplied in context. If the current screen is supplied, use it to understand what the user is looking at. Clearly distinguish the user’s notes/work, published sources, Scripture, Confession text, and your own analysis.' },
    ...history.slice(-12).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '') })),
    { role: 'user', content: prompt + sourceBlock }
  ];
  const data = isDesktop()
    ? await ollamaChat({ model: selectedModel, messages, temperature: Number(temperature ?? settings.temperature) })
    : await request('/api/chat', { method: 'POST', signal, body: JSON.stringify({ model: selectedModel, messages, stream: false, options: { temperature: Number(temperature ?? settings.temperature) } }) });
  const answer = data?.message?.content || '';
  const sessionId = uid('ai-session');
  await put('ai_sessions', { id: sessionId, workspace_id: 'global', conversation_id: conversationId || null, provider: 'ollama', model: selectedModel, mode: 'workbench-context', created_at: now() });
  const provenance = { provider: 'ollama', model: selectedModel, context: { work: ctx.work.map(r => ({ type:r.type, id:r.id, label:r.label, score:r.score })), books: ctx.books.map(r => ({ book_id:r.book_id, citation:r.citation, chunk_id:r.id })), route: ctx.current?.route || '', current_screen_included: includeCurrentScreen } };
  await put('ai_responses', { id: uid('ai-response'), session_id: sessionId, response: answer, provenance, approval_status: 'unreviewed', created_at: now() });
  if (conversationId) {
    await saveAIMessage(conversationId, 'user', prompt, { includeBooks, includeWorkbench, route: ctx.current?.route || '' });
    await saveAIMessage(conversationId, 'assistant', answer, { model: selectedModel, provenance });
  }
  return { answer, model: selectedModel, context: ctx.books, workContext: ctx.work, contextSummary: { work: ctx.work.length, books: ctx.books.length, sections: ctx.sections.length, route: ctx.current?.route || '' }, sessionId, conversationId };
}
export async function getAIHistory(limit = 20) { return (await all('ai_responses')).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,limit); }
