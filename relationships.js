// relationships.js — generic cross-domain relationship engine.
// Dedicated structured relationships remain their own entities; this module
// handles flexible knowledge connections.

import { RELATIONSHIP_TYPES } from "./dataModel.js";

function id() {
  return globalThis.crypto?.randomUUID?.() || `rel_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function normalizeRelationship(input) {
  if (!input || typeof input !== "object") throw new TypeError("Relationship must be an object.");
  for (const field of ["id", "source_type", "source_id", "target_type", "target_id", "relationship_type"]) {
    if (typeof input[field] !== "string" || input[field].trim() === "") throw new TypeError(`Relationship.${field} is required.`);
  }
  if (!RELATIONSHIP_TYPES.includes(input.relationship_type)) throw new TypeError(`Invalid relationship type: ${input.relationship_type}`);
  return Object.freeze({
    id: input.id,
    workspace_id: input.workspace_id ?? null,
    source_type: input.source_type,
    source_id: input.source_id,
    target_type: input.target_type,
    target_id: input.target_id,
    relationship_type: input.relationship_type,
    created_at: input.created_at || new Date().toISOString(),
    created_by: input.created_by ?? null,
    metadata: input.metadata && typeof input.metadata === "object" ? { ...input.metadata } : {}
  });
}

export function link(source_type, source_id, target_type, target_id, relationship_type = "related", metadata = {}) {
  return normalizeRelationship({
    id: id(), source_type, source_id, target_type, target_id, relationship_type, metadata
  });
}

export function everythingRelatedTo(relationships, type, idValue, { direction = "both", relationshipType = null } = {}) {
  return (Array.isArray(relationships) ? relationships : []).filter((relationship) => {
    if (relationshipType && relationship.relationship_type !== relationshipType) return false;
    const outgoing = relationship.source_type === type && relationship.source_id === idValue;
    const incoming = relationship.target_type === type && relationship.target_id === idValue;
    if (direction === "outgoing") return outgoing;
    if (direction === "incoming") return incoming;
    return outgoing || incoming;
  });
}

export function reverseRelationships(relationships, type, idValue, options = {}) {
  return everythingRelatedTo(relationships, type, idValue, { ...options, direction: "incoming" });
}
