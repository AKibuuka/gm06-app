import { getServiceClient } from "./supabase";

/**
 * Log an admin action to the audit_log table.
 * @param {string} actorId - The admin's member ID
 * @param {string} action - e.g. "create", "update", "delete", "approve", "reject"
 * @param {string} entityType - e.g. "contribution", "loan", "member", "investment", "fine", "setting"
 * @param {string|null} entityId - The ID of the affected entity
 * @param {object} details - Additional context (old values, new values, etc.)
 */
export async function logAudit(actorId, action, entityType, entityId, details = {}) {
  try {
    const db = getServiceClient();
    await db.from("audit_log").insert({
      actor_id: actorId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
    });
  } catch (e) {
    // Audit logging should never break the main flow
    console.error("Audit log failed:", e.message);
  }
}
