const db = require('../db');
const { publishMissionStatus } = require('./telemetryBus');

// Phase 2 scope only: enough to let the simulated adapter fly seeded
// missions and report status. Full CRUD/dispatch lands in Phase 3.

async function getById(id) {
  const { rows } = await db.query('SELECT * FROM missions WHERE id = $1', [id]);
  return rows[0] || null;
}

async function getAssignedOrInProgress() {
  const { rows } = await db.query(
    `SELECT * FROM missions WHERE status IN ('assigned', 'in_progress') ORDER BY created_at`
  );
  return rows;
}

async function updateCurrentWaypoint(id, seq) {
  await db.query(
    `UPDATE missions SET current_waypoint_seq = $2, updated_at = now() WHERE id = $1`,
    [id, seq]
  );
}

async function updateStatus(id, status, { notes } = {}) {
  const setStarted = status === 'in_progress';
  const setCompleted = ['completed', 'failed', 'aborted'].includes(status);

  const { rows } = await db.query(
    `UPDATE missions
     SET status = $2,
         notes = COALESCE($3, notes),
         started_at = CASE WHEN $4 THEN now() ELSE started_at END,
         completed_at = CASE WHEN $5 THEN now() ELSE completed_at END,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, status, notes || null, setStarted, setCompleted]
  );

  const mission = rows[0] || null;
  if (mission) {
    publishMissionStatus({ missionId: mission.id, droneId: mission.drone_id, status: mission.status });
  }
  return mission;
}

module.exports = { getById, getAssignedOrInProgress, updateCurrentWaypoint, updateStatus };
