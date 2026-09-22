import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNoFlyZones } from '../hooks/useNoFlyZones';
import { createNoFlyZone, updateNoFlyZone, deleteNoFlyZone } from '../api/noFlyZones';
import { NoFlyZonePickerMap } from '../components/noFlyZones/NoFlyZonePickerMap';
import type { NoFlyZone } from '../types';

const DEFAULT_CENTER: [number, number] = [-33.4489, -70.6693];
const DEFAULT_RADIUS_M = 500;

export function NoFlyZonesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const { zones, loading, error, refetch } = useNoFlyZones();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [radiusM, setRadiusM] = useState(String(DEFAULT_RADIUS_M));
  const [notes, setNotes] = useState('');
  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  function resetForm() {
    setName('');
    setRadiusM(String(DEFAULT_RADIUS_M));
    setNotes('');
    setPoint(null);
    setFormError(null);
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(z: NoFlyZone) {
    setEditingId(z.id);
    setName(z.name);
    setRadiusM(String(z.radius_m));
    setNotes(z.notes ?? '');
    setPoint({ lat: z.lat, lon: z.lon });
    setFormError(null);
    setShowForm(true);
  }

  async function handleSubmit() {
    setFormError(null);
    if (!name.trim()) return setFormError('Ponle un nombre a la zona.');
    if (!point) return setFormError('Haz clic en el mapa para ubicar el centro de la zona.');
    const radius = Number(radiusM);
    if (!radius || radius <= 0) return setFormError('El radio debe ser mayor a 0.');

    setSubmitting(true);
    try {
      const input = { name, lat: point.lat, lon: point.lon, radiusM: radius, notes: notes || undefined };
      if (editingId) {
        await updateNoFlyZone(editingId, input);
      } else {
        await createNoFlyZone(input);
      }
      resetForm();
      refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar la zona.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(z: NoFlyZone) {
    setBusyId(z.id);
    setRowError(null);
    try {
      await updateNoFlyZone(z.id, { active: !z.active });
      refetch();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'No se pudo actualizar la zona.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    setRowError(null);
    try {
      await deleteNoFlyZone(id);
      refetch();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'No se pudo eliminar la zona.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">Zonas restringidas</h1>
        {isAdmin && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Nueva zona
          </button>
        )}
      </div>
      <p className="mb-4 text-xs text-slate-500">
        Ninguna misión puede guardarse ni despacharse si su ruta pasa dentro del radio de una zona activa.
      </p>

      {isAdmin && showForm && (
        <div className="mb-4 flex gap-4 rounded-lg border border-slate-200 bg-white p-4">
          <div className="h-80 w-96 shrink-0 overflow-hidden rounded border border-slate-200">
            <NoFlyZonePickerMap
              center={point ? [point.lat, point.lon] : DEFAULT_CENTER}
              point={point}
              radiusM={Number(radiusM) || DEFAULT_RADIUS_M}
              onPick={(lat, lon) => setPoint({ lat, lon })}
            />
          </div>
          <div className="flex flex-1 flex-col">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">
              {editingId ? 'Editar zona' : 'Nueva zona'}
            </h2>
            <label className="mb-1 block text-xs text-slate-600">Nombre</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Aeropuerto Tobalaba"
              className="mb-3 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
            <label className="mb-1 block text-xs text-slate-600">Radio (metros)</label>
            <input
              type="number"
              min={1}
              value={radiusM}
              onChange={(e) => setRadiusM(e.target.value)}
              className="mb-3 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
            <label className="mb-1 block text-xs text-slate-600">Notas (opcional)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mb-3 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
            <p className="mb-3 text-xs text-slate-500">
              {point
                ? `Centro: ${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`
                : 'Haz clic en el mapa para ubicar el centro.'}
            </p>
            {formError && <div className="mb-3 text-sm text-red-600">{formError}</div>}
            <div className="mt-auto flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {submitting ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Guardar zona'}
              </button>
              <button
                onClick={resetForm}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && <div className="text-sm text-gray-500">Cargando zonas...</div>}
      {error && <div className="text-sm text-red-600">Error: {error}</div>}
      {rowError && <div className="mb-3 text-sm text-red-600">{rowError}</div>}
      {!loading && !error && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Radio</th>
                <th className="px-4 py-2">Ubicación</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2">Notas</th>
                <th className="px-4 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {zones.map((z) => (
                <tr key={z.id}>
                  <td className="px-4 py-2 font-medium text-slate-800">{z.name}</td>
                  <td className="px-4 py-2 text-slate-600">{Number(z.radius_m).toFixed(0)} m</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">
                    {z.lat.toFixed(5)}, {z.lon.toFixed(5)}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        z.active ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {z.active ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{z.notes ?? '—'}</td>
                  <td className="px-4 py-2">
                    {isAdmin ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          disabled={busyId === z.id}
                          onClick={() => startEdit(z)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Editar
                        </button>
                        <button
                          disabled={busyId === z.id}
                          onClick={() => handleToggleActive(z)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {z.active ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          disabled={busyId === z.id}
                          onClick={() => handleDelete(z.id)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Eliminar
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {zones.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-center text-slate-400">
                    No hay zonas restringidas todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
