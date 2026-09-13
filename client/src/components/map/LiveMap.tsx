import { useEffect, useMemo, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Base, Delivery, Drone, DroneStatus, Mission, TelemetryPayload, Waypoint } from '../../types';

interface LiveMapProps {
  drones: Drone[];
  bases: Base[];
  missions: Mission[];
  deliveries: Delivery[];
  telemetryByDrone: Record<string, TelemetryPayload>;
}

function baseIconHtml() {
  return `<div style="width:22px;height:22px;border-radius:5px;background:#0f172a;color:white;
    display:flex;align-items:center;justify-content:center;font:700 11px sans-serif;
    border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4);">B</div>`;
}

function makeBaseIcon() {
  return L.divIcon({ className: '', html: baseIconHtml(), iconSize: [22, 22], iconAnchor: [11, 11] });
}

const DEFAULT_CENTER: [number, number] = [-33.4489, -70.6693];
const DEFAULT_ZOOM = 15;
const MAX_ZOOM = 19; // matches the tile layer's own maxZoom — no point asking for more
const ACTIVE_FLIGHT_STATUSES: DroneStatus[] = ['in_flight', 'unloading', 'returning'];

function statusColor(status: DroneStatus | string) {
  switch (status) {
    case 'in_flight':
      return '#2563eb';
    case 'unloading':
      return '#0891b2';
    case 'returning':
      return '#7c3aed';
    case 'idle':
      return '#16a34a';
    case 'error':
      return '#dc2626';
    case 'charging':
      return '#d97706';
    default:
      return '#64748b';
  }
}

function droneIconHtml(headingDeg: number, color: string) {
  return `
    <div style="transform: rotate(${headingDeg}deg); width:28px; height:28px; display:flex; align-items:center; justify-content:center;">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5">
        <path d="M12 2 L19 21 L12 17 L5 21 Z" />
      </svg>
    </div>
  `;
}

function makeIcon(headingDeg: number, status: string) {
  return L.divIcon({
    className: '',
    html: droneIconHtml(headingDeg, statusColor(status)),
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

// Waypoints already reached — either before this page loaded (persisted
// current_waypoint_seq) or since (live DELIVERY events) — subtracted from
// the mission's full waypoint list to get what's still ahead.
function remainingWaypoints(mission: Mission, deliveries: Delivery[]): Waypoint[] {
  const deliveredSeqs = new Set<number>();
  for (const wp of mission.waypoints) {
    if (wp.seq <= mission.current_waypoint_seq) deliveredSeqs.add(wp.seq);
  }
  for (const d of deliveries) {
    if (d.mission_id === mission.id) deliveredSeqs.add(d.waypoint_seq);
  }
  return mission.waypoints.filter((wp) => !deliveredSeqs.has(wp.seq)).sort((a, b) => a.seq - b.seq);
}

function resolveReturnPoint(
  mission: Mission,
  drone: Drone | undefined,
  basesById: Record<string, Base>
): [number, number] | null {
  if (mission.return_base_id) {
    const base = basesById[mission.return_base_id];
    if (base) return [base.lat, base.lon];
  }
  if (drone) return [drone.home_lat, drone.home_lon];
  return null;
}

export function LiveMap({ drones, bases, missions, deliveries, telemetryByDrone }: LiveMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const baseMarkersRef = useRef<L.Marker[]>([]);
  const trailPointsRef = useRef<Record<string, [number, number][]>>({});
  const trailMissionRef = useRef<Record<string, string | null>>({});
  const trailLinesRef = useRef<Record<string, L.Polyline>>({});
  const remainingLinesRef = useRef<Record<string, L.Polyline>>({});

  const droneById = useMemo(() => {
    const map: Record<string, Drone> = {};
    for (const d of drones) map[d.id] = d;
    return map;
  }, [drones]);

  const missionById = useMemo(() => {
    const map: Record<string, Mission> = {};
    for (const m of missions) map[m.id] = m;
    return map;
  }, [missions]);

  const basesById = useMemo(() => {
    const map: Record<string, Base> = {};
    for (const b of bases) map[b.id] = b;
    return map;
  }, [bases]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // zoomControl:false + re-added at bottomleft — the summary bar and
    // telemetry HUD already own the top corners.
    const map = L.map(containerRef.current, { zoomControl: false }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    L.tileLayer('https://api.maptiler.com/maps/streets-v4/{z}/{x}/{y}.png?key=zy6sHDBhSRsVvSPe3MCL', {
      attribution: '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
      baseMarkersRef.current = [];
      trailLinesRef.current = {};
      remainingLinesRef.current = {};
    };
  }, []);

  // Bases are static reference points (dispatch depots), rebuilt in full
  // whenever the list changes rather than incrementally like drone telemetry.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const marker of baseMarkersRef.current) marker.remove();
    baseMarkersRef.current = bases.map((base) => {
      const marker = L.marker([base.lat, base.lon], { icon: makeBaseIcon() }).addTo(map);
      marker.bindTooltip(`${base.name}${base.address ? ` · ${base.address}` : ''}`);
      return marker;
    });
  }, [bases]);

  // Seed a marker from initial drone metadata (home position) so drones are
  // visible on the map even before the first telemetry tick arrives.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const drone of drones) {
      if (markersRef.current[drone.id]) continue;
      const lat = drone.lat ?? drone.home_lat;
      const lon = drone.lon ?? drone.home_lon;
      if (lat == null || lon == null) continue;

      const marker = L.marker([lat, lon], {
        icon: makeIcon(Number(drone.heading_deg) || 0, drone.status),
      }).addTo(map);
      marker.bindTooltip(drone.name);
      markersRef.current[drone.id] = marker;
    }
  }, [drones]);

  // Live position/heading/status updates from SSE telemetry — mutates
  // existing markers in place (setLatLng/setIcon) instead of remounting,
  // which is what makes the movement render smoothly. The same tick also
  // grows the flown-trail polyline and redraws the remaining-route polyline
  // (destinations still ahead, plus the eventual return leg).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Only auto-follow when exactly one drone is actually flying — with two
    // or more at once, whichever's telemetry arrived last would keep
    // yanking the view back and forth, which is worse than not following.
    const activeDroneIds = Object.entries(telemetryByDrone)
      .filter(([, t]) => ACTIVE_FLIGHT_STATUSES.includes(t.status))
      .map(([id]) => id);
    const soloActiveDroneId = activeDroneIds.length === 1 ? activeDroneIds[0] : null;

    for (const [droneId, telemetry] of Object.entries(telemetryByDrone)) {
      const label = droneById[droneId]?.name ?? droneId;
      let marker = markersRef.current[droneId];

      if (!marker) {
        marker = L.marker([telemetry.lat, telemetry.lon], {
          icon: makeIcon(telemetry.headingDeg, telemetry.status),
        }).addTo(map);
        marker.bindTooltip(label);
        markersRef.current[droneId] = marker;
      } else {
        marker.setLatLng([telemetry.lat, telemetry.lon]);
        marker.setIcon(makeIcon(telemetry.headingDeg, telemetry.status));
      }

      marker.setTooltipContent(`${label} · ${telemetry.status} · ${telemetry.batteryPct.toFixed(0)}%`);

      // Camera: keep the one active drone centered as it flies, and snap in
      // close the instant it reaches a leg (waypoint, return point, or a
      // manual recall) — same "arrived" flag the simulator itself acted on.
      if (droneId === soloActiveDroneId) {
        if (telemetry.arrived) {
          map.setView([telemetry.lat, telemetry.lon], MAX_ZOOM);
        } else {
          map.panTo([telemetry.lat, telemetry.lon]);
        }
      }

      // Flown trail: reset whenever the mission changes, then keep growing.
      if (trailMissionRef.current[droneId] !== telemetry.missionId) {
        trailMissionRef.current[droneId] = telemetry.missionId;
        trailPointsRef.current[droneId] = [];
      }
      const trail = trailPointsRef.current[droneId] ?? (trailPointsRef.current[droneId] = []);
      trail.push([telemetry.lat, telemetry.lon]);

      let trailLine = trailLinesRef.current[droneId];
      if (!trailLine) {
        trailLine = L.polyline(trail, { color: '#2563eb', weight: 3, opacity: 0.6 }).addTo(map);
        trailLinesRef.current[droneId] = trailLine;
      } else {
        trailLine.setLatLngs(trail);
      }

      // Remaining route: destinations not yet delivered, then the return
      // leg — only while actually flying a mission.
      const mission = telemetry.missionId ? missionById[telemetry.missionId] : undefined;
      const isActive = ACTIVE_FLIGHT_STATUSES.includes(telemetry.status);
      const remaining = mission && isActive ? remainingWaypoints(mission, deliveries) : [];
      const returnPoint = mission && isActive ? resolveReturnPoint(mission, droneById[droneId], basesById) : null;

      if (mission && isActive && (remaining.length > 0 || returnPoint)) {
        const points: [number, number][] = [
          [telemetry.lat, telemetry.lon],
          ...remaining.map((wp): [number, number] => [wp.lat, wp.lon]),
        ];
        if (returnPoint) points.push(returnPoint);

        let remainingLine = remainingLinesRef.current[droneId];
        if (!remainingLine) {
          remainingLine = L.polyline(points, {
            color: '#94a3b8',
            weight: 3,
            dashArray: '6 6',
          }).addTo(map);
          remainingLinesRef.current[droneId] = remainingLine;
        } else {
          remainingLine.setLatLngs(points);
        }
      } else if (remainingLinesRef.current[droneId]) {
        remainingLinesRef.current[droneId].remove();
        delete remainingLinesRef.current[droneId];
      }
    }
  }, [telemetryByDrone, droneById, missionById, basesById, deliveries]);

  return <div ref={containerRef} className="h-full w-full" />;
}
