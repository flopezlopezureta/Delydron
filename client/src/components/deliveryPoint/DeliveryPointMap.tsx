import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface DeliveryPointMapProps {
  originalPoint: { lat: number; lon: number };
  currentPoint: { lat: number; lon: number };
  maxAdjustM: number;
  editable: boolean;
  onMove: (lat: number, lon: number) => void;
}

const pinIconHtml = `
  <div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
    <svg width="26" height="26" viewBox="0 0 24 24" fill="#2563eb" stroke="white" stroke-width="1">
      <path d="M12 2c-4.4 0-8 3.6-8 8 0 5.4 8 12 8 12s8-6.6 8-12c0-4.4-3.6-8-8-8z" />
      <circle cx="12" cy="10" r="3" fill="white" />
    </svg>
  </div>
`;
const pinIcon = L.divIcon({ className: '', html: pinIconHtml, iconSize: [28, 28], iconAnchor: [14, 26] });

// The bounding circle is centered on the ORIGINAL point (where the address
// search / order originally resolved to) and never moves — it's the fence,
// not the pin. The customer drags the pin within it; the server re-checks
// the same maxAdjustM distance on save, so this is guidance, not the only guard.
export function DeliveryPointMap({ originalPoint, currentPoint, maxAdjustM, editable, onMove }: DeliveryPointMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([originalPoint.lat, originalPoint.lon], 16);
    L.tileLayer('https://api.maptiler.com/maps/streets-v4/{z}/{x}/{y}.png?key=zy6sHDBhSRsVvSPe3MCL', {
      attribution:
        '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    circleRef.current = L.circle([originalPoint.lat, originalPoint.lon], {
      radius: maxAdjustM,
      color: '#2563eb',
      weight: 1.5,
      fillColor: '#2563eb',
      fillOpacity: 0.08,
      dashArray: '4 4',
    }).addTo(map);

    markerRef.current = L.marker([currentPoint.lat, currentPoint.lon], { icon: pinIcon, draggable: false }).addTo(map);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      circleRef.current = null;
      markerRef.current = null;
    };
    // Original point / radius are fixed for the life of the page (one token
    // = one destination) — only the editable flag and click/drag wiring
    // below need to react to later prop changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;

    marker.setLatLng([currentPoint.lat, currentPoint.lon]);
    marker.dragging?.[editable ? 'enable' : 'disable']();

    function handleDragEnd() {
      const pos = marker!.getLatLng();
      onMoveRef.current(pos.lat, pos.lng);
    }
    function handleMapClick(e: L.LeafletMouseEvent) {
      if (!editable) return;
      onMoveRef.current(e.latlng.lat, e.latlng.lng);
    }

    marker.on('dragend', handleDragEnd);
    map.on('click', handleMapClick);
    return () => {
      marker.off('dragend', handleDragEnd);
      map.off('click', handleMapClick);
    };
  }, [currentPoint, editable]);

  return <div ref={containerRef} className="h-full w-full" />;
}
