# Pastor's Workbench — Pastoral Assistant Roadmap

## Vision

Pastor's Workbench is being developed as an **all-around pastor's assistant for daily life and ministry**: one local-first workspace where Scripture, sermons, lessons, research, books, projects, planning, pastoral care, prayer, notes, files, and AI assistance work together.

The goal is not to create dozens of disconnected tabs. The goal is an assistant that understands the pastor's current work and can safely move information and actions between the parts of the Workbench.

## Core Assistant Principle

The AI should progress from **answering questions** to **helping operate the Workbench**.

The long-term action loop is:

**Read → Understand → Plan → Ask permission when needed → Act → Report**

Examples:

- "Start a study on 1 John." → create/title/open a study project.
- "What do I need to accomplish today?" → summarize calendar, tasks, projects, and priorities.
- "Plan my week around finishing this sermon." → propose work blocks and tasks, then schedule after approval.
- "Remind me to call Brother Smith Tuesday." → create a follow-up task.
- "Find my notes on forgiveness." → search the pastor's Workbench knowledge.
- "Continue the 1 John study." → reopen the existing project and continue its context.

## Current Direction (supersedes prior phase ordering below)

The next major stretch of work is sequenced as follows, agreed 2026-08-21:

### Phase 1 — AI Partner + Knowledge Database (build first)
1. Stand up an external database (Supabase) as a real knowledge store — not just backup — holding uploaded books, Puritan and Reformation-era texts, and the pastor's own sermon/lesson/note library.
2. Build retrieval so the AI searches that store before answering, with **mandatory source citation** on any substantive claim (book, sermon, or confession section it drew from).
3. Convert the existing regex-based suggestion engine into an AI-backed judgment layer, while keeping it strictly approval-gated as it is today.
4. Give the AI a Spurgeon-influenced voice/tone, with the citation requirement holding even when writing in that voice.
5. Add AI-assisted daily scheduling that helps ensure study, reading-plan progress, and reflection actually happen.
6. Add native desktop notifications (Tauri) tied to that scheduling.
7. Confirm Supabase covers data portability/backup needs for the new external store.

### Phase 2 — Reading Plans + Journaling
8. Daily Bible reading plan and a separate book reading plan, progress-tracking only (no AI overlay yet).
9. Optional daily journaling/reflection entry tied to each day's reading.

### Phase 3 — Visual Overhaul ("old study room")
10. App-wide theme: Puritan ink-and-stone palette, IM Fell English (display) / Libre Baskerville (body) type pairing, worn-page writing areas throughout (not just journaling).
11. Ambient Spurgeon/Owen/Puritan quotes throughout the app.
12. Full immersive mode, plus a quiet/focus-mode toggle to dim ambiance when needed.

Everything in "Product Areas" and "Execution Order" below reflects the prior planning pass and remains the long-term backlog; Phases 1–3 above take priority over it.

## Product Areas

### Phase A — Assistant Core
1. **Dashboard / Daily Briefing**
   - Today's appointments, tasks, priorities, active projects, and quick actions.
   - Morning briefing foundation.
   - AI entry point from every major screen.
2. **Projects**
   - Sermons, lessons, Bible studies, outreach, conferences, administration, and personal ministry projects.
   - Tasks, notes, calendar, research, files, and AI context attached to projects.
3. **Calendar + Daily Planning**
   - Month/day planning, events, tasks, priorities, and project links.
   - Future AI-assisted scheduling with approval before committing plans.
4. **Quick Capture**
   - Capture an idea, note, research question, or reminder immediately.
   - Optional due date creates a daily task.
5. **Global AI**
   - Background operation while navigating the app.
   - Notifications when work finishes.
   - Project-opening and project-creation actions.

### Phase B — Ministry Knowledge
6. **Bible Study Workspace**
   - Scripture, notes, cross references, topics, research, AI questions, and study history.
7. **Sermon Pipeline**
   - Idea → Study → Outline → Draft → Review → Preach → Archive.
   - Scripture, research, illustrations, applications, notes, dates, and series.
8. **Lessons / Teaching**
   - Same connected workflow for Sunday school, Bible studies, youth, discipleship, and special teaching.
9. **Research / Knowledge**
   - Searchable personal research with explicit provenance boundaries.
10. **Books / Reading Library**
   - Books, reading progress, notes, topics, sections, and connections to ministry work.
11. **Universal Search**
   - Search Bible-linked material, sermons, lessons, projects, notes, research, books, people, and files from one place.
12. **Files / Document Cabinet**
   - Local documents and ministry files with AI-assisted retrieval where permitted.

### Phase C — Pastoral Life
13. **People / Pastoral Care**
   - People, families, visits, calls, follow-ups, prayer requests, and pastoral notes.
   - Privacy-first architecture and explicit AI access controls.
14. **Prayer Journal**
   - People, church, missionaries, personal prayer, active requests, answered prayers, and review history.
15. **Follow-up System**
   - Calls, visits, promises, resources to send, and other pastoral follow-ups.
16. **Daily / Weekly Routines**
   - Morning review, Bible reading, prayer, sermon preparation, administration, evening review, and recurring ministry rhythms.

### Phase D — Intelligent Ministry Assistant
17. **AI Planning**
   - Turn goals into proposed tasks, projects, and schedule blocks.
18. **AI Workbench Actions**
   - Open/create projects, create tasks, organize notes, find material, and navigate to relevant work.
19. **AI Memory / Context**
   - Current sermon series, active studies, projects, priorities, preferences, and recent work.
20. **Morning Briefing**
   - A concise daily summary of the pastor's schedule, unfinished work, priorities, and recommended next actions.
21. **Weekly Review**
   - Review unfinished work, upcoming deadlines, pastoral follow-ups, sermon preparation, and planned priorities.
22. **Safe Automation**
   - AI should distinguish between read-only actions, reversible actions, and consequential actions.
   - Consequential actions such as sending, deleting, or committing major schedule changes should require confirmation.

## Cross-Cutting Requirements

- **Local-first:** important ministry data remains available locally and should not require an internet connection unless a feature explicitly needs one.
- **Privacy:** pastoral-care and other sensitive records must have clear AI access boundaries.
- **Relationships:** records should be linkable instead of duplicated.
- **Provenance:** AI/source material must remain distinguishable from the pastor's personal notes and observations.
- **Backup/export:** the pastor must be able to preserve and restore their Workbench data.
- **Searchability:** everything useful should eventually be discoverable through universal search.
- **Notifications:** long-running AI work should finish in the background and notify the pastor without interrupting navigation.
- **Desktop reliability:** every new feature must continue to work in the Windows desktop build and local web launcher.
- **Testing:** each domain service and important AI action gets automated coverage before being considered complete.

## Execution Order

We will build in vertical slices rather than making shallow placeholders:

1. Assistant Core and Dashboard
2. Connected Projects + Tasks + Calendar
3. Universal Search + Quick Capture **(in progress)**
4. Bible/Study/Sermon/Research relationships
5. Books and Files integration
6. People + Pastoral Care + Follow-ups
7. Prayer + Daily Routines
8. AI planning and safe actions
9. Morning/Weekly briefings
10. Backup, privacy controls, hardening, and release testing

## Current Release: 0.21.0

### Completed in this execution

- Added the **Pastor Assistant Core** service for daily briefing/snapshot data.
- Added a **Pastor's Daily Briefing** to the Dashboard using live calendar, task, and project data.
- Added **Quick Capture** to the Dashboard for notes, ideas, research questions, and optional scheduled reminders.
- Upgraded version metadata to **0.15.0**.
- Added this roadmap as the project's authoritative product plan.

### Next execution target

Build **Bible/Study/Sermon/Research relationships**, then Books/Files integration. AI planning can now propose tasks and calendar events for approval while explicit project creation/opening remains automatic.

## Definition of Done

Pastor's Workbench is successful when a pastor can open it each morning and reasonably ask:

> **"What do I need to do today, what should I work on next, and can you help me do it?"**

…and the Workbench can answer from the pastor's actual saved information, help plan the work, and safely carry out approved actions without forcing the pastor to manage the application manually.


## v0.16.0 Progress
- Added Universal Search as a first-class Workbench route.
- Search scans local projects, sermons, lessons, studies, notes, research, topics, collections, library records, documents, calendar events, tasks, Bible annotations, and confession records.
- Search results link back to the relevant Workbench area.
- Quick Capture remains available from the Dashboard and is the next integration point for turning captured items into linked work.


## v0.17.0 Progress
- Quick Capture now creates project-linked notes, research items, and tasks.
- AI can propose project-linked tasks and calendar events for approval.
- Consequential scheduling changes remain approval-based.

## v0.18.0 Progress
- Added the connected Bible/Study/Sermon/Research relationship layer.
- Study workspaces can attach existing project research and notes without copying content.
- Study workspaces can link verified Scripture passages to the study.
- Relationship duplicates are prevented and cross-domain links remain structured records.

### v0.19.0 Progress
- Added connected-library relationships for Sermons and Lessons.
- Sermon and Lesson workspaces can search indexed Books and attach a book as a source without copying its contents.
- Added reusable connected-book service APIs so future sources/documents can use the same relationship pattern.
- Added automated coverage for book-source relationships.

### Next execution target
Build the same source relationship layer into Files/Documents, then make Universal Search relationship-aware so a pastor can discover not only records but the material connected to the current sermon, lesson, or study.


## v0.20.0 — Connected Files/Documents
- Added a first-class Files & Documents cabinet for local ministry documents.
- Added searchable text extraction for PDF, TXT, Markdown, HTML, and JSON text files.
- Added document text chunks as first-class local search records.
- Added Universal Search hits for document contents while preserving the parent file relationship.
- Added provenance metadata so source files remain distinct from personal notes.
- Added automated document normalization and chunking coverage.

### Next execution target
Connect Files/Documents to projects, sermons, lessons, and studies through the relationship UI, then make AI retrieval relationship-aware.


### v0.21.0 — AI-Friendly Workstations
- Contextual AI assistance bar across workstations
- Workspace-specific suggested prompts
- Machine-readable workspace AI contract
- Global AI receives workspace capability context
- Quick access to AI from every workstation

## v0.25.0 — Connected Files + Context-Aware AI
- Added reusable document relationships for Sermons, Lessons, and Studies.
- Workstations can attach imported local documents without copying their contents.
- Connected documents are included in AI retrieval when the current workspace has a linked entity.
- Added an approval-gated AI document attachment action so the assistant can propose connecting a file to current work.
- Added connected document source controls to Sermon, Lesson, and Study workspaces.
- Switched the recommended local model to Gemma 3 4B for the 16 GB integrated-graphics target; other installed Ollama models remain selectable.

### Next execution target
Build the same connected-source experience into general Projects and Universal Search, then add safer AI planning across tasks and calendar with explicit approval for consequential changes.


### v0.26.0 — Connected Projects + Relationship-Aware Search
- General Workbench projects now have a real connected-source workspace instead of an isolated container view.
- Projects can connect local Files/Documents through the same reusable relationship layer used by Sermons, Lessons, and Studies.
- Generic project context is exposed to the AI through the current-entity context mechanism.
- Universal Search now recognizes relationships to the currently open workspace and ranks directly connected records higher.
- Search results identify records connected to the current workspace.
- AI note/research actions can carry a `project_id`, keeping generated captures attached to the active project when explicitly requested.
- Added reusable connected-entity record APIs for future Projects, People, Prayer, and Follow-up relationships.

### Next execution target
Build the task/calendar relationship layer around Projects, then introduce a structured AI planning proposal that can turn a goal into proposed tasks and schedule blocks. Calendar changes remain approval-gated.


### v0.27.0 — Safe AI Planning
- Added a structured planning proposal service for converting goals into tasks and calendar work blocks.
- Plans are validated as a complete proposal before any data is written.
- Added an approval-gated `plan` AI action; the assistant may propose multiple tasks and calendar blocks together without silently scheduling them.
- Approved plans reuse the existing Calendar/Task persistence layer and preserve project links.
- Added automated coverage for proposal validation, summarization, and AI action extraction.

### Next execution target
Superseded by the "Current Direction" section above — begin Phase 1 (Supabase-backed AI knowledge database and source-cited retrieval) rather than the People/Follow-up/Prayer domains next.


## v0.30.0 — Phase 3 Visual Overhaul ("The Study")
- Retuned the design-system tokens in `styles.css` from the navy/gold "Reading Room" skin to a Puritan ink-and-stone palette (weathered stone/parchment surfaces, lamp-black ink, restrained oxblood and pewter-brass accents). Token names are unchanged, so all ~250 existing consumers picked up the new look without a structural rewrite.
- Switched app typography to the IM Fell English (display) / Libre Baskerville (body) pairing called for in the roadmap; UI chrome (buttons, labels, nav) stays on Inter for legibility.
- Added a worn-page texture (subtle grain + vignette) applied across paper surfaces app-wide, not only the journaling views.
- Added an ambient-quote strip above the workspace header with public-domain Puritan/Reformation-era quotations (Spurgeon, Owen, Baxter, Flavel, Watson, Ryle, Luther, and others), rotating daily. Decorative only — not treated as AI source material and not subject to the Phase 1 citation requirement.
- Added a Focus Mode toggle (dims texture/quotes, flattens shadows, quiets the rail) and an Immersive Mode toggle (deeper page vignette, worn-page treatment extended to text inputs/textareas), both in the rail, both persisted in `localStorage`.
- New `theme.js` module owns all of the above; it is pure UI chrome with no domain data or AI calls, and re-applies the ambient quote on every route change.
- Full test suite (89 tests) still passes unchanged; this release touched only presentation layers (`index.html`, `styles.css`, new `theme.js`).

### Next execution target
Continue Phase 3: extend the worn-page writing-area treatment already added for immersive mode into a dedicated journaling/reflection surface once Phase 2 (reading plans + journaling) exists to consume it. Otherwise Phase 3's remaining items (11–12 above) are now substantially implemented; confirm with the pastor before moving on to Phase 1/2 backlog items.

## v0.28.0 — Dedicated AI Data Layer
The AI now has its own local persistence boundary instead of storing AI conversations and response history in the main Workbench database. The AI database stores conversations, messages, sessions, responses, memory, source indexes, and action history. A one-time migration preserves legacy AI records. Workbench domain data remains authoritative for projects, sermons, lessons, notes, Bible, tasks, and calendar.

### Database direction
- **Current:** local IndexedDB for both Workbench and AI, but in separate databases.
- **Confirmed 2026-08-21:** Supabase will be introduced as the backing store for the new AI knowledge base (uploaded books, Puritan/Reformer texts, sermon/lesson library) — see "Current Direction" above, Phase 1. This is now an active requirement, not a deferred future option.
- **Future option:** move to a stronger embedded relational database for Workbench domain data if scale/search requirements justify it, independent of the AI knowledge store.
