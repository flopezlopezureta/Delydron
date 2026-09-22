// A drone has one discharge gate per cargo bay — 4 bays, so at most 4
// destinations (deliveries) per mission.
const MAX_DESTINATIONS_PER_MISSION = 4;

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

// Returns an error message string, or null if the waypoints are well-formed.
function validateWaypoints(waypoints) {
  if (waypoints === undefined) return null;
  if (!Array.isArray(waypoints)) return 'waypoints must be an array';
  if (waypoints.length > MAX_DESTINATIONS_PER_MISSION) {
    return `a mission allows at most ${MAX_DESTINATIONS_PER_MISSION} destinations`;
  }

  for (const [i, wp] of waypoints.entries()) {
    if (!wp || typeof wp !== 'object') return `waypoint[${i}] must be an object`;
    if (!isFiniteNumber(wp.seq)) return `waypoint[${i}].seq must be a number`;
    if (!isFiniteNumber(wp.lat) || wp.lat < -90 || wp.lat > 90) {
      return `waypoint[${i}].lat must be between -90 and 90`;
    }
    if (!isFiniteNumber(wp.lon) || wp.lon < -180 || wp.lon > 180) {
      return `waypoint[${i}].lon must be between -180 and 180`;
    }
    if (wp.alt_m !== undefined && (!isFiniteNumber(wp.alt_m) || wp.alt_m < 0)) {
      return `waypoint[${i}].alt_m must be a non-negative number`;
    }
  }
  return null;
}

// Mirrors the missions_abort_reason_code_check constraint in schema.sql —
// kept as one source of truth in JS so the API can reject a bad code with a
// clean 400 instead of a raw Postgres constraint-violation 500.
const ABORT_REASON_CODES = [
  'operator_abort',
  'emergency_stop',
  'return_to_home_manual',
  'low_battery_diversion',
  'battery_depleted',
  'hardware_fault',
  'payload_fault',
  'weather',
  'airspace_conflict',
  'other',
];

// Returns an error message string, or null if the code is missing or valid
// (missing is fine — callers default it, e.g. to 'operator_abort').
function validateReasonCode(code) {
  if (code === undefined || code === null || code === '') return null;
  if (!ABORT_REASON_CODES.includes(code)) return 'invalid_reason_code';
  return null;
}

module.exports = { validateWaypoints, MAX_DESTINATIONS_PER_MISSION, ABORT_REASON_CODES, validateReasonCode };
