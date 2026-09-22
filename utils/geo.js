const EARTH_RADIUS_M = 6371000;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function toDeg(rad) {
  return (rad * 180) / Math.PI;
}

// Great-circle distance between two {lat, lon} points, in meters.
function haversineMeters(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Point a `fraction` (0..1) of the way from a to b, along a straight line
// in lat/lon space. Good enough for short delivery-range hops.
function interpolateAlongPath(a, b, fraction) {
  const f = Math.max(0, Math.min(1, fraction));
  return {
    lat: a.lat + (b.lat - a.lat) * f,
    lon: a.lon + (b.lon - a.lon) * f,
  };
}

// Compass bearing (0-360, 0 = north) from a to b.
function bearingDeg(a, b) {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLon = toRad(b.lon - a.lon);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Planar meters-per-degree at a given latitude — accurate enough for the
// short urban legs a delivery route flies (a few to a few dozen km), and
// far simpler than proper great-circle segment geometry for what's really
// just "is this leg near that point".
function metersPerDegree(lat) {
  const latRad = toRad(lat);
  return { lat: 111320, lon: 111320 * Math.cos(latRad) };
}

function toLocalXY(point, origin) {
  const mpd = metersPerDegree(origin.lat);
  return {
    x: (point.lon - origin.lon) * mpd.lon,
    y: (point.lat - origin.lat) * mpd.lat,
  };
}

// Shortest distance, in meters, from `point` to the line segment
// segStart->segEnd — used to check whether a flight leg passes through a
// no-fly zone's circle, not just whether its endpoints happen to land
// inside it.
function distanceToSegmentMeters(point, segStart, segEnd) {
  const origin = segStart;
  const p = toLocalXY(point, origin);
  const b = toLocalXY(segEnd, origin);

  const lengthSq = b.x * b.x + b.y * b.y;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, (p.x * b.x + p.y * b.y) / lengthSq));
  const closest = { x: t * b.x, y: t * b.y };

  const dx = p.x - closest.x;
  const dy = p.y - closest.y;
  return Math.sqrt(dx * dx + dy * dy);
}

module.exports = { haversineMeters, interpolateAlongPath, bearingDeg, distanceToSegmentMeters };
