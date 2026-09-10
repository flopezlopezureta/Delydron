import { useEffect, useMemo, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Drone, DroneStatus, TelemetryPayload } from '../../types';

interface LiveMapProps {
  drones: Drone[];
  telemetryByDrone: Record<string, TelemetryPayload>;
}

const DEFAULT_CENTER: [number, number] = [-33.4489, -70.6693];
const DEFAULT_ZOOM = 15;

function statusColor(status: DroneStatus | string) {
  switch (status) {
    case 'in_flight':
      return '#2563eb';
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

export function LiveMap({ drones, telemetryByDrone }: LiveMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});

  const droneById = useMemo(() => {
    const map: Record<string, Drone> = {};
    for (const d of drones) map[d.id] = d;
    return map;
  }, [drones]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
  }, []);

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
  // which is what makes the movement render smoothly.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

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
    }
  }, [telemetryByDrone, droneById]);

  return <div ref={containerRef} className="h-full w-full" />;
}
