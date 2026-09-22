import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { PublicTracking } from '../../types';

const DEFAULT_CENTER: [number, number] = [-33.4489, -70.6693];

function droneIconHtml(headingDeg: number) {
  return `
    <div style="transform: rotate(${headingDeg}deg); width:28px; height:28px; display:flex; align-items:center; justify-content:center;">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="#2563eb" stroke="white" stroke-width="1.5">
        <path d="M12 2 L19 21 L12 17 L5 21 Z" />
      </svg>
    </div>
  `;
}

function destinationIconHtml(delivered: boolean) {
  const color = delivered ? '#16a34a' : '#0f172a';
  return `<div style="width:20px;height:20px;border-radius:50%;background:${color};color:white;
    display:flex;align-items:center;justify-content:center;font:700 11px sans-serif;
    border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4);">${delivered ? '&#10003;' : ''}</div>`;
}

function makeDroneIcon(headingDeg: number) {
  return L.divIcon({ className: '', html: droneIconHtml(headingDeg), iconSize: [28, 28], iconAnchor: [14, 14] });
}

// Read-only, single-mission map for the public tracking page — deliberately
// not LiveMap: that component is built around a whole fleet's live SSE
// state, this only ever has one drone (or none) and refreshes from a plain
// poll, so reusing it would mean threading fake fleet state through it.
interface TrackingMiniMapProps {
  tracking: PublicTracking;
}

export function TrackingMiniMap({ tracking }: TrackingMiniMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const droneMarkerRef = useRef<L.Marker | null>(null);
  const destMarkersRef = useRef<L.Marker[]>([]);
  const routeLineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const center = tracking.live
      ? ([tracking.live.lat, tracking.live.lon] as [number, number])
      : tracking.waypoints[0]
        ? ([tracking.waypoints[0].lat, tracking.waypoints[0].lon] as [number, number])
        : DEFAULT_CENTER;

    const map = L.map(containerRef.current, { zoomControl: false }).setView(center, 14);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://api.maptiler.com/maps/streets-v4/{z}/{x}/{y}.png?key=zy6sHDBhSRsVvSPe3MCL', {
      attribution:
        '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      droneMarkerRef.current = null;
      destMarkersRef.current = [];
      routeLineRef.current = null;
    };
    // Only ever mounts once per page load — the token (and so the initial
    // center) doesn't change without a full navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const deliveredSeqs = new Set(tracking.deliveries.map((d) => d.waypointSeq));

    for (const marker of destMarkersRef.current) marker.remove();
    destMarkersRef.current = tracking.waypoints.map((wp) => {
      const delivered = deliveredSeqs.has(wp.seq);
      const marker = L.marker([wp.lat, wp.lon], {
        icon: L.divIcon({
          className: '',
          html: destinationIconHtml(delivered),
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      }).addTo(map);
      marker.bindTooltip(wp.packageDesc || `Destino #${wp.seq}`);
      return marker;
    });

    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }
    if (tracking.waypoints.length > 1) {
      routeLineRef.current = L.polyline(
        tracking.waypoints.map((wp): [number, number] => [wp.lat, wp.lon]),
        { color: '#94a3b8', weight: 3, dashArray: '6 6' }
      ).addTo(map);
    }

    if (tracking.live) {
      const pos: [number, number] = [tracking.live.lat, tracking.live.lon];
      if (!droneMarkerRef.current) {
        droneMarkerRef.current = L.marker(pos, { icon: makeDroneIcon(tracking.live.headingDeg) }).addTo(map);
      } else {
        droneMarkerRef.current.setLatLng(pos);
        droneMarkerRef.current.setIcon(makeDroneIcon(tracking.live.headingDeg));
      }
      map.panTo(pos);
    } else if (droneMarkerRef.current) {
      droneMarkerRef.current.remove();
      droneMarkerRef.current = null;
    }
  }, [tracking]);

  return <div ref={containerRef} className="h-64 w-full" />;
}
