// Pastor Assistant Core — aggregates daily ministry information for the dashboard and AI.
import { listEvents, listTasks, localDateKey } from './calendarService.js';
import { listProjects } from './sermonService.js';
import { listKnowledge } from './researchService.js';

export async function getDailyBriefing(date = new Date()) {
  const day = localDateKey(date);
  const [events, tasks, projects] = await Promise.all([
    listEvents({ from: `${day}T00:00:00`, to: `${day}T23:59:59` }),
    listTasks({ dueDate: day }),
    listProjects({})
  ]);
  const activeProjects = projects.filter(p => p.status !== 'archived');
  const openTasks = tasks.filter(t => !['done', 'cancelled'].includes(t.status));
  const urgentTasks = openTasks.filter(t => ['urgent', 'high'].includes(t.priority));
  return { date: day, events, tasks, openTasks, urgentTasks, activeProjects };
}

const NARRATIVE_CACHE_KEY = 'pwb-daily-narrative';

/** AI-written narrative summary of today's briefing, cached once per calendar day. */
export async function getAIDailyNarrative(snapshot, { force = false } = {}) {
  const cacheKey = `${NARRATIVE_CACHE_KEY}:${snapshot.date}`;
  if (!force) {
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      if (cached) return cached;
    } catch { /* fall through to regenerate */ }
  }
  const { askAI } = await import('./aiService.js');
  const facts = [
    `Appointments today: ${snapshot.events.map(e => e.title).join('; ') || 'none'}.`,
    `Open tasks: ${snapshot.openTasks.map(t => `${t.title} (${t.priority})`).join('; ') || 'none'}.`,
    `Active projects: ${snapshot.activeProjects.map(p => p.title).join('; ') || 'none'}.`
  ].join('\n');
  const out = await askAI({
    message: `Here is today's Workbench data:\n${facts}\n\nWrite a short (3-4 sentence) plain-language daily briefing for a pastor. Be direct and practical, not flowery. If something is urgent, say so plainly. Do not invent tasks, events, or projects beyond what is listed.`,
    includeWorkbench: false,
    includeBooks: false
  });
  const result = { text: out.answer, model: out.model, generatedAt: new Date().toISOString() };
  try { localStorage.setItem(cacheKey, JSON.stringify(result)); } catch { /* storage unavailable */ }
  return result;
}

export async function getAssistantSnapshot(date = new Date()) {
  const briefing = await getDailyBriefing(date);
  const knowledge = await listKnowledge({ type: 'all' });
  return {
    ...briefing,
    knowledgeCount: knowledge.length,
    summary: {
      appointments: briefing.events.length,
      tasksDue: briefing.openTasks.length,
      urgentTasks: briefing.urgentTasks.length,
      activeProjects: briefing.activeProjects.length,
      knowledgeItems: knowledge.length
    }
  };
}
