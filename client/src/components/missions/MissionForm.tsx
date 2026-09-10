import { useState, type FormEvent } from 'react';
import { createMission } from '../../api/missions';
import type { Drone } from '../../types';

const WAYPOINTS_PLACEHOLDER = `[
  { "seq": 1, "lat": -33.4520, "lon": -70.6650, "alt_m": 60 },
  { "seq": 2, "lat": -33.4550, "lon": -70.6600, "alt_m": 60 }
]`;

interface MissionFormProps {
  drones: Drone[];
  onCreated: () => void;
  onCancel: () => void;
}

export function MissionForm({ drones, onCreated, onCancel }: MissionFormProps) {
  const idleDrones = drones.filter((d) => d.status === 'idle');
  const [droneId, setDroneId] = useState('');
  const [priority, setPriority] = useState(3);
  const [payloadDesc, setPayloadDesc] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [waypointsText, setWaypointsText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    let waypoints;
    if (waypointsText.trim()) {
      try {
        waypoints = JSON.parse(waypointsText);
      } catch {
        setError('Waypoints: JSON inválido.');
        return;
      }
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
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la misión.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">Nueva misión</h2>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
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
        <div>
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
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-slate-600">Dirección de retiro</label>
          <input
            value={pickupAddress}
            onChange={(e) => setPickupAddress(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-600">Dirección de entrega</label>
          <input
            value={dropoffAddress}
            onChange={(e) => setDropoffAddress(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-xs text-slate-600">Descripción de la carga</label>
        <input
          value={payloadDesc}
          onChange={(e) => setPayloadDesc(e.target.value)}
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-xs text-slate-600">
          Waypoints (JSON — el planificador visual llega en la Fase 4)
        </label>
        <textarea
          value={waypointsText}
          onChange={(e) => setWaypointsText(e.target.value)}
          placeholder={WAYPOINTS_PLACEHOLDER}
          rows={5}
          className="w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-xs"
        />
      </div>

      {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {submitting ? 'Creando...' : 'Crear misión'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
