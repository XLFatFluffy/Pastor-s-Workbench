// v0.27 — safe AI planning layer.
// Plans are proposals until explicitly approved. Applying a plan writes tasks/events
// only after the complete proposal has been validated.
import { saveTask, saveEvent } from './calendarService.js';

const clean = v => String(v ?? '').trim();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T/;
const PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);

function clone(value) { return JSON.parse(JSON.stringify(value)); }

export function normalizePlanningProposal(input = {}) {
  const tasks = Array.isArray(input.tasks) ? input.tasks : [];
  const events = Array.isArray(input.events) ? input.events : [];
  const proposal = {
    id: clean(input.id) || `plan:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    title: clean(input.title) || 'Workbench Plan',
    goal: clean(input.goal),
    project_id: clean(input.project_id),
    created_at: input.created_at || new Date().toISOString(),
    tasks: tasks.map((task, index) => ({
      title: clean(task.title) || `Planned task ${index + 1}`,
      description: clean(task.description),
      due_date: clean(task.due_date),
      priority: clean(task.priority).toLowerCase() || 'normal',
      project_id: clean(task.project_id) || clean(input.project_id)
    })),
    events: events.map((event, index) => ({
      title: clean(event.title) || `Planned block ${index + 1}`,
      description: clean(event.description),
      start_at: clean(event.start_at),
      end_at: clean(event.end_at),
      all_day: Boolean(event.all_day),
      project_id: clean(event.project_id) || clean(input.project_id)
    }))
  };
  return validatePlanningProposal(proposal);
}

export function validatePlanningProposal(proposal) {
  if (!proposal || typeof proposal !== 'object') throw new TypeError('Planning proposal must be an object.');
  if (!clean(proposal.title)) throw new TypeError('Planning proposal.title is required.');
  if (!Array.isArray(proposal.tasks) || !Array.isArray(proposal.events)) throw new TypeError('Planning proposal.tasks and events must be arrays.');
  if (!proposal.tasks.length && !proposal.events.length) throw new TypeError('Planning proposal must contain at least one task or calendar block.');
  for (const task of proposal.tasks) {
    if (!clean(task.title)) throw new TypeError('Planned task title is required.');
    if (!DATE_RE.test(clean(task.due_date))) throw new TypeError(`Invalid task due date: ${task.due_date}`);
    if (!PRIORITIES.has(clean(task.priority).toLowerCase())) throw new TypeError(`Invalid task priority: ${task.priority}`);
  }
  for (const event of proposal.events) {
    if (!clean(event.title)) throw new TypeError('Planned calendar block title is required.');
    if (!ISO_RE.test(clean(event.start_at)) || !ISO_RE.test(clean(event.end_at))) throw new TypeError('Planned calendar blocks require ISO start_at and end_at values.');
    if (new Date(event.end_at).getTime() < new Date(event.start_at).getTime()) throw new TypeError(`Calendar block ends before it starts: ${event.title}`);
  }
  return Object.freeze(clone(proposal));
}

export function summarizePlanningProposal(proposal) {
  const p = validatePlanningProposal(proposal);
  return {
    title: p.title,
    goal: p.goal,
    taskCount: p.tasks.length,
    eventCount: p.events.length,
    tasks: p.tasks.map(t => ({ title: t.title, due_date: t.due_date, priority: t.priority })),
    events: p.events.map(e => ({ title: e.title, start_at: e.start_at, end_at: e.end_at }))
  };
}

export async function applyPlanningProposal(proposal) {
  const p = validatePlanningProposal(proposal);
  // Validate everything before writing anything so an invalid event cannot leave
  // half of a plan committed.
  const createdTasks = [];
  const createdEvents = [];
  for (const task of p.tasks) createdTasks.push(await saveTask(task));
  for (const event of p.events) createdEvents.push(await saveEvent(event));
  return { proposal: p, tasks: createdTasks, events: createdEvents };
}
