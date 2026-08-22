// Calendar + daily planning service.
// Scheduling is structured domain data, separate from the visual calendar.
import { all, get, put, remove } from './store.js';
import { createRecord } from './dataModel.js';

const STORES = Object.freeze({ event: 'calendar_events', task: 'daily_tasks' });
const uid = prefix => `${prefix}:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const now = () => new Date().toISOString();
const text = value => String(value ?? '').trim();
const dateOnly = value => text(value).slice(0, 10);

export const TASK_PRIORITIES = Object.freeze(['low', 'normal', 'high', 'urgent']);
export const TASK_STATUSES = Object.freeze(['open', 'in_progress', 'done', 'cancelled']);
export const EVENT_STATUSES = Object.freeze(['scheduled', 'completed', 'cancelled']);

export function normalizeEvent(input = {}) {
  const start = text(input.start_at);
  const end = text(input.end_at) || start;
  if (!start) throw new TypeError('CalendarEvent.start_at is required.');
  if (new Date(end).getTime() < new Date(start).getTime()) throw new TypeError('CalendarEvent.end_at cannot be before start_at.');
  return createRecord('CalendarEvent', {
    id: text(input.id) || uid('event'), workspace_id: text(input.workspace_id) || 'default', project_id: text(input.project_id),
    title: text(input.title) || 'Untitled event', description: text(input.description), start_at: start, end_at: end,
    all_day: Boolean(input.all_day), status: EVENT_STATUSES.includes(text(input.status)) ? text(input.status) : 'scheduled',
    created_at: input.created_at || now(), updated_at: now()
  });
}

export function normalizeTask(input = {}) {
  const due = dateOnly(input.due_date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new TypeError('DailyTask.due_date must be YYYY-MM-DD.');
  const priority = text(input.priority).toLowerCase() || 'normal';
  const status = text(input.status).toLowerCase() || 'open';
  if (!TASK_PRIORITIES.includes(priority)) throw new TypeError(`Invalid task priority: ${priority}`);
  if (!TASK_STATUSES.includes(status)) throw new TypeError(`Invalid task status: ${status}`);
  return createRecord('DailyTask', {
    id: text(input.id) || uid('task'), workspace_id: text(input.workspace_id) || 'default', project_id: text(input.project_id),
    title: text(input.title) || 'Untitled task', description: text(input.description), due_date: due,
    priority, status, completed_at: input.completed_at ?? null, created_at: input.created_at || now(), updated_at: now()
  });
}

export async function saveEvent(input) { const record = normalizeEvent(input); await put(STORES.event, record); return record; }
export async function saveTask(input) { const record = normalizeTask(input); await put(STORES.task, record); return record; }
export async function getEvent(id) { return get(STORES.event, id); }
export async function getTask(id) { return get(STORES.task, id); }
export async function deleteEvent(id) { return remove(STORES.event, id); }
export async function deleteTask(id) { return remove(STORES.task, id); }

export async function listEvents({ from = '', to = '', status = '' } = {}) {
  const rows = await all(STORES.event);
  return rows.filter(e => (!from || e.start_at >= from) && (!to || e.start_at <= to) && (!status || e.status === status))
    .sort((a,b) => a.start_at.localeCompare(b.start_at));
}
export async function listTasks({ dueDate = '', from = '', to = '', status = '' } = {}) {
  const rows = await all(STORES.task);
  return rows.filter(t => (!dueDate || t.due_date === dueDate) && (!from || t.due_date >= from) && (!to || t.due_date <= to) && (!status || t.status === status))
    .sort((a,b) => a.due_date.localeCompare(b.due_date) || ({urgent:0,high:1,normal:2,low:3}[a.priority] ?? 2) - ({urgent:0,high:1,normal:2,low:3}[b.priority] ?? 2));
}
export async function completeTask(id) {
  const task = await getTask(id); if (!task) throw new Error('Task not found.');
  return saveTask({ ...task, status: 'done', completed_at: now() });
}
export async function reopenTask(id) {
  const task = await getTask(id); if (!task) throw new Error('Task not found.');
  return saveTask({ ...task, status: 'open', completed_at: null });
}

export function localDateKey(date = new Date()) {
  const d = new Date(date); const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
export function monthBounds(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), 1); const end = new Date(date.getFullYear(), date.getMonth()+1, 0);
  return { start: localDateKey(d), end: localDateKey(end) };
}
