import { useEffect, useRef } from 'react';
import * as L from 'leaflet';

interface NoFlyZonePickerMapProps {
  center: [number, number];
  point: { lat: number; lon: number } | null;
  radiusM: number;
  onPick: (lat: number, lon: number) => void;
}

// Same click-to-place pattern as BasePickerMap, but drawing a circle sized
// by radiusM instead of a point marker — the shape a no-fly zone actually
// is, so the operator sees its real footprint while placing it.
export function NoFlyZonePickerMap({ center, point, radiusM, onPick }: NoFlyZonePickerMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const onPickRef = useRef(onPick);
  // A direct map click already means the operator is looking right at that
  // spot — only an externally-set point (address search, editing an
  // existing zone) needs the camera to follow it there.
  const lastWasClickRef = useRef(false);
  onPickRef.current = onPick;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView(center, 12);
    L.tileLayer('https://api.maptiler.com/maps/streets-v4/{z}/{x}/{y}.png?key=zy6sHDBhSRsVvSPe3MCL', {
      attribution:
        '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      lastWasClickRef.current = true;
      onPickRef.current(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      circleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Moves/creates the circle and follows it with the camera — kept
  // separate from the radius effect below so typing a radius value doesn't
  // also yank the map's pan/zoom on every keystroke.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!point) {
      circleRef.current?.remove();
      circleRef.current = null;
      return;
    }

    if (!circleRef.current) {
      circleRef.current = L.circle([point.lat, point.lon], {
        radius: radiusM,
        color: '#dc2626',
        weight: 2,
        fillColor: '#dc2626',
        fillOpacity: 0.15,
      }).addTo(map);
    } else {
      circleRef.current.setLatLng([point.lat, point.lon]);
    }

    if (!lastWasClickRef.current) {
      map.setView([point.lat, point.lon], 15);
    }
    lastWasClickRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [point]);

  useEffect(() => {
    circleRef.current?.setRadius(radiusM);
  }, [radiusM]);

  return <div ref={containerRef} className="h-full w-full" />;
}
