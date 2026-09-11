import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDrones } from '../hooks/useDrones';
import { createMission } from '../api/missions';
import { WaypointPlannerMap } from '../components/map/WaypointPlannerMap';
import { WaypointList } from '../components/missions/WaypointList';
import type { Waypoint } from '../types';

const DEFAULT_CENTER: [number, number] = [-33.4489, -70.6693];
const DEFAULT_ALT_M = 60;

export function MissionPlannerPage() {
  const navigate = useNavigate();
  const { drones } = useDrones();
  const idleDrones = drones.filter((d) => d.status === 'idle');

  const [droneId, setDroneId] = useState('');
  const [priority, setPriority] = useState(3);
  const [payloadDesc, setPayloadDesc] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const mapCenter = useMemo<[number, number]>(() => {
    const selected = drones.find((d) => d.id === droneId) ?? drones[0];
    if (selected) return [selected.lat ?? selected.home_lat, selected.lon ?? selected.home_lon];
    return DEFAULT_CENTER;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drones.length]);

  function addWaypoint(lat: number, lon: number) {
    setWaypoints((prev) => [...prev, { seq: prev.length + 1, lat, lon, alt_m: DEFAULT_ALT_M }]);
  }

  function moveWaypoint(index: number, lat: number, lon: number) {
    setWaypoints((prev) => prev.map((wp, i) => (i === index ? { ...wp, lat, lon } : wp)));
  }

  function changeAltitude(index: number, altM: number) {
    setWaypoints((prev) => prev.map((wp, i) => (i === index ? { ...wp, alt_m: altM } : wp)));
  }

  function removeWaypoint(index: number) {
    setWaypoints((prev) =>
      prev.filter((_, i) => i !== index).map((wp, i) => ({ ...wp, seq: i + 1 }))
    );
  }

  async function handleCreate() {
    setError(null);
    if (waypoints.length < 1) {
      setError('Agrega al menos un waypoint en el mapa.');
      return;
    }

    setSubmitting(true);
    try {
      await createMission({
        droneId: droneId || undefined,
        priority,
        waypoints,
        payloadDesc: payloadDesc || undefined,
        pickupAddress: pickupAddress || undefined,
        dropoffAddress: dropoffAddress || undefined,
      });
      navigate('/missions');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la misión.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full">
      <div className="flex-1">
        <WaypointPlannerMap
          center={mapCenter}
          waypoints={waypoints}
          onAddWaypoint={addWaypoint}
          onMoveWaypoint={moveWaypoint}
        />
      </div>

      <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white p-4">
        <h1 className="mb-1 text-sm font-semibold text-slate-800">Planificador de misión</h1>
        <p className="mb-4 text-xs text-slate-500">Haz clic en el mapa para agregar waypoints en orden.</p>

        <div className="mb-3">
          <label className="mb-1 block text-xs text-slate-600">Dron (opcional al crear)</label>
          <select
            value={droneId}
            onChange={(e) => setDroneId(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Sin asignar</option>
            {idleDrones.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-xs text-slate-600">Prioridad (1-5)</label>
          <input
            type="number"
            min={1}
            max={5}
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-xs text-slate-600">Dirección de retiro</label>
          <input
            value={pickupAddress}
            onChange={(e) => setPickupAddress(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-xs text-slate-600">Dirección de entrega</label>
          <input
            value={dropoffAddress}
            onChange={(e) => setDropoffAddress(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs text-slate-600">Descripción de la carga</label>
          <input
            value={payloadDesc}
            onChange={(e) => setPayloadDesc(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>

        <h2 className="mb-2 text-xs font-semibold uppercase text-slate-500">Waypoints</h2>
        <div className="mb-4 flex-1">
          <WaypointList waypoints={waypoints} onAltitudeChange={changeAltitude} onRemove={removeWaypoint} />
        </div>

        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

        <div className="flex gap-2">
          <button
            onClick={handleCreate}
            disabled={submitting}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? 'Creando...' : 'Crear misión'}
          </button>
          <button
            onClick={() => navigate('/missions')}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
        </div>
      </aside>
    </div>
  );
}
