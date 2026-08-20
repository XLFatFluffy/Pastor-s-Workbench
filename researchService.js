// Phase 6 — Research & Knowledge Engine.
// Structured local-first knowledge records with explicit knowledge origin,
// provenance boundaries, search, and generic Workbench relationships.

import { all, get, put, remove } from "./store.js";
import { createRecord, KNOWLEDGE_ORIGINS, NOTE_TYPES, RESEARCH_TYPES } from "./dataModel.js";
import { link, normalizeRelationship } from "./relationships.js";

const RESEARCH_STORE = "research_items";
const NOTE_STORE = "notes";
const TOPIC_STORE = "topics";
const COLLECTION_STORE = "collections";
const SOURCE_STORE = "sources";
const RELATIONSHIP_STORE = "relationships";

function uid(prefix) {
  return `${prefix}:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function now() { return new Date().toISOString(); }

function clean(value) { return String(value ?? "").trim(); }

export function normalizeKnowledgeOrigin(value) {
  const origin = clean(value).toLowerCase();
  if (!KNOWLEDGE_ORIGINS.includes(origin)) throw new TypeError(`Knowledge origin must be one of: ${KNOWLEDGE_ORIGINS.join(", ")}.`);
  return origin;
}

export function validateKnowledgeBoundary({ origin, provenance = null } = {}) {
  const normalizedOrigin = normalizeKnowledgeOrigin(origin);
  if ((normalizedOrigin === "source" || normalizedOrigin === "ai") && (!provenance || typeof provenance !== "object" || Array.isArray(provenance))) {
    throw new TypeError(`${normalizedOrigin === "source" ? "Source" : "AI"} knowledge requires provenance.`);
  }
  if (normalizedOrigin === "personal" && provenance && typeof provenance !== "object") {
    throw new TypeError("Personal knowledge provenance must be an object when supplied.");
  }
  return Object.freeze({ origin: normalizedOrigin, provenance: provenance ? { ...provenance } : null });
}

export function normalizeResearchItem(input = {}) {
  const boundary = validateKnowledgeBoundary(input);
  const record = {
    id: clean(input.id) || uid("research"),
    workspace_id: clean(input.workspace_id) || "default",
    user_id: clean(input.user_id) || "local-user",
    project_id: clean(input.project_id) || null,
    research_type: clean(input.research_type).toLowerCase() || "observation",
    title: clean(input.title),
    content: clean(input.content),
    status: clean(input.status).toLowerCase() || "active",
    origin: boundary.origin,
    provenance: boundary.provenance,
    created_at: input.created_at || now(),
    updated_at: now()
  };
  if (!RESEARCH_TYPES.includes(record.research_type)) throw new TypeError(`Invalid research type: ${record.research_type}`);
  if (!record.title) throw new TypeError("ResearchItem.title is required.");
  if (!record.content) throw new TypeError("ResearchItem.content is required.");
  return createRecord("ResearchItem", record);
}

export function normalizeNote(input = {}) {
  const boundary = validateKnowledgeBoundary(input);
  const record = {
    id: clean(input.id) || uid("note"),
    workspace_id: clean(input.workspace_id) || "default",
    user_id: clean(input.user_id) || "local-user",
    project_id: clean(input.project_id) || null,
    title: clean(input.title),
    content: clean(input.content),
    note_type: clean(input.note_type).toLowerCase() || "general",
    origin: boundary.origin,
    provenance: boundary.provenance,
    scripture: Array.isArray(input.scripture) ? input.scripture : [],
    created_at: input.created_at || now(),
    updated_at: now()
  };
  if (!NOTE_TYPES.includes(record.note_type)) throw new TypeError(`Invalid note type: ${record.note_type}`);
  if (!record.title) throw new TypeError("Note.title is required.");
  if (!record.content) throw new TypeError("Note.content is required.");
  return createRecord("Note", record);
}

export function normalizeTopic(input = {}) {
  const record = {
    id: clean(input.id) || uid("topic"),
    workspace_id: clean(input.workspace_id) || "default",
    user_id: clean(input.user_id) || "local-user",
    name: clean(input.name),
    description: clean(input.description),
    created_at: input.created_at || now(),
    updated_at: now()
  };
  if (!record.name) throw new TypeError("Topic.name is required.");
  return createRecord("Topic", record);
}

export function normalizeCollection(input = {}) {
  const record = {
    id: clean(input.id) || uid("collection"),
    workspace_id: clean(input.workspace_id) || "default",
    user_id: clean(input.user_id) || "local-user",
    name: clean(input.name),
    description: clean(input.description),
    created_at: input.created_at || now(),
    updated_at: now()
  };
  if (!record.name) throw new TypeError("Collection.name is required.");
  return createRecord("Collection", record);
}

export function normalizeSource(input = {}) {
  const record = {
    id: clean(input.id) || uid("source"),
    title: clean(input.title),
    source_type: clean(input.source_type).toLowerCase() || "other",
    author: clean(input.author),
    publisher: clean(input.publisher),
    location: clean(input.location),
    provenance: input.provenance && typeof input.provenance === "object" ? { ...input.provenance } : {},
    created_at: input.created_at || now(),
    updated_at: now()
  };
  if (!record.title) throw new TypeError("Source.title is required.");
  return record;
}

async function save(store, record) {
  await put(store, record);
  return record;
}

export async function saveResearchItem(input) { return save(RESEARCH_STORE, normalizeResearchItem(input)); }
export async function saveNote(input) { return save(NOTE_STORE, normalizeNote(input)); }
export async function saveTopic(input) { return save(TOPIC_STORE, normalizeTopic(input)); }
export async function saveCollection(input) { return save(COLLECTION_STORE, normalizeCollection(input)); }
export async function saveSource(input) { return save(SOURCE_STORE, normalizeSource(input)); }

export async function getKnowledgeRecord(type, id) {
  const stores = { ResearchItem: RESEARCH_STORE, Note: NOTE_STORE, Topic: TOPIC_STORE, Collection: COLLECTION_STORE, Source: SOURCE_STORE };
  const store = stores[type];
  if (!store) throw new TypeError(`Unsupported knowledge type: ${type}`);
  return get(store, id);
}

export async function listKnowledge({ type = "all", origin = null, search = "" } = {}) {
  const storeMap = { ResearchItem: RESEARCH_STORE, Note: NOTE_STORE, Topic: TOPIC_STORE, Collection: COLLECTION_STORE, Source: SOURCE_STORE };
  const stores = type === "all" ? Object.values(storeMap) : [storeMap[type]];
  if (stores.some((store) => !store)) throw new TypeError(`Unsupported knowledge type: ${type}`);
  const needle = clean(search).toLowerCase();
  const rows = [];
  for (const store of stores) {
    for (const row of await all(store)) {
      const matchesOrigin = !origin || row.origin === origin;
      const haystack = [row.title, row.name, row.content, row.description, row.research_type, row.note_type].join(" ").toLowerCase();
      if (matchesOrigin && (!needle || haystack.includes(needle))) rows.push({ ...row, _store: store });
    }
  }
  return rows.sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")));
}

export async function deleteKnowledgeRecord(type, id) {
  const stores = { ResearchItem: RESEARCH_STORE, Note: NOTE_STORE, Topic: TOPIC_STORE, Collection: COLLECTION_STORE, Source: SOURCE_STORE };
  const store = stores[type];
  if (!store) throw new TypeError(`Unsupported knowledge type: ${type}`);
  await remove(store, id);
  const relationships = await all(RELATIONSHIP_STORE);
  for (const relationship of relationships) {
    if ((relationship.source_type === type && relationship.source_id === id) || (relationship.target_type === type && relationship.target_id === id)) await remove(RELATIONSHIP_STORE, relationship.id);
  }
}

export async function relateKnowledge(sourceType, sourceId, targetType, targetId, relationshipType = "related", metadata = {}) {
  const relationship = normalizeRelationship(link(sourceType, sourceId, targetType, targetId, relationshipType, metadata));
  await put(RELATIONSHIP_STORE, relationship);
  return relationship;
}

export async function unlinkKnowledge(relationshipId) { await remove(RELATIONSHIP_STORE, relationshipId); }

export async function detachKnowledgeFromProject(projectId) {
  const cleanProjectId = clean(projectId);
  if (!cleanProjectId) return 0;
  let detached = 0;
  for (const [store, normalizer] of [[RESEARCH_STORE, normalizeResearchItem], [NOTE_STORE, normalizeNote]]) {
    for (const row of await all(store)) {
      if (row.project_id !== cleanProjectId) continue;
      await put(store, normalizer({ ...row, project_id: null }));
      detached += 1;
    }
  }
  return detached;
}

export async function getKnowledgeRelationships(type, id) {
  return (await all(RELATIONSHIP_STORE)).filter((row) =>
    (row.source_type === type && row.source_id === id) || (row.target_type === type && row.target_id === id)
  );
}

export async function getKnowledgeStats() {
  const [research, notes, topics, collections, sources, relationships] = await Promise.all([
    all(RESEARCH_STORE), all(NOTE_STORE), all(TOPIC_STORE), all(COLLECTION_STORE), all(SOURCE_STORE), all(RELATIONSHIP_STORE)
  ]);
  const byOrigin = { personal: 0, source: 0, ai: 0 };
  for (const row of [...research, ...notes]) if (byOrigin[row.origin] !== undefined) byOrigin[row.origin] += 1;
  return { research: research.length, notes: notes.length, topics: topics.length, collections: collections.length, sources: sources.length, relationships: relationships.length, byOrigin };
}
