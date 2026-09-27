import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { NoFlyZone } from '../../types';

const DEFAULT_CENTER: [number, number] = [-33.4489, -70.6693];

function circleStyle(zone: NoFlyZone, selected: boolean): L.CircleMarkerOptions {
  if (selected) {
    return { color: '#2563eb', weight: 3, fillColor: '#2563eb', fillOpacity: 0.25 };
  }
  return zone.active
    ? { color: '#dc2626', weight: 2, fillColor: '#dc2626', fillOpacity: 0.12 }
    : { color: '#94a3b8', weight: 1.5, fillColor: '#94a3b8', fillOpacity: 0.08, dashArray: '4 4' };
}

// Read-only overview of every zone at once (unlike NoFlyZonePickerMap, which
// only ever shows the single zone being placed/edited) — lets the operator
// pick a zone from the list and see exactly where and how big it is,
// instead of just reading raw lat/lon numbers in a table row.
interface NoFlyZonesOverviewMapProps {
  zones: NoFlyZone[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function NoFlyZonesOverviewMap({ zones, selectedId, onSelect }: NoFlyZonesOverviewMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const circlesRef = useRef<Record<string, L.Circle>>({});
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView(DEFAULT_CENTER, 12);
    L.tileLayer('https://api.maptiler.com/maps/streets-v4/{z}/{x}/{y}.png?key=zy6sHDBhSRsVvSPe3MCL', {
      attribution:
        '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      circlesRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuilds every circle whenever the zone list or selection changes —
  // there are only ever a handful of zones, so a full redraw is simpler
  // than diffing which ones actually moved.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const circle of Object.values(circlesRef.current)) circle.remove();
    circlesRef.current = {};

    for (const zone of zones) {
      const circle = L.circle([zone.lat, zone.lon], {
        radius: Number(zone.radius_m),
        ...circleStyle(zone, zone.id === selectedId),
      }).addTo(map);
      circle.bindTooltip(`${zone.name} (${Number(zone.radius_m).toFixed(0)} m)${zone.active ? '' : ' — inactiva'}`);
      circle.on('click', () => onSelectRef.current(zone.id));
      circlesRef.current[zone.id] = circle;
    }

    if (zones.length === 0) return;

    const selectedZone = zones.find((z) => z.id === selectedId);
    if (selectedZone) {
      map.fitBounds(circlesRef.current[selectedZone.id].getBounds(), { padding: [40, 40], maxZoom: 15 });
    } else {
      const bounds = L.latLngBounds(zones.map((z): [number, number] => [z.lat, z.lon]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [zones, selectedId]);

  return <div ref={containerRef} className="h-full w-full" />;
}
