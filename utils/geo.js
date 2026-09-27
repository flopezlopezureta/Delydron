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

function fromLocalXY(xy, origin) {
  const mpd = metersPerDegree(origin.lat);
  return {
    lat: origin.lat + xy.y / mpd.lat,
    lon: origin.lon + xy.x / mpd.lon,
  };
}

// The two points on circle(center, R) where a straight line from `p` is
// tangent to it, all in the same local xy frame. Null when `p` is inside
// (or on) the circle: there is no external tangent to compute.
function tangentPointsLocal(p, center, R) {
  const dx = center.x - p.x;
  const dy = center.y - p.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d <= R) return null;

  const L = Math.sqrt(d * d - R * R); // tangent segment length
  const phi = Math.atan2(dy, dx); // bearing from p to the center
  const theta = Math.acos(L / d); // half-angle between line-to-center and each tangent

  return [
    { x: p.x + L * Math.cos(phi + theta), y: p.y + L * Math.sin(phi + theta) },
    { x: p.x + L * Math.cos(phi - theta), y: p.y + L * Math.sin(phi - theta) },
  ];
}

// Which side of line origin->dirPoint the point falls on (+/-), via the
// sign of the cross product — used to pair up "same side" tangent points
// below without relying on raw distance, which picks the wrong (crossed,
// straight-back-through-the-obstacle) pairing in near-symmetric cases.
function crossSign(origin, dirPoint, point) {
  return (dirPoint.x - origin.x) * (point.y - origin.y) - (dirPoint.y - origin.y) * (point.x - origin.x);
}

const MAX_ARC_STEP_RAD = toRad(8);

// A straight chord between two points on the same circle cuts inside it —
// that's fine for a small angular step (the sag is negligible) but not for
// the wide angle a near-head-on approach can need, so the arc between the
// two tangent points is walked in <=15° steps instead of connected directly.
// Returns only the IN-BETWEEN points (not angleA/angleB themselves), going
// whichever rotational direction is the shorter way between them.
function arcPointsLocal(center, R, angleA, angleB) {
  let delta = angleB - angleA;
  while (delta <= -Math.PI) delta += 2 * Math.PI;
  while (delta > Math.PI) delta -= 2 * Math.PI;

  const steps = Math.max(1, Math.ceil(Math.abs(delta) / MAX_ARC_STEP_RAD));
  const points = [];
  for (let i = 1; i < steps; i++) {
    const angle = angleA + (delta * i) / steps;
    points.push({ x: center.x + R * Math.cos(angle), y: center.y + R * Math.sin(angle) });
  }
  return points;
}

// Routes a→b around a single circular `zone` using tangent lines from each
// endpoint plus a short arc between them: touch the (margin-buffered)
// circle near `a`, follow its boundary around to the point touched near
// `b`, then cut straight to `b`. The tangent legs and each small arc step
// all stay outside the circle by construction (a chord across the whole
// arc in one go wouldn't — see arcPointsLocal). Everything is computed in
// one shared local xy frame (origin = a) so the two tangent points can be
// paired by which side of the direct a->b line they fall on: the
// matching-side pair goes around the obstacle, the crossed pair loops
// straight back through it. Returns null when `a` or `b` is inside the
// buffered circle — that's the caller's cue to fall back instead.
function detourAroundZone(a, b, zone, effectiveRadiusM) {
  const origin = a;
  const aXY = { x: 0, y: 0 };
  const bXY = toLocalXY(b, origin);
  const cXY = toLocalXY({ lat: zone.lat, lon: zone.lon }, origin);

  const tA = tangentPointsLocal(aXY, cXY, effectiveRadiusM);
  const tB = tangentPointsLocal(bXY, cXY, effectiveRadiusM);
  if (!tA || !tB) return null;

  const side = (pt) => {
    const s = crossSign(aXY, bXY, pt);
    return s === 0 ? 1 : Math.sign(s);
  };

  let best = null;
  for (const pA of tA) {
    for (const pB of tB) {
      if (side(pA) !== side(pB)) continue;
      const d = (pA.x - pB.x) ** 2 + (pA.y - pB.y) ** 2;
      if (!best || d < best.d) best = { pA, pB, d };
    }
  }
  // Some pair always matches sides (each set has one point per side), so
  // this is just a defensive fallback, not an expected path.
  if (!best) {
    const d0 = (tA[0].x - tB[0].x) ** 2 + (tA[0].y - tB[0].y) ** 2;
    best = { pA: tA[0], pB: tB[0], d: d0 };
  }

  const angleA = Math.atan2(best.pA.y - cXY.y, best.pA.x - cXY.x);
  const angleB = Math.atan2(best.pB.y - cXY.y, best.pB.x - cXY.x);
  const arc = arcPointsLocal(cXY, effectiveRadiusM, angleA, angleB);

  return [best.pA, ...arc, best.pB].map((p) => fromLocalXY(p, origin));
}

// Fallback for when a or b sits inside the buffered circle (so no tangent
// line can be drawn from it — see detourAroundZone) but still outside the
// zone's true radius: nudge that single point further out, radially away
// from the center, rather than giving up on this pass. Less clean than the
// tangent construction, but the caller's later verification + simplify
// pass still catches it if this alone isn't enough.
function pushOutsideZone(point, zone, effectiveRadiusM) {
  const center = { lat: zone.lat, lon: zone.lon };
  const p = toLocalXY(point, center); // `point`'s position relative to the center
  const dist = Math.sqrt(p.x * p.x + p.y * p.y) || 1;
  const scale = effectiveRadiusM / dist;
  // Same direction from the center that `point` was already in, just
  // rescaled out to sit exactly on the buffered boundary.
  return fromLocalXY({ x: p.x * scale, y: p.y * scale }, center);
}

// Removes via-points that turned out unnecessary once earlier ones were
// inserted — e.g. a detour computed against one zone can happen to already
// clear a second zone too, and without this the path would carry redundant
// extra stops instead of the plain couple of points actually needed.
function simplifyPath(points, zones, effectiveRadiusOf) {
  const result = [...points];
  let i = 0;
  while (i < result.length - 2) {
    const a = result[i];
    const c = result[i + 2];
    const clear = zones.every((z) => distanceToSegmentMeters(z, a, c) >= effectiveRadiusOf(z));
    if (clear) {
      result.splice(i + 1, 1);
    } else {
      i++;
    }
  }
  return result;
}

// Routes a straight hop from `from` to `to` around any active no-fly zone
// it would otherwise cut through, instead of just refusing the whole trip —
// used both to size up a mission's real (possibly longer) route before
// dispatch and to actually fly it. `zones` is whatever's currently active;
// each needs {lat, lon, radius_m}.
//
// Returns { points, blocked }: `points` always starts with `from` and ends
// with `to`, with any detour stops in between. `blocked` is only true when
// `from` or `to` itself sits inside a zone — nothing can route around a
// zone that contains the very point you're trying to reach, so the caller
// (missionService) is the one that turns that into a hard rejection.
function buildDetourPath(from, to, zones, marginM = 30) {
  if (!zones || !zones.length) return { points: [from, to], blocked: false };

  const effectiveRadiusOf = (z) => Number(z.radius_m) + marginM;

  for (const p of [from, to]) {
    for (const zone of zones) {
      if (haversineMeters(p, zone) < Number(zone.radius_m)) {
        return { points: [from, to], blocked: true, blockedZone: zone };
      }
    }
  }

  // Each zone blocking the ORIGINAL straight line gets exactly one detour
  // pass. Deliberately not "keep re-scanning every resulting sub-segment
  // until nothing's flagged" — a detour's own short arc chords sag a
  // little inside the buffered radius by construction (see arcPointsLocal),
  // which would otherwise look "still blocked" against that same zone and
  // trigger endless redundant re-detouring of a path that's already fine.
  const blockingZones = zones.filter((z) => distanceToSegmentMeters(z, from, to) < effectiveRadiusOf(z));

  let points = [from, to];
  for (const zone of blockingZones) {
    const er = effectiveRadiusOf(zone);
    const next = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const a = next[next.length - 1];
      const b = points[i];
      if (distanceToSegmentMeters(zone, a, b) < er) {
        const detour = detourAroundZone(a, b, zone, er);
        if (detour) {
          next.push(...detour, b);
        } else {
          // a itself is within the margin buffer (though outside the
          // zone's true radius, or it would have been rejected above) —
          // no tangent can be drawn from a point that's not outside the
          // reference circle, so just nudge it out to the buffer boundary.
          if (haversineMeters(a, zone) < er) next.push(pushOutsideZone(a, zone, er));
          next.push(b);
        }
      } else {
        next.push(b);
      }
    }
    points = next;
  }

  points = simplifyPath(points, zones, effectiveRadiusOf);

  const stillBlocked = points.some((p, i) => {
    if (i === 0) return false;
    return zones.some((z) => distanceToSegmentMeters(z, points[i - 1], p) < Number(z.radius_m));
  });
  if (stillBlocked) return { points: [from, to], blocked: false, unresolved: true };

  return { points, blocked: false };
}

module.exports = {
  haversineMeters,
  interpolateAlongPath,
  bearingDeg,
  distanceToSegmentMeters,
  buildDetourPath,
};
