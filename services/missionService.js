const db = require('../db');
const { publishMissionStatus } = require('./telemetryBus');
const { haversineMeters } = require('../utils/geo');
const settingsService = require('./settingsService');
const baseService = require('./baseService');

async function getById(id) {
  const { rows } = await db.query('SELECT * FROM missions WHERE id = $1', [id]);
  return rows[0] || null;
}

// Powers the public tracking page (routes/track.js) — the token is random
// and unrelated to the sequential id, so knowing one mission's link doesn't
// help guess another's.
async function getByTrackingToken(token) {
  const { rows } = await db.query('SELECT * FROM missions WHERE tracking_token = $1', [token]);
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

// Blocks deleting a base a mission still depends on. Terminal missions are
// excluded — those are just history at that point, and letting the FK's
// ON DELETE SET NULL clear the reference there is fine.
async function existsForBase(baseId) {
  const { rows } = await db.query(
    `SELECT 1 FROM missions
     WHERE (pickup_base_id = $1 OR return_base_id = $1)
       AND status NOT IN ('completed', 'aborted', 'failed')
     LIMIT 1`,
    [baseId]
  );
  return rows.length > 0;
}

async function list({ status, droneId } = {}) {
  const clauses = [];
  const values = [];
  let i = 1;

  if (status) {
    // Comma-separated for grouped filters like "draft,scheduled,assigned".
    const statuses = status.split(',').map((s) => s.trim()).filter(Boolean);
    if (statuses.length === 1) {
      clauses.push(`status = $${i++}`);
      values.push(statuses[0]);
    } else if (statuses.length > 1) {
      clauses.push(`status = ANY($${i++})`);
      values.push(statuses);
    }
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
  returnBaseId,
  notes,
}) {
  const code = await nextMissionCode();
  const status = droneId ? 'assigned' : 'draft';

  const { rows } = await db.query(
    `INSERT INTO missions (
       code, drone_id, created_by, status, priority, waypoints,
       payload_desc, pickup_base_id, pickup_address, dropoff_address,
       return_base_id, notes
     )
     VALUES ($1, $2, $3, $4, COALESCE($5, 3), COALESCE($6, '[]'::jsonb), $7, $8, $9, $10, $11, $12)
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
      returnBaseId || null,
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
    return_base_id: fields.returnBaseId,
    notes: fields.notes,
  };

  const sets = [];
  const values = [];
  let i = 1;
  let droneIdParam = null;
  for (const [column, value] of Object.entries(allowed)) {
    if (value !== undefined) {
      sets.push(`${column} = $${i}`);
      values.push(value);
      if (column === 'drone_id') droneIdParam = i;
      i++;
    }
  }
  if (!sets.length) return getById(id);

  // Assigning a drone to a still-draft mission also moves it to 'assigned'.
  // Reuses the same $N bound above for drone_id rather than a second
  // parameter, but that alone isn't enough: when drone_id is the *only*
  // field being set, "$N IS NOT NULL" is the sole other place $N appears,
  // and on its own that gives Postgres no type to infer (fails with 42P08,
  // "could not determine data type of parameter"). The explicit ::uuid
  // cast pins it down regardless of what else is in the SET list.
  if (droneIdParam !== null) {
    sets.push(
      `status = CASE WHEN status = 'draft' AND $${droneIdParam}::uuid IS NOT NULL THEN 'assigned' ELSE status END`
    );
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

async function updateStatus(id, status, { notes, reasonCode } = {}) {
  const setStarted = status === 'in_progress';
  const setCompleted = ['completed', 'failed', 'aborted'].includes(status);

  const { rows } = await db.query(
    `UPDATE missions
     SET status = $2,
         notes = COALESCE($3, notes),
         abort_reason_code = COALESCE($6, abort_reason_code),
         started_at = CASE WHEN $4 THEN now() ELSE started_at END,
         completed_at = CASE WHEN $5 THEN now() ELSE completed_at END,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, status, notes || null, setStarted, setCompleted, reasonCode || null]
  );

  const mission = rows[0] || null;
  if (mission) {
    publishMissionStatus({ missionId: mission.id, droneId: mission.drone_id, status: mission.status });
  }
  return mission;
}

// Round-trip distance the mission would actually fly: an optional pickup
// leg, then each destination in order, then the return leg — the same path
// SimulatedAdapter flies, computed ahead of dispatch so a route the battery
// can't realistically finish never leaves the ground.
async function plannedRouteMeters(mission, drone) {
  const start = { lat: drone.lat ?? drone.home_lat, lon: drone.lon ?? drone.home_lon };
  let from = start;
  let total = 0;

  if (mission.pickup_base_id) {
    const base = await baseService.getById(mission.pickup_base_id);
    if (base) {
      total += haversineMeters(from, base);
      from = { lat: base.lat, lon: base.lon };
    }
  }

  const waypoints = [...(mission.waypoints || [])].sort((a, b) => a.seq - b.seq);
  for (const wp of waypoints) {
    total += haversineMeters(from, wp);
    from = wp;
  }

  let returnPoint = { lat: drone.home_lat, lon: drone.home_lon };
  if (mission.return_base_id) {
    const base = await baseService.getById(mission.return_base_id);
    if (base) returnPoint = { lat: base.lat, lon: base.lon };
  }
  total += haversineMeters(from, returnPoint);

  return total;
}

// Pre-dispatch safety gate: refuses to launch a mission whose planned round
// trip exceeds either the drone's rated range or what its current battery
// can cover while still holding back the configured reserve. Returns null
// when the route is feasible, or a human-readable reason when it isn't.
async function checkDispatchFeasible(mission, drone) {
  const routeM = await plannedRouteMeters(mission, drone);
  const maxRangeM = Number(drone.max_range_km) * 1000;
  if (routeM > maxRangeM) {
    return `La ruta planificada (${(routeM / 1000).toFixed(1)} km) supera la autonomía máxima del dron (${Number(drone.max_range_km).toFixed(1)} km).`;
  }

  const reservePct = settingsService.getSync('low_battery_reserve_pct');
  const drainPctPerMin = settingsService.getSync('battery_drain_pct_per_min');
  const speedMps = Number(drone.max_speed_mps) || 12;
  const usableBatteryPct = Math.max(0, Number(drone.battery_pct) - reservePct);
  const availableM = (usableBatteryPct / drainPctPerMin) * 60 * speedMps;
  if (routeM > availableM) {
    return `La batería actual (${Number(drone.battery_pct).toFixed(0)}%) no alcanza para completar la ruta (${(routeM / 1000).toFixed(1)} km) y volver dejando ${reservePct}% de reserva.`;
  }

  return null;
}

module.exports = {
  getById,
  getByTrackingToken,
  getInProgress,
  existsForBase,
  updateCurrentWaypoint,
  updateStatus,
  checkDispatchFeasible,
  list,
  create,
  update,
  remove,
};
