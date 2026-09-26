const db = require('../db');

async function missionStatusBreakdown() {
  const { rows } = await db.query(`SELECT status, COUNT(*)::int AS count FROM missions GROUP BY status`);
  return rows;
}

async function abortReasonBreakdown() {
  const { rows } = await db.query(
    `SELECT abort_reason_code, COUNT(*)::int AS count
     FROM missions
     WHERE abort_reason_code IS NOT NULL
     GROUP BY abort_reason_code
     ORDER BY count DESC`
  );
  return rows;
}

// One row per drone, whether or not it's ever flown a mission (LEFT JOIN) —
// a drone with zero history is still worth showing, it just has all-zero
// counts, rather than silently disappearing from the report.
async function dronePerformance() {
  const { rows } = await db.query(
    `SELECT
       d.id,
       d.name,
       d.total_flight_seconds,
       d.maintenance_interval_hours,
       COUNT(m.id) FILTER (WHERE m.status = 'completed')::int AS completed,
       COUNT(m.id) FILTER (WHERE m.status = 'aborted')::int AS aborted,
       COUNT(m.id) FILTER (WHERE m.status = 'failed')::int AS failed,
       COUNT(m.id) FILTER (WHERE m.status IN ('completed', 'aborted', 'failed'))::int AS total_finished,
       AVG(EXTRACT(EPOCH FROM (m.completed_at - m.started_at))) FILTER (WHERE m.status = 'completed') AS avg_flight_seconds
     FROM drones d
     LEFT JOIN missions m ON m.drone_id = d.id
     GROUP BY d.id, d.name, d.total_flight_seconds, d.maintenance_interval_hours
     ORDER BY d.name`
  );
  return rows;
}

async function deliveriesTotal() {
  const { rows } = await db.query('SELECT COUNT(*)::int AS count FROM deliveries');
  return rows[0].count;
}

module.exports = { missionStatusBreakdown, abortReasonBreakdown, dronePerformance, deliveriesTotal };
