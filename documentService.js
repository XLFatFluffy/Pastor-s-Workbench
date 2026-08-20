// documentService.js
// DOCX/PDF/Markdown/TXT generation as an output layer only — structured record stays authoritative.
//
// STATUS: not yet implemented. This file exists to hold the place in the
// layered architecture (P1) so no future session accidentally recreates
// this responsibility inline elsewhere. Real implementation is scheduled
// for Phase 8 (Library, Documents, Import/Export) of the rebuild plan.
//
// UI code must never import this module directly if it is a service —
// only other services / views may call it once it is real (P1).

export {};
