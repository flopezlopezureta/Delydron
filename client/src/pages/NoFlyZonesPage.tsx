import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNoFlyZones } from '../hooks/useNoFlyZones';
import { createNoFlyZone, updateNoFlyZone, deleteNoFlyZone } from '../api/noFlyZones';
import { NoFlyZonePickerMap } from '../components/noFlyZones/NoFlyZonePickerMap';
import { NoFlyZonesOverviewMap } from '../components/noFlyZones/NoFlyZonesOverviewMap';
import { AddressAutocomplete } from '../components/missions/AddressAutocomplete';
import type { AddressSuggestion } from '../api/geocoding';
import type { NoFlyZone } from '../types';

const DEFAULT_CENTER: [number, number] = [-33.4489, -70.6693];
const DEFAULT_RADIUS_M = 500;
const inputClass =
  'w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
const secondaryButtonClass =
  'rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800';

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
  const [addressQuery, setAddressQuery] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  function resetForm() {
    setName('');
    setRadiusM(String(DEFAULT_RADIUS_M));
    setNotes('');
    setPoint(null);
    setAddressQuery('');
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
    setAddressQuery('');
    setFormError(null);
    setShowForm(true);
  }

  function handleSelectAddress(suggestion: AddressSuggestion) {
    setPoint({ lat: suggestion.lat, lon: suggestion.lon });
    setAddressQuery('');
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
        <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Zonas restringidas</h1>
        {isAdmin && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Nueva zona
          </button>
        )}
      </div>
      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
        Ninguna misión puede guardarse ni despacharse si su ruta pasa dentro del radio de una zona activa.
      </p>

      {isAdmin && showForm && (
        <div className="mb-4 flex gap-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="h-80 w-96 shrink-0 overflow-hidden rounded border border-slate-200 dark:border-slate-700">
            <NoFlyZonePickerMap
              center={point ? [point.lat, point.lon] : DEFAULT_CENTER}
              point={point}
              radiusM={Number(radiusM) || DEFAULT_RADIUS_M}
              onPick={(lat, lon) => setPoint({ lat, lon })}
            />
          </div>
          <div className="flex flex-1 flex-col">
            <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              {editingId ? 'Editar zona' : 'Nueva zona'}
            </h2>
            <label className="mb-1 block text-xs text-slate-600 dark:text-slate-400">Nombre</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Aeropuerto Tobalaba"
              className={`mb-3 ${inputClass}`}
            />
            <label className="mb-1 block text-xs text-slate-600 dark:text-slate-400">Buscar dirección</label>
            <AddressAutocomplete
              value={addressQuery}
              onChange={setAddressQuery}
              onSelect={handleSelectAddress}
              placeholder="Ej: Aeropuerto Arturo Merino Benítez"
            />
            <div className="mb-3" />
            <label className="mb-1 block text-xs text-slate-600 dark:text-slate-400">Radio (metros)</label>
            <input
              type="number"
              min={1}
              value={radiusM}
              onChange={(e) => setRadiusM(e.target.value)}
              className={`mb-3 ${inputClass}`}
            />
            <label className="mb-1 block text-xs text-slate-600 dark:text-slate-400">Notas (opcional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={`mb-3 ${inputClass}`} />
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              {point
                ? `Centro: ${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`
                : 'Busca una dirección o haz clic en el mapa para ubicar el centro.'}
            </p>
            {formError && <div className="mb-3 text-sm text-red-600 dark:text-red-400">{formError}</div>}
            <div className="mt-auto flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
              >
                {submitting ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Guardar zona'}
              </button>
              <button
                onClick={resetForm}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {!showForm && !loading && zones.length > 0 && (
        <>
          <div
            className="mb-1 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800"
            style={{ height: 320 }}
          >
            <NoFlyZonesOverviewMap zones={zones} selectedId={selectedZoneId} onSelect={setSelectedZoneId} />
          </div>
          <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">
            Elige una zona en la tabla o toca su círculo en el mapa para ubicarla.
          </p>
        </>
      )}

      {loading && <div className="text-sm text-gray-500 dark:text-slate-400">Cargando zonas...</div>}
      {error && <div className="text-sm text-red-600 dark:text-red-400">Error: {error}</div>}
      {rowError && <div className="mb-3 text-sm text-red-600 dark:text-red-400">{rowError}</div>}
      {!loading && !error && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Radio</th>
                <th className="px-4 py-2">Ubicación</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2">Notas</th>
                <th className="px-4 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {zones.map((z) => (
                <tr
                  key={z.id}
                  onClick={() => setSelectedZoneId(z.id)}
                  className={`cursor-pointer ${
                    z.id === selectedZoneId
                      ? 'bg-blue-50 dark:bg-blue-950/40'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">{z.name}</td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{Number(z.radius_m).toFixed(0)} m</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {z.lat.toFixed(5)}, {z.lon.toFixed(5)}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        z.active
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-700/60 dark:text-slate-400'
                      }`}
                    >
                      {z.active ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{z.notes ?? '—'}</td>
                  <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                    {isAdmin ? (
                      <div className="flex flex-wrap gap-2">
                        <button disabled={busyId === z.id} onClick={() => startEdit(z)} className={secondaryButtonClass}>
                          Editar
                        </button>
                        <button
                          disabled={busyId === z.id}
                          onClick={() => handleToggleActive(z)}
                          className={secondaryButtonClass}
                        >
                          {z.active ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          disabled={busyId === z.id}
                          onClick={() => handleDelete(z.id)}
                          className={secondaryButtonClass}
                        >
                          Eliminar
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {zones.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-center text-slate-400 dark:text-slate-500">
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
