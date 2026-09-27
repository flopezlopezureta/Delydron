import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import type { BaseKind } from '../../types';

interface BasePickerMapProps {
  center: [number, number];
  point: { lat: number; lon: number } | null;
  kind: BaseKind;
  onPick: (lat: number, lon: number) => void;
}

const BASE_KIND_COLORS: Record<BaseKind, string> = {
  bdd: '#0f172a',
  prd: '#d97706',
  ped: '#059669',
};

function baseIcon(kind: BaseKind) {
  return L.divIcon({
    className: '',
    html: `<div style="min-width:34px;height:22px;padding:0 4px;border-radius:6px;background:${BASE_KIND_COLORS[kind]};color:white;
      display:flex;align-items:center;justify-content:center;font:700 10px sans-serif;
      border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4);">${kind.toUpperCase()}</div>`,
    iconSize: [34, 22],
    iconAnchor: [17, 11],
  });
}

export function BasePickerMap({ center, point, kind, onPick }: BasePickerMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView(center, 13);
    L.tileLayer('https://api.maptiler.com/maps/streets-v4/{z}/{x}/{y}.png?key=zy6sHDBhSRsVvSPe3MCL', {
      attribution: '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => onPickRef.current(e.latlng.lat, e.latlng.lng));

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!point) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    if (!markerRef.current) {
      const marker = L.marker([point.lat, point.lon], { icon: baseIcon(kind), draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onPickRef.current(pos.lat, pos.lng);
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng([point.lat, point.lon]);
      markerRef.current.setIcon(baseIcon(kind));
    }
  }, [point, kind]);

  return <div ref={containerRef} className="h-full w-full" />;
}
