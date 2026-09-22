import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import type { NoFlyZone, Waypoint } from '../../types';

interface WaypointPlannerMapProps {
  center: [number, number];
  waypoints: Waypoint[];
  noFlyZones?: NoFlyZone[];
  onAddWaypoint: (lat: number, lon: number) => void;
  onMoveWaypoint: (index: number, lat: number, lon: number) => void;
}

function numberedIcon(n: number) {
  return L.divIcon({
    className: '',
    html: `<div style="width:24px;height:24px;border-radius:9999px;background:#2563eb;color:white;
      display:flex;align-items:center;justify-content:center;font:600 12px sans-serif;
      border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4);">${n}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

// Click-to-add waypoint editor: no drawing-toolbar plugin, just a plain map
// click handler plus draggable numbered markers — simpler to reason about
// than leaflet-draw's shape-editing UX for what is really just an ordered
// list of points.
export function WaypointPlannerMap({
  center,
  waypoints,
  noFlyZones = [],
  onAddWaypoint,
  onMoveWaypoint,
}: WaypointPlannerMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const lineRef = useRef<L.Polyline | null>(null);
  const zoneCirclesRef = useRef<L.Circle[]>([]);
  const onAddRef = useRef(onAddWaypoint);
  const onMoveRef = useRef(onMoveWaypoint);

  onAddRef.current = onAddWaypoint;
  onMoveRef.current = onMoveWaypoint;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView(center, 15);
    L.tileLayer('https://api.maptiler.com/maps/streets-v4/{z}/{x}/{y}.png?key=zy6sHDBhSRsVvSPe3MCL', {
      attribution: '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      onAddRef.current(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = [];
      lineRef.current = null;
      zoneCirclesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restricted zones are reference context, not something drawn on top of
  // the route drag-and-drop — a plain redraw whenever the list changes is
  // enough, no incremental updates needed.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const circle of zoneCirclesRef.current) circle.remove();
    zoneCirclesRef.current = noFlyZones
      .filter((z) => z.active)
      .map((z) => {
        const circle = L.circle([z.lat, z.lon], {
          radius: Number(z.radius_m),
          color: '#dc2626',
          weight: 2,
          fillColor: '#dc2626',
          fillOpacity: 0.12,
        }).addTo(map);
        circle.bindTooltip(`Zona restringida: ${z.name}`);
        return circle;
      });
  }, [noFlyZones]);

  // Redraw markers + connecting line whenever the waypoint list changes.
  // Small, infrequently-edited list, so a full rebuild each time is simpler
  // than the incremental setLatLng() approach the live telemetry map uses.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const marker of markersRef.current) marker.remove();
    markersRef.current = [];
    if (lineRef.current) {
      lineRef.current.remove();
      lineRef.current = null;
    }

    waypoints.forEach((wp, index) => {
      const marker = L.marker([wp.lat, wp.lon], { icon: numberedIcon(wp.seq), draggable: true }).addTo(map);
      marker.bindTooltip(wp.address || `${wp.lat.toFixed(5)}, ${wp.lon.toFixed(5)}`);
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onMoveRef.current(index, pos.lat, pos.lng);
      });
      markersRef.current.push(marker);
    });

    if (waypoints.length > 1) {
      lineRef.current = L.polyline(
        waypoints.map((wp) => [wp.lat, wp.lon] as [number, number]),
        { color: '#2563eb', weight: 3, dashArray: '6 6' }
      ).addTo(map);
    }

    // Keeps every destination in view — matters most for one added via
    // address search, which could otherwise land far outside the current
    // viewport with no visual sign it worked.
    if (waypoints.length > 0) {
      map.fitBounds(
        L.latLngBounds(waypoints.map((wp) => [wp.lat, wp.lon] as [number, number])),
        { padding: [60, 60], maxZoom: 17 }
      );
    }
  }, [waypoints]);

  return <div ref={containerRef} className="h-full w-full" />;
}
