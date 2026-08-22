### v0.27.1 — Reliable AI Note Saving

- Added a direct **Save AI response as note** action to every assistant response.
- AI note saves now automatically associate with the current project when the user is working inside a Project, Sermon, Lesson, or Study.
- Invalid AI note types are safely normalized to `general` instead of causing a save failure.
- AI instructions now explicitly require a note action when the pastor asks the AI to save, keep, capture, add, or record a note.

# Pastor's Workbench

**Version 0.28.0 — Dedicated AI Data Layer**

Pastor's Workbench is a local-first Windows/web application being developed as an all-around pastor's assistant for daily ministry and life. It combines Bible study, sermons, lessons, research, books, projects, notes, calendar planning, and a global AI assistant.

## Product Vision

The Workbench is moving beyond a collection of study tools. The long-term goal is a **pastoral ministry operating system** where the AI can understand the pastor's current work, help plan it, and safely operate the application's tools with permission where appropriate.

Read the full product plan in **`PASTORS-WORKBENCH-ROADMAP.md`**.

## Current Capabilities

- Bible/KJV workspace and related study tools
- 1689 Confession resources
- Concordance and cross-reference tools
- Research and knowledge records
- Sermons, lessons, studies, and projects
- Books/library tools
- Global AI assistant
- AI project creation/opening actions
- AI background work while navigating the app
- AI completion notifications
- Calendar and Daily Planning
- Calendar events and daily tasks linked to projects
- Pastor's Daily Briefing on the Dashboard
- Quick Capture for notes, ideas, research, and reminders
- Local IndexedDB persistence
- Windows desktop build/update foundation

## Development Direction

The roadmap is intentionally organized around connected workflows. New features should strengthen the assistant instead of becoming isolated screens.

The core assistant loop is:

**Read → Understand → Plan → Ask permission when needed → Act → Report**

## Important Development Rules

1. Do not replace working functionality with shallow placeholders.
2. Keep domain logic in services/data layers instead of embedding business rules in views.
3. Preserve local-first behavior.
4. Keep AI/source material provenance separate from personal notes.
5. Treat pastoral-care information as privacy-sensitive and design AI permissions explicitly.
6. Test every new service and important AI action.
7. Keep the Windows desktop launcher/build working.
8. Update `VERSION.txt`, `package.json`, and the roadmap/release notes when meaningful features are added.

## Version 0.16.0 Work Completed

This release begins the **Assistant Core** phase:

- Daily briefing service aggregates today's events, tasks, priorities, and active projects.
- Dashboard now presents a Pastor's Daily Briefing.
- Dashboard now has Quick Capture for fast ministry thoughts and optional scheduled reminders.
- Full pastoral-assistant roadmap added to `PASTORS-WORKBENCH-ROADMAP.md`.

## Testing

Run:

```bash
npm test
```

The release should not be considered complete until the automated tests pass and the Windows desktop build remains functional.


### v0.16.0 — Universal Search
- Added Universal Search across major Workbench knowledge and planning stores.
- Added a dedicated Universal Search navigation entry.
- Results are local-first and link directly back to the relevant workspace.


### v0.17.0 — Connected Capture & AI Planning Actions
- Quick Capture can now link notes, research items, and tasks to an existing project.
- Quick Capture can create a task directly, with a due date and project relationship.
- AI can propose task and calendar-event actions using the approval workflow.
- Project actions remain automatic only when the pastor explicitly requests project creation/opening.
- Calendar/task AI actions remain approval-based because they change the pastor's schedule.
- Expanded AI action labels and system instructions for safe planning.

### Testing
- Run `npm test` before release.
- New planning/capture behavior must be covered by automated tests.


### v0.19.0 — Connected Bible / Study / Sermon / Research
- Added a dedicated connected-knowledge service for cross-domain relationships.
- Study workspaces can attach existing project research and notes without duplicating content.
- Study workspaces can link verified Bible passages to the study through the relationship engine.
- Scripture links use canonical Bible verse identities and preserve translation/reference metadata.
- Duplicate relationships are prevented.
- Added automated coverage for the new connection layer.


## v0.19.0 — Connected Books

Sermon and Lesson workspaces can now attach books from the local indexed library as source relationships. Book contents remain in the library and are not copied into the sermon or lesson. This preserves provenance and keeps one authoritative copy of source material.

- Search indexed books from a Sermon workspace.
- Search indexed books from a Lesson workspace.
- Attach/detect connected books through the relationship service.
- Keep source material separate from the pastor's own sermon/lesson content.
- Automated relationship coverage added.


## v0.20.0 — Connected Files/Documents
- Added a first-class Files & Documents cabinet for local ministry documents.
- Added searchable text extraction for PDF, TXT, Markdown, HTML, and JSON text files.
- Added document text chunks as first-class local search records.
- Added Universal Search hits for document contents while preserving the parent file relationship.
- Added provenance metadata so source files remain distinct from personal notes.
- Added automated document normalization and chunking coverage.

### Next execution target
Connect Files/Documents to projects, sermons, lessons, and studies through the relationship UI, then make AI retrieval relationship-aware.

## v0.20.0 — Connected Files/Documents
- Added a first-class Files & Documents cabinet for local ministry documents.
- Added searchable text extraction for PDF, TXT, Markdown, HTML, and JSON text files.
- Added document text chunks as first-class local search records.
- Added Universal Search hits for document contents while preserving the parent file relationship.
- Added provenance metadata so source files remain distinct from personal notes.
- Added automated document normalization and chunking coverage.


## v0.21.0 — AI-Friendly Workstations
Every major workstation now exposes contextual AI assistance and a workspace contract. The global AI receives the current workspace, visible screen, and supported assistance prompts so users can ask for help without understanding how AI context works.

## v0.22.0 — Proactive Assistant
- Added an AI-written daily briefing narrative on the Dashboard (cached once per day, with a manual refresh) summarizing today's appointments, open tasks, and active projects.
- Added a deterministic, non-AI proactive suggestion engine (`suggestionsService.js`) that scans active sermons/lessons/studies for Scripture references mentioned but not linked, available cross references for verses already linked, and unattached research/notes with related titles. Suggestions appear as dismissible cards on the Dashboard; nothing is written until the pastor clicks "Add to Workbench."
- Extended the existing AI action-approval system with a `sermon_point` action, so the global AI can propose a sermon point (title/explanation/illustration/application) for an existing sermon as an approval card, using the same review-before-save workflow already used for notes, tasks, research, and calendar events.
- All new AI-originated actions remain fully approval-gated; no AI output is saved automatically except the pre-existing, explicitly-requested "project" create/open action.

## v0.23.0 — Map my Workbench
- Added a full, uncapped Workbench scan ("Map my Workbench" button on the Dashboard suggestions panel) — checks every active sermon, lesson, and study for unlinked Scripture references, available cross references, and related research/notes, with no preview limits.
- Results are grouped by project with a progress indicator while scanning.
- Added a per-project "Approve all in this project" bulk action, alongside the existing individual Add/Dismiss per suggestion.
- The Dashboard's default suggestion preview is unchanged (a light, capped sample); the full map is opt-in and on-demand so it never runs unprompted.
- Still fully approval-gated: the scan itself only reads and compares existing data — nothing is linked or saved until the pastor clicks Add to Workbench or Approve all.

## v0.24.0 — Assistant Settings
- Added a new "Assistant" tab in Settings with two toggles: AI daily briefing (on by default) and proactive suggestions (on by default, covers both the Dashboard preview and "Map my Workbench").
- Turning either off hides the corresponding Dashboard UI and skips the underlying work entirely — no background AI calls or scans run when disabled.
- Added a "Clear dismissed" control in the same tab, showing how many suggestions are currently hidden and letting the pastor bring them back.
- Model choice for the daily briefing and any future AI review remains the existing AI tab's "Default local model" selector — Gemma3:4b, Qwen3:8b, or any other pulled Ollama model all work there; no separate model setting was needed since the deterministic Map/Suggestions engine makes no AI calls at all.
- No new cloud/database dependency was added; everything here is local-first (IndexedDB + localStorage), consistent with the rest of the app.


## v0.25.0 — Connected Files + Context-Aware AI
- Sermon, Lesson, and Study workspaces can attach local Files & Documents as reusable sources.
- Connected documents are supplied to AI retrieval for the active workspace instead of relying only on global document search.
- AI can propose document attachments through the existing approval workflow.
- Gemma 3 4B is now the recommended local model for the 16 GB integrated-graphics target; users can still select any installed Ollama model.


### v0.27.0 — Connected Projects + Relationship-Aware Search
- General projects now expose connected source management for local documents.
- Universal Search boosts and labels material directly connected to the currently open workspace.
- AI note/research captures can retain a project relationship.
- Added reusable connected-entity APIs for future relationship-heavy ministry domains.


## v0.27.0
Safe AI planning proposals can group project-linked tasks and calendar work blocks into a single approval-gated plan. Plans are validated before writes and are never silently scheduled.


### v0.28.0 — Dedicated AI Data Layer
- Added a separate local IndexedDB database named `pastors-workbench-ai` for AI conversations, messages, sessions, responses, memory, source indexes, and AI action history.
- AI conversations/history no longer use the main Workbench database as their authoritative store.
- Added a one-time migration that copies existing legacy AI conversations/messages/sessions/responses into the dedicated AI database so existing installs do not lose history.
- Added persistent AI memory and source-record APIs for future project-aware retrieval and uploaded-book indexing.
- Added AI database status to Settings so the separation is visible and inspectable.
- Workbench remains the source of truth for projects, sermons, lessons, notes, Bible data, tasks, and calendar records.
- No cloud database dependency was added; the AI database remains local-first.
