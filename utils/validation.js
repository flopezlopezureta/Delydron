function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

// Returns an error message string, or null if the waypoints are well-formed.
function validateWaypoints(waypoints) {
  if (waypoints === undefined) return null;
  if (!Array.isArray(waypoints)) return 'waypoints must be an array';

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

module.exports = { validateWaypoints };
