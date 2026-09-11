const db = require('../db');
const { publishMissionStatus } = require('./telemetryBus');

async function getById(id) {
  const { rows } = await db.query('SELECT * FROM missions WHERE id = $1', [id]);
  return rows[0] || null;
}

// Only 'in_progress' missions were actually flying when the server went
// down — 'assigned' just means a drone is picked but nobody has clicked
// Dispatch yet, so it must NOT be auto-started on boot.
async function getInProgress() {
  const { rows } = await db.query(
    `SELECT * FROM missions WHERE status = 'in_progress' ORDER BY created_at`
  );
  return rows;
}

async function list({ status, droneId } = {}) {
  const clauses = [];
  const values = [];
  let i = 1;

  if (status) {
    clauses.push(`status = $${i++}`);
    values.push(status);
  }
  if (droneId) {
    clauses.push(`drone_id = $${i++}`);
    values.push(droneId);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await db.query(
    `SELECT * FROM missions ${where} ORDER BY created_at DESC`,
    values
  );
  return rows;
}

async function nextMissionCode() {
  const { rows } = await db.query(`SELECT nextval('mission_code_seq') AS n`);
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seqPart = String(rows[0].n).padStart(4, '0');
  return `MSN-${datePart}-${seqPart}`;
}

async function create({
  droneId,
  createdBy,
  priority,
  waypoints,
  payloadDesc,
  pickupBaseId,
  pickupAddress,
  dropoffAddress,
  notes,
}) {
  const code = await nextMissionCode();
  const status = droneId ? 'assigned' : 'draft';

  const { rows } = await db.query(
    `INSERT INTO missions (
       code, drone_id, created_by, status, priority, waypoints,
       payload_desc, pickup_base_id, pickup_address, dropoff_address, notes
     )
     VALUES ($1, $2, $3, $4, COALESCE($5, 3), COALESCE($6, '[]'::jsonb), $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      code,
      droneId || null,
      createdBy || null,
      status,
      priority,
      waypoints ? JSON.stringify(waypoints) : null,
      payloadDesc || null,
      pickupBaseId || null,
      pickupAddress || null,
      dropoffAddress || null,
      notes || null,
    ]
  );
  return rows[0];
}

async function update(id, fields) {
  const allowed = {
    drone_id: fields.droneId,
    priority: fields.priority,
    waypoints: fields.waypoints ? JSON.stringify(fields.waypoints) : undefined,
    payload_desc: fields.payloadDesc,
    pickup_base_id: fields.pickupBaseId,
    pickup_address: fields.pickupAddress,
    dropoff_address: fields.dropoffAddress,
    notes: fields.notes,
  };

  const sets = [];
  const values = [];
  let i = 1;
  for (const [column, value] of Object.entries(allowed)) {
    if (value !== undefined) {
      sets.push(`${column} = $${i++}`);
      values.push(value);
    }
  }
  if (!sets.length) return getById(id);

  // Assigning a drone to a still-draft mission also moves it to 'assigned'.
  if (allowed.drone_id !== undefined) {
    sets.push(`status = CASE WHEN status = 'draft' AND $${i} IS NOT NULL THEN 'assigned' ELSE status END`);
    values.push(allowed.drone_id);
    i++;
  }

  values.push(id);
  const { rows } = await db.query(
    `UPDATE missions SET ${sets.join(', ')}, updated_at = now() WHERE id = $${i} RETURNING *`,
    values
  );
  return rows[0] || null;
}

async function remove(id) {
  await db.query(`DELETE FROM missions WHERE id = $1 AND status = 'draft'`, [id]);
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

module.exports = {
  getById,
  getInProgress,
  updateCurrentWaypoint,
  updateStatus,
  list,
  create,
  update,
  remove,
};
