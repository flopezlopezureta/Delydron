import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDrones } from '../hooks/useDrones';
import { useBases } from '../hooks/useBases';
import { createMission, getMission, updateMission } from '../api/missions';
import type { AddressSuggestion } from '../api/geocoding';
import { getSettings } from '../api/settings';
import { WaypointPlannerMap } from '../components/map/WaypointPlannerMap';
import { WaypointList } from '../components/missions/WaypointList';
import { AddressAutocomplete } from '../components/missions/AddressAutocomplete';
import { MAX_DESTINATIONS_PER_MISSION, type Waypoint } from '../types';

const DEFAULT_CENTER: [number, number] = [-33.4489, -70.6693];
const FALLBACK_ALT_M = 60; // used only until /api/settings responds

export function MissionPlannerPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('editId');
  const repeatFrom = searchParams.get('repeatFrom');
  const sourceId = editId || repeatFrom;
  const { drones } = useDrones();
  const { bases } = useBases();
  const idleDrones = drones.filter((d) => d.status === 'idle');

  const [droneId, setDroneId] = useState('');
  const [priority, setPriority] = useState(3);
  const [payloadDesc, setPayloadDesc] = useState('');
  const [pickupBaseId, setPickupBaseId] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [returnBaseId, setReturnBaseId] = useState('');
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [defaultAltM, setDefaultAltM] = useState(FALLBACK_ALT_M);
  // Blocks the first render (map included) until the source mission (to
  // edit or repeat) has loaded, so the map mounts already centered on its
  // route — it only reads `center` once, on mount, not on every prop change.
  const [loadingSource, setLoadingSource] = useState(Boolean(sourceId));

  useEffect(() => {
    if (!sourceId) return;
    getMission(sourceId)
      .then((m) => {
        setPriority(m.priority);
        setPayloadDesc(m.payload_desc ?? '');
        setPickupBaseId(m.pickup_base_id ?? '');
        setPickupAddress(m.pickup_address ?? '');
        setDropoffAddress(m.dropoff_address ?? '');
        setReturnBaseId(m.return_base_id ?? '');
        setWaypoints(m.waypoints ?? []);
        // Editing keeps the drone that's already on the mission; repeating
        // deliberately leaves it unassigned — that drone may no longer be
        // idle or even exist by the time this route flies again.
        if (editId) setDroneId(m.drone_id ?? '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar la misión.'))
      .finally(() => setLoadingSource(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId]);

  useEffect(() => {
    getSettings()
      .then((s) => setDefaultAltM(s.default_altitude_m))
      .catch(() => {}); // keep FALLBACK_ALT_M
  }, []);

  const mapCenter = useMemo<[number, number]>(() => {
    if (waypoints.length > 0) return [waypoints[0].lat, waypoints[0].lon];
    const selected = drones.find((d) => d.id === droneId) ?? drones[0];
    if (selected) return [selected.lat ?? selected.home_lat, selected.lon ?? selected.home_lon];
    return DEFAULT_CENTER;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drones.length, waypoints]);

  function addWaypoint(lat: number, lon: number, address?: string) {
    setError(null);
    setWaypoints((prev) => {
      if (prev.length >= MAX_DESTINATIONS_PER_MISSION) {
        setError(`Un dron tiene ${MAX_DESTINATIONS_PER_MISSION} compuertas de descarga — no se pueden agregar más de ${MAX_DESTINATIONS_PER_MISSION} destinos.`);
        return prev;
      }
      return [...prev, { seq: prev.length + 1, lat, lon, alt_m: defaultAltM, address }];
    });
  }

  function moveWaypoint(index: number, lat: number, lon: number) {
    // The pin moved, so any address label resolved for the old spot no
    // longer describes where it actually is — drop it rather than show a
    // now-inaccurate address next to the real (dragged) coordinates.
    setWaypoints((prev) => prev.map((wp, i) => (i === index ? { ...wp, lat, lon, address: undefined } : wp)));
  }

  function changeAltitude(index: number, altM: number) {
    setWaypoints((prev) => prev.map((wp, i) => (i === index ? { ...wp, alt_m: altM } : wp)));
  }

  function changePackage(index: number, packageDesc: string) {
    setWaypoints((prev) => prev.map((wp, i) => (i === index ? { ...wp, package_desc: packageDesc } : wp)));
  }

  function removeWaypoint(index: number) {
    setWaypoints((prev) =>
      prev.filter((_, i) => i !== index).map((wp, i) => ({ ...wp, seq: i + 1 }))
    );
  }

  // Swaps a waypoint with its neighbor and renumbers `seq` to match the new
  // order — delivery order matters (it's a flight path), not just membership.
  function reorderWaypoint(index: number, direction: -1 | 1) {
    setWaypoints((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((wp, i) => ({ ...wp, seq: i + 1 }));
    });
  }

  // Adds the chosen suggestion as a real waypoint and clears the search box,
  // ready for the next destination — the address itself was only ever a way
  // to find a point, not a field that stays attached to the form.
  function handleSelectDropoffSuggestion(suggestion: AddressSuggestion) {
    setError(null);
    addWaypoint(suggestion.lat, suggestion.lon, suggestion.placeName);
    setDropoffAddress('');
  }

  function handlePickupBaseChange(id: string) {
    setPickupBaseId(id);
    const base = bases.find((b) => b.id === id);
    // Only auto-fill if the operator hasn't already typed their own address.
    if (base && !pickupAddress.trim()) {
      setPickupAddress(base.address ?? base.name);
    }
  }

  async function handleSubmit() {
    setError(null);
    if (waypoints.length < 1) {
      setError('Agrega al menos un destino en el mapa.');
      return;
    }

    setSubmitting(true);
    try {
      const input = {
        droneId: droneId || undefined,
        priority,
        waypoints,
        payloadDesc: payloadDesc || undefined,
        pickupBaseId: pickupBaseId || undefined,
        pickupAddress: pickupAddress || undefined,
        dropoffAddress: dropoffAddress || undefined,
        returnBaseId: returnBaseId || undefined,
      };
      if (editId) {
        await updateMission(editId, input);
      } else {
        await createMission(input);
      }
      navigate('/missions');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la misión.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingSource) {
    return <div className="p-4 text-sm text-slate-500">Cargando misión...</div>;
  }

  const title = editId ? 'Editar misión' : repeatFrom ? 'Repetir misión' : 'Planificador de misión';
  const subtitle = editId
    ? 'Ajusta lo que haga falta y guarda los cambios.'
    : repeatFrom
      ? 'Misma ruta y carga que la original — revisa o ajusta antes de asignar un dron.'
      : `Haz clic en el mapa para agregar destinos en orden (hasta ${MAX_DESTINATIONS_PER_MISSION}, uno por compuerta de descarga).`;

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
        <h1 className="mb-1 text-sm font-semibold text-slate-800">{title}</h1>
        <p className="mb-4 text-xs text-slate-500">{subtitle}</p>

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
          <label className="mb-1 block text-xs text-slate-600">Base de retiro</label>
          <select
            value={pickupBaseId}
            onChange={(e) => handlePickupBaseChange(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Sin base</option>
            {bases.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
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
          <label className="mb-1 block text-xs text-slate-600">Agregar destino por dirección</label>
          <AddressAutocomplete
            value={dropoffAddress}
            onChange={setDropoffAddress}
            onSelect={handleSelectDropoffSuggestion}
            placeholder="Ej: Los Cerezos 5799, Peñalolén"
          />
          <p className="mt-1 text-xs text-slate-400">
            Elige una sugerencia de la lista para agregarla como destino, o marca el punto directo en el mapa.
          </p>
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-xs text-slate-600">Base de retorno (vacío = base propia del dron)</label>
          <select
            value={returnBaseId}
            onChange={(e) => setReturnBaseId(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Base propia del dron</option>
            {bases.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs text-slate-600">Descripción de la carga</label>
          <input
            value={payloadDesc}
            onChange={(e) => setPayloadDesc(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>

        <h2 className="mb-2 text-xs font-semibold uppercase text-slate-500">
          Destinos ({waypoints.length}/{MAX_DESTINATIONS_PER_MISSION})
        </h2>
        <div className="mb-4 flex-1">
          <WaypointList
            waypoints={waypoints}
            onAltitudeChange={changeAltitude}
            onPackageChange={changePackage}
            onRemove={removeWaypoint}
            onReorder={reorderWaypoint}
          />
        </div>

        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? 'Guardando...' : editId ? 'Guardar cambios' : 'Crear misión'}
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
