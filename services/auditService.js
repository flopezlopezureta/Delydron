const db = require('../db');

// Append-only trail of who dispatched/aborted/reconfigured what, plus
// system-triggered safety events (low-battery diversion, auto-maintenance
// flag) with a null actor. Never blocks or throws into the caller — losing
// one audit row is much cheaper than failing the dispatch/abort itself.
async function log({ actorUserId, actorEmail, action, entityType, entityId, detail }) {
  try {
    await db.query(
      `INSERT INTO audit_log (actor_user_id, actor_email, action, entity_type, entity_id, detail)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        actorUserId || null,
        actorEmail || null,
        action,
        entityType,
        entityId || null,
        detail ? JSON.stringify(detail) : null,
      ]
    );
  } catch (err) {
    console.error('[auditService] failed to write entry:', err.message);
  }
}

async function list({ limit = 200, entityType, entityId } = {}) {
  const clauses = [];
  const values = [];
  let i = 1;

  if (entityType) {
    clauses.push(`entity_type = $${i++}`);
    values.push(entityType);
  }
  if (entityId) {
    clauses.push(`entity_id = $${i++}`);
    values.push(entityId);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  values.push(limit);
  const { rows } = await db.query(
    `SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT $${i}`,
    values
  );
  return rows;
}

module.exports = { log, list };
