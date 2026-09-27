const crypto = require('crypto');
const db = require('../db');
const { publishMissionStatus } = require('./telemetryBus');
const { haversineMeters, buildDetourPath } = require('../utils/geo');
const settingsService = require('./settingsService');
const baseService = require('./baseService');
const noFlyZoneService = require('./noFlyZoneService');
const weatherService = require('./weatherService');

// Extra clearance a planned route keeps beyond a zone's own configured
// radius when routing around it — see utils/geo.js#buildDetourPath. Not
// operator-facing (unlike the zone radius itself): this is routing
// conservatism, not a property of any one zone.
const NO_FLY_ZONE_MARGIN_M = 30;

// Every waypoint (destination) gets its own stable, unguessable token —
// "Punto de Entrega" (PE), distinct from a base and from the mission-wide
// tracking link: a multi-stop mission can carry several different
// customers' packages, and sharing the whole mission's link with all of
// them would leak every recipient's address to everyone else. Existing
// tokens are kept as-is across edits, since one may already be shared.
function ensurePeTokens(waypoints) {
  return (waypoints || []).map((wp) => ({
    ...wp,
    peToken: wp.peToken || crypto.randomBytes(20).toString('hex'),
  }));
}

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

// ETA to whichever point the drone is currently heading toward — the next
// undelivered destination, or the return point once all of them are done.
// Uses the drone's rated speed rather than its instantaneous current speed
// (which reads 0 mid-arrival or mid-discharge) — same "nominal speed"
// convention SimulatedAdapter's own live telemetry ETA already uses, so the
// public tracking page and the internal live map never disagree.
async function estimateEtaSeconds(mission, drone) {
  if (drone.lat == null || drone.lon == null) return null;
  const current = { lat: drone.lat, lon: drone.lon };

  const waypoints = [...(mission.waypoints || [])].sort((a, b) => a.seq - b.seq);
  const next = waypoints.find((wp) => wp.seq > mission.current_waypoint_seq);

  let target = { lat: drone.home_lat, lon: drone.home_lon };
  if (next) {
    target = { lat: next.lat, lon: next.lon };
  } else if (mission.return_base_id) {
    const base = await baseService.getById(mission.return_base_id);
    if (base) target = { lat: base.lat, lon: base.lon };
  }

  const speedMps = Number(drone.max_speed_mps) || 12;
  if (speedMps <= 0) return null;
  return Math.round(haversineMeters(current, target) / speedMps);
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
      waypoints ? JSON.stringify(ensurePeTokens(waypoints)) : null,
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
    waypoints: fields.waypoints ? JSON.stringify(ensurePeTokens(fields.waypoints)) : undefined,
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

// Every stop the mission's route touches, in order: the drone's current
// position, an optional pickup base, each destination, then the return
// point — the same stops SimulatedAdapter flies between.
async function resolveRoutePoints(mission, drone) {
  const points = [{ lat: drone.lat ?? drone.home_lat, lon: drone.lon ?? drone.home_lon }];

  if (mission.pickup_base_id) {
    const base = await baseService.getById(mission.pickup_base_id);
    if (base) points.push({ lat: base.lat, lon: base.lon });
  }

  const waypoints = [...(mission.waypoints || [])].sort((a, b) => a.seq - b.seq);
  for (const wp of waypoints) points.push({ lat: wp.lat, lon: wp.lon });

  let returnPoint = { lat: drone.home_lat, lon: drone.home_lon };
  if (mission.return_base_id) {
    const base = await baseService.getById(mission.return_base_id);
    if (base) returnPoint = { lat: base.lat, lon: base.lon };
  }
  points.push(returnPoint);

  return points;
}

// Every leg of the route the mission will actually fly, in order — each
// hop between consecutive stops expanded to route around any active
// no-fly zone it would otherwise cut through (see
// utils/geo.js#buildDetourPath) instead of just refusing the mission.
// Shared by the range/battery check below and by SimulatedAdapter's actual
// flight, so both agree on what "the route" means. `blockedReason` is set
// only when some stop is unreachable outright — it sits inside a zone
// itself, so there's nothing to route around.
async function resolveRouteLegs(mission, drone) {
  const points = await resolveRoutePoints(mission, drone);
  const zones = await noFlyZoneService.listActive();

  const expanded = [points[0]];
  let blockedReason = null;
  for (let i = 1; i < points.length && !blockedReason; i++) {
    const from = expanded[expanded.length - 1];
    const to = points[i];
    const { points: legPoints, blocked, blockedZone, unresolved } = buildDetourPath(
      from,
      to,
      zones,
      NO_FLY_ZONE_MARGIN_M
    );
    if (blocked) {
      blockedReason = `Un punto de la ruta cae dentro de la zona restringida "${blockedZone.name}" (radio ${Number(blockedZone.radius_m).toFixed(0)} m) — no se puede evitar una zona que contiene el propio punto.`;
    } else if (unresolved) {
      blockedReason = 'No fue posible calcular una ruta que evite todas las zonas restringidas activas.';
    } else {
      expanded.push(...legPoints.slice(1));
    }
  }

  const legs = [];
  for (let i = 1; i < expanded.length; i++) legs.push([expanded[i - 1], expanded[i]]);
  return { legs, blockedReason };
}

// Create/update-time check — a drone isn't necessarily assigned yet at that
// point, so there's no route to plan a detour around, only the fixed
// destinations themselves. A leg merely passing near a zone is no longer
// blocked here: once a drone is dispatched, SimulatedAdapter (and the
// feasibility check below) route around that automatically. The one thing
// that truly can't be fixed by routing is a destination that sits inside a
// zone to begin with — nothing can reach it without entering the zone.
async function checkWaypointsAgainstNoFlyZones(waypoints) {
  const zones = await noFlyZoneService.listActive();
  if (!zones.length) return null;

  for (const wp of waypoints || []) {
    for (const zone of zones) {
      if (haversineMeters(wp, { lat: zone.lat, lon: zone.lon }) < Number(zone.radius_m)) {
        return `El destino #${wp.seq} está dentro de la zona restringida "${zone.name}" (radio ${Number(zone.radius_m).toFixed(0)} m) — no se puede evitar una zona que contiene el propio destino.`;
      }
    }
  }
  return null;
}

// Pre-dispatch safety gate: refuses to launch a mission whose planned route
// (after routing around any active no-fly zone in the way) exceeds the
// drone's rated range, exceeds what its current battery can cover while
// holding back the configured reserve, or simply can't avoid a zone at all.
// Returns null when clear, or a human-readable reason.
async function checkDispatchFeasible(mission, drone) {
  const { legs, blockedReason } = await resolveRouteLegs(mission, drone);
  if (blockedReason) return blockedReason;

  const routeM = legs.reduce((total, [a, b]) => total + haversineMeters(a, b), 0);

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

  // Checked at the drone's current position (its takeoff point), not
  // averaged across the whole route — weather is time-varying, so this is
  // a go/no-go read at the moment of launch, not something worth checking
  // back at mission-creation time the way the range/geofence checks are.
  return weatherService.checkWeatherFeasible(drone.lat ?? drone.home_lat, drone.lon ?? drone.home_lon);
}

// Finds the mission and the specific waypoint carrying this PE token — the
// @> containment operator matches a JSONB array with at least one element
// that has this key/value, which is exactly "does any destination in this
// mission have this token" without a separate table per destination.
async function getByPeToken(peToken) {
  const { rows } = await db.query(`SELECT * FROM missions WHERE waypoints @> $1::jsonb LIMIT 1`, [
    JSON.stringify([{ peToken }]),
  ]);
  const mission = rows[0];
  if (!mission) return null;
  const waypoint = (mission.waypoints || []).find((wp) => wp.peToken === peToken);
  if (!waypoint) return null;
  return { mission, waypoint };
}

// Lets the customer nudge their own delivery point within a small radius of
// where the operator originally placed it — mirrors how real operators
// (Wing) have the recipient pick the exact spot on their property instead
// of trusting a geocoded address to land exactly right. Bounded so the
// link can't relocate a destination somewhere unrelated, and locked once
// the mission leaves draft/scheduled/assigned (already dispatched or done).
async function confirmDeliveryPoint(peToken, lat, lon) {
  const found = await getByPeToken(peToken);
  if (!found) return { error: 'not_found' };
  const { mission, waypoint } = found;

  if (!['draft', 'scheduled', 'assigned'].includes(mission.status)) {
    return { error: 'mission_not_editable' };
  }

  const maxAdjustM = settingsService.getSync('pe_max_adjust_m');
  // Anchored to where the point stood the first time it was ever confirmed
  // (frozen below), not to the live lat/lon this same function overwrites
  // on every call — otherwise repeated small nudges could walk arbitrarily
  // far from the operator's original placement, one maxAdjustM hop at a time.
  const anchor =
    waypoint.anchorLat != null
      ? { lat: waypoint.anchorLat, lon: waypoint.anchorLon }
      : { lat: waypoint.lat, lon: waypoint.lon };
  const distance = haversineMeters(anchor, { lat, lon });
  if (distance > maxAdjustM) {
    return { error: 'out_of_range', maxAdjustM };
  }

  const updatedWaypoints = mission.waypoints.map((wp) =>
    wp.peToken === peToken
      ? { ...wp, lat, lon, anchorLat: anchor.lat, anchorLon: anchor.lon, confirmedAt: new Date().toISOString() }
      : wp
  );

  const zoneReason = await checkWaypointsAgainstNoFlyZones(updatedWaypoints);
  if (zoneReason) return { error: 'route_restricted', message: zoneReason };

  const { rows } = await db.query(
    `UPDATE missions SET waypoints = $2::jsonb, updated_at = now() WHERE id = $1 RETURNING *`,
    [mission.id, JSON.stringify(updatedWaypoints)]
  );
  return { mission: rows[0] };
}

module.exports = {
  getById,
  getByTrackingToken,
  getByPeToken,
  confirmDeliveryPoint,
  estimateEtaSeconds,
  getInProgress,
  existsForBase,
  updateCurrentWaypoint,
  updateStatus,
  checkDispatchFeasible,
  checkWaypointsAgainstNoFlyZones,
  NO_FLY_ZONE_MARGIN_M,
  list,
  create,
  update,
  remove,
};
