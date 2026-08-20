// dataModel.js — Phase 1 structured entities + strict validation.
// The model follows the approved architecture: structured records are primary;
// exported files, AI chats, and UI state are not substitutes for domain data.

export const ENTITY_TYPES = Object.freeze([
  "User", "Workspace", "Project", "Sermon", "SermonStage", "SermonPoint",
  "Lesson", "LessonTeachingSection", "Study", "ResearchItem", "Note", "Topic",
  "Collection", "Source", "Resource", "LibraryItem", "Document", "Template", "Tag",
  "AISession", "AIResponse", "Version", "Change",
  "BibleTranslation", "BibleBook", "BibleChapter", "BibleVerse", "ConcordanceEntry",
  "CrossReference", "Confession", "ConfessionChapter", "ConfessionParagraph"
]);

export const PROJECT_TYPES = Object.freeze(["sermon", "lesson", "study", "research", "writing", "general"]);
export const PROJECT_STATUSES = Object.freeze(["draft", "active", "completed", "archived"]);
export const RESEARCH_TYPES = Object.freeze([
  "observation", "question", "argument", "counterargument", "quote", "historical",
  "linguistic", "theological_connection", "conclusion", "ai_analysis", "application"
]);
export const NOTE_TYPES = Object.freeze([
  "observation", "idea", "question", "application", "reflection", "theological_position",
  "sermon_note", "lesson_note", "general"
]);
export const KNOWLEDGE_ORIGINS = Object.freeze(["personal", "source", "ai"]);
export const RELATIONSHIP_TYPES = Object.freeze([
  "related", "topic", "scripture", "source", "project", "note", "research", "sermon",
  "lesson", "study", "confession", "document", "collection", "tag", "other"
]);
export const CROSS_REFERENCE_TYPES = Object.freeze([
  "parallel", "quotation", "allusion", "thematic", "prophetic", "fulfillment", "conceptual", "other"
]);
export const SERMON_STAGE_KEYS = Object.freeze([
  "personal_preparation", "text_analysis", "text_structure", "text_intent", "sermon_intent",
  "sermon_structure", "content_synthesis", "personal_assimilation", "manuscript", "post_sermon_review"
]);

// The first eight stages are the canonical expository workflow. Manuscript and
// post-sermon review are deliberately kept as finalization/review layers rather
// than being counted as additional preparation steps.
export const EXPOSITORY_STAGE_KEYS = Object.freeze(SERMON_STAGE_KEYS.slice(0, 8));
export const SERMON_STAGE_META = Object.freeze({
  personal_preparation: { number: 1, title: "Personal Preparation", focus: "Prepare yourself before you prepare the sermon.", prompt: "Before I interpret this passage, where does this text confront me personally? What do I need to confess, pray over, submit to, or clarify in my own life so that I approach the text as its servant rather than its master?" },
  text_analysis: { number: 2, title: "Analyze the Text", focus: "Observe the passage carefully before explaining it.", prompt: "What does the text actually say before I explain what it means? Record the observable details: words, grammar, syntax, repetitions, contrasts, commands, connectors, emphases, key terms, context, and anything that cannot be ignored." },
  text_structure: { number: 3, title: "Expose the Text Structure", focus: "Discover the structure that is actually in the passage.", prompt: "If I had to show the congregation how the author built this passage, where would I divide it and why? Identify the natural movements, clauses, paragraphs, relationships, and progression of thought without imposing an outline from outside the text." },
  text_intent: { number: 4, title: "Understand the Text's Intent", focus: "State what the inspired author intended to communicate.", prompt: "What did the inspired author mean to communicate here, in this context, to the original audience? State the central proposition of the passage and show how its surrounding context supports that meaning." },
  sermon_intent: { number: 5, title: "Isolate the Sermon Intent", focus: "Determine the one controlling aim for this sermon.", prompt: "Given what this passage means, what is the one controlling truth I want this congregation to understand and respond to? State the sermon aim as a clear, pastoral proposition that grows out of the text rather than replacing it." },
  sermon_structure: { number: 6, title: "Organize the Sermon Structure", focus: "Build the sermon from the structure and intent of the text.", prompt: "How should I organize the sermon so the congregation can follow the author’s argument? Identify the main preaching movements that arise naturally from the text, then determine the order, transitions, introduction, and conclusion." },
  content_synthesis: { number: 7, title: "Synthesize the Sermon Content", focus: "Bring explanation, evidence, illustration, and application together under the text.", prompt: "What must I say to make each movement of the text understandable and pastorally useful? Gather the necessary explanation, word studies, cross-references, doctrine, illustrations, applications, objections, and transitions—without burying the text under material." },
  personal_assimilation: { number: 8, title: "Personal Assimilation", focus: "Make the message your own before you preach it.", prompt: "What has this passage done to me? Where must I repent, believe, change, obey, hope, or worship? What must become real in my own life before I stand in the pulpit and call others to respond?" },
  manuscript: { number: 9, title: "Manuscript & Pulpit Preparation", focus: "Turn the prepared sermon into the form you will actually preach.", prompt: "Write the introduction, exposition, transitions, illustrations, applications, conclusion, and pulpit-ready wording." },
  post_sermon_review: { number: 10, title: "Post-Sermon Review", focus: "Evaluate the sermon after preaching without rewriting history.", prompt: "What was clear? What was unclear? Where did the congregation respond? What should be improved next time? What did I learn about the text and my preaching?" }
});

const REQUIRED_FIELDS = Object.freeze({
  User: ["id", "email", "display_name", "created_at", "updated_at", "settings"],
  Workspace: ["id", "user_id", "name", "description", "created_at", "updated_at"],
  Project: ["id", "workspace_id", "user_id", "project_type", "title", "description", "status", "created_at", "updated_at"],
  Sermon: ["id", "project_id", "title", "primary_text", "sermon_intent", "text_intent", "structure", "manuscript", "status", "created_at", "updated_at"],
  SermonStage: ["id", "sermon_id", "stage_key", "content", "created_at", "updated_at"],
  SermonPoint: ["id", "sermon_id", "parent_point_id", "position", "title", "explanation", "illustration", "application", "created_at", "updated_at"],
  Lesson: ["id", "project_id", "title", "created_at", "updated_at"],
  LessonTeachingSection: ["id", "lesson_id", "position", "title", "content", "scripture_references", "created_at", "updated_at"],
  Study: ["id", "project_id", "title", "created_at", "updated_at"],
  ResearchItem: ["id", "workspace_id", "user_id", "research_type", "title", "content", "status", "created_at", "updated_at"],
  Note: ["id", "workspace_id", "user_id", "title", "content", "note_type", "origin", "created_at", "updated_at"],
  Topic: ["id", "workspace_id", "user_id", "name", "created_at", "updated_at"],
  Collection: ["id", "workspace_id", "user_id", "name", "created_at", "updated_at"],
  Source: ["id", "title", "source_type", "provenance"],
  Resource: ["id", "resource_type", "title", "provider", "license", "metadata"],
  LibraryItem: ["id", "source_id", "title", "resource_type", "metadata"],
  Document: ["id", "title", "document_type"],
  Template: ["id", "name", "template_type", "content"],
  Tag: ["id", "name"],
  AISession: ["id", "workspace_id", "provider", "model", "mode", "created_at"],
  AIResponse: ["id", "session_id", "response", "provenance", "approval_status", "created_at"],
  Version: ["id", "entity_type", "entity_id", "version_number", "content", "created_at", "reason_for_change"],
  Change: ["id", "entity_type", "entity_id", "operation", "timestamp", "created_by"],
  BibleTranslation: ["id", "name", "abbreviation", "language", "provider", "license", "is_local", "is_default", "metadata"],
  BibleBook: ["id", "canonical_id", "order", "testament", "name", "abbreviation", "chapter_count"],
  BibleChapter: ["id", "book_id", "chapter_number", "verse_count", "first_verse", "last_verse"],
  BibleVerse: ["id", "canonical_verse_id", "book_id", "chapter", "verse", "translation_id", "text", "searchable_text"],
  ConcordanceEntry: ["id", "language", "word", "normalized_word", "display_form", "description", "metadata", "source_id"],
  CrossReference: ["id", "source_verse_id", "target_verse_id", "relationship_type", "source", "notes", "provenance", "confidence"],
  Confession: ["id", "name", "edition", "metadata"],
  ConfessionChapter: ["id", "confession_id", "chapter_number", "title"],
  ConfessionParagraph: ["id", "chapter_id", "paragraph_number", "text", "is_seeded"]
});

const SCHEMAS = Object.freeze({
  User: ["id", "email", "display_name", "created_at", "updated_at", "last_seen_at", "settings"],
  Workspace: ["id", "user_id", "name", "description", "created_at", "updated_at"],
  Project: ["id", "workspace_id", "user_id", "project_type", "title", "description", "status", "created_at", "updated_at", "archived_at"],
  Sermon: ["id", "project_id", "title", "primary_text", "sermon_intent", "text_intent", "structure", "manuscript", "status", "preached_at", "created_at", "updated_at"],
  SermonStage: ["id", "sermon_id", "stage_key", "content", "created_at", "updated_at"],
  SermonPoint: ["id", "sermon_id", "parent_point_id", "position", "title", "explanation", "illustration", "application", "created_at", "updated_at"],
  Lesson: ["id", "project_id", "title", "subtitle", "purpose", "overview", "key_truth", "key_scripture", "personal_application", "memory_verse", "takeaway", "created_at", "updated_at"],
  LessonTeachingSection: ["id", "lesson_id", "position", "title", "content", "scripture_references", "created_at", "updated_at"],
  Study: ["id", "project_id", "title", "description", "primary_question", "conclusion", "created_at", "updated_at"],
  ResearchItem: ["id", "workspace_id", "user_id", "project_id", "research_type", "title", "content", "status", "created_at", "updated_at"],
  Note: ["id", "workspace_id", "user_id", "project_id", "title", "content", "note_type", "origin", "created_at", "updated_at"],
  Topic: ["id", "workspace_id", "user_id", "name", "description", "created_at", "updated_at"],
  Collection: ["id", "workspace_id", "user_id", "name", "description", "created_at", "updated_at"],
  Source: ["id", "title", "source_type", "author", "publisher", "location", "provenance", "created_at", "updated_at"],
  Resource: ["id", "resource_type", "title", "provider", "license", "metadata"],
  LibraryItem: ["id", "source_id", "title", "resource_type", "metadata", "created_at", "updated_at"],
  Document: ["id", "title", "document_type", "project_id", "source_entity_type", "source_entity_id", "created_at", "updated_at"],
  Template: ["id", "name", "template_type", "content", "created_at", "updated_at"],
  Tag: ["id", "name", "created_at", "updated_at"],
  AISession: ["id", "workspace_id", "provider", "model", "mode", "created_at"],
  AIResponse: ["id", "session_id", "response", "provenance", "approval_status", "created_at"],
  Version: ["id", "entity_type", "entity_id", "version_number", "content", "created_at", "reason_for_change"],
  Change: ["id", "entity_type", "entity_id", "operation", "timestamp", "created_by"],
  BibleTranslation: ["id", "name", "abbreviation", "language", "provider", "license", "is_local", "is_default", "metadata"],
  BibleBook: ["id", "canonical_id", "order", "testament", "name", "abbreviation", "chapter_count", "previous_book_id", "next_book_id"],
  BibleChapter: ["id", "book_id", "chapter_number", "verse_count", "first_verse", "last_verse"],
  BibleVerse: ["id", "canonical_verse_id", "book_id", "chapter", "verse", "translation_id", "text", "searchable_text"],
  ConcordanceEntry: ["id", "language", "word", "normalized_word", "display_form", "description", "metadata", "source_id"],
  CrossReference: ["id", "source_verse_id", "target_verse_id", "relationship_type", "source", "notes", "provenance", "confidence"],
  Confession: ["id", "name", "edition", "metadata"],
  ConfessionChapter: ["id", "confession_id", "chapter_number", "title", "is_seeded", "verification_status"],
  ConfessionParagraph: ["id", "chapter_id", "paragraph_number", "text", "is_seeded", "verification_status", "source", "source_url"]
});

function fail(message) { throw new TypeError(message); }
function isRecord(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function requireString(record, field, entity) {
  if (typeof record[field] !== "string" || record[field].trim() === "") fail(`${entity}.${field} must be a non-empty string.`);
}
function requireBoolean(record, field, entity) {
  if (typeof record[field] !== "boolean") fail(`${entity}.${field} must be boolean.`);
}
function requireNumber(record, field, entity) {
  if (typeof record[field] !== "number" || !Number.isFinite(record[field])) fail(`${entity}.${field} must be a finite number.`);
}
function requireArray(record, field, entity) {
  if (!Array.isArray(record[field])) fail(`${entity}.${field} must be an array.`);
}
function requireObject(record, field, entity) {
  if (!isRecord(record[field])) fail(`${entity}.${field} must be an object.`);
}

export function getSchema(entity) {
  if (!SCHEMAS[entity]) fail(`Unknown entity type: ${entity}`);
  return [...SCHEMAS[entity]];
}

export function validateRecord(entity, record) {
  if (!SCHEMAS[entity]) fail(`Unknown entity type: ${entity}`);
  if (!isRecord(record)) fail(`${entity} must be an object.`);

  for (const field of REQUIRED_FIELDS[entity] || ["id"]) {
    if (!(field in record) || record[field] === null || record[field] === undefined) {
      fail(`${entity}.${field} is required.`);
    }
  }
  requireString(record, "id", entity);

  if (entity === "Project") {
    if (!PROJECT_TYPES.includes(record.project_type)) fail(`Project.project_type is invalid: ${record.project_type}`);
    if (!PROJECT_STATUSES.includes(record.status)) fail(`Project.status is invalid: ${record.status}`);
  }
  if (entity === "SermonStage" && !SERMON_STAGE_KEYS.includes(record.stage_key)) fail(`SermonStage.stage_key is invalid: ${record.stage_key}`);
  if (entity === "ResearchItem" && !RESEARCH_TYPES.includes(record.research_type)) fail(`ResearchItem.research_type is invalid: ${record.research_type}`);
  if (entity === "ResearchItem" && record.origin !== undefined && !KNOWLEDGE_ORIGINS.includes(record.origin)) fail(`ResearchItem.origin is invalid: ${record.origin}`);
  if (entity === "Note" && !NOTE_TYPES.includes(record.note_type)) fail(`Note.note_type is invalid: ${record.note_type}`);
  if (["Note", "ResearchItem"].includes(entity) && record.origin === "source" && !record.provenance) fail(`${entity} source material requires provenance.`);

  if (entity === "SermonPoint" || entity === "LessonTeachingSection") requireNumber(record, "position", entity);
  if (entity === "BibleBook") {
    requireNumber(record, "order", entity);
    requireNumber(record, "chapter_count", entity);
  }
  if (entity === "BibleChapter") {
    for (const field of ["chapter_number", "verse_count", "first_verse", "last_verse"]) requireNumber(record, field, entity);
  }
  if (entity === "BibleVerse") {
    for (const field of ["chapter", "verse"]) requireNumber(record, field, entity);
  }
  if (entity === "BibleTranslation") {
    requireBoolean(record, "is_local", entity);
    requireBoolean(record, "is_default", entity);
  }
  if (entity === "ConcordanceEntry") requireObject(record, "metadata", entity);
  if (entity === "CrossReference") {
    for (const field of ["source_verse_id", "target_verse_id", "relationship_type", "source"]) requireString(record, field, entity);
    if (!CROSS_REFERENCE_TYPES.includes(record.relationship_type)) fail(`CrossReference.relationship_type is invalid: ${record.relationship_type}`);
    requireObject(record, "provenance", entity);
    if (typeof record.confidence !== "number" || record.confidence < 0 || record.confidence > 1) fail("CrossReference.confidence must be a number from 0 to 1.");
  }
  if (entity === "ConfessionParagraph") requireBoolean(record, "is_seeded", entity);
  if (entity === "AIResponse") requireObject(record, "provenance", entity);

  return Object.freeze({ ...record });
}

export function createRecord(entity, record) {
  return validateRecord(entity, record);
}

export const schemas = Object.freeze(Object.fromEntries(
  ENTITY_TYPES.map((entity) => [entity, Object.freeze(getSchema(entity))])
));
