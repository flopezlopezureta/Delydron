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
  onPickRef.current = onPick;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView(center, 12);
    L.tileLayer('https://api.maptiler.com/maps/streets-v4/{z}/{x}/{y}.png?key=zy6sHDBhSRsVvSPe3MCL', {
      attribution:
        '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => onPickRef.current(e.latlng.lat, e.latlng.lng));

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      circleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      circleRef.current.setRadius(radiusM);
    }
  }, [point, radiusM]);

  return <div ref={containerRef} className="h-full w-full" />;
}
