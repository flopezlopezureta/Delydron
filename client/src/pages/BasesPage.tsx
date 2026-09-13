import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useBases } from '../hooks/useBases';
import { createBase, updateBase, deleteBase } from '../api/bases';
import { geocodeAddress } from '../api/geocoding';
import { BasePickerMap } from '../components/bases/BasePickerMap';
import type { Base } from '../types';

const DEFAULT_CENTER: [number, number] = [-33.4489, -70.6693];

export function BasesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { bases, loading, error, refetch } = useBases();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleFindAddress() {
    if (!address.trim()) return;
    setFormError(null);
    setSearchingAddress(true);
    try {
      const result = await geocodeAddress(address);
      if (!result) {
        setFormError('No se encontró esa dirección — probá con más detalle o marcá el punto directo en el mapa.');
        return;
      }
      setPoint({ lat: result.lat, lon: result.lon });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo buscar la dirección.');
    } finally {
      setSearchingAddress(false);
    }
  }

  function resetForm() {
    setName('');
    setAddress('');
    setPoint(null);
    setFormError(null);
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(b: Base) {
    setEditingId(b.id);
    setName(b.name);
    setAddress(b.address ?? '');
    setPoint({ lat: b.lat, lon: b.lon });
    setFormError(null);
    setShowForm(true);
  }

  async function handleSubmit() {
    setFormError(null);
    if (!name.trim()) return setFormError('Ponle un nombre a la base.');
    if (!point) return setFormError('Haz clic en el mapa para ubicar la base.');

    setSubmitting(true);
    try {
      const input = { name, address: address || undefined, lat: point.lat, lon: point.lon };
      if (editingId) {
        await updateBase(editingId, input);
      } else {
        await createBase(input);
      }
      resetForm();
      refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar la base.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    setDeleteError(null);
    try {
      await deleteBase(id);
      refetch();
    } catch (err) {
      setDeleteError(
        err instanceof Error && err.message === 'base_in_use_by_mission'
          ? 'No se puede eliminar: una misión activa todavía la usa como retiro o retorno.'
          : err instanceof Error
            ? err.message
            : 'No se pudo eliminar la base.'
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">Bases de despacho</h1>
        {isAdmin && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Nueva base
          </button>
        )}
      </div>

      {isAdmin && showForm && (
        <div className="mb-4 flex gap-4 rounded-lg border border-slate-200 bg-white p-4">
          <div className="h-80 w-96 shrink-0 overflow-hidden rounded border border-slate-200">
            <BasePickerMap center={point ?? DEFAULT_CENTER} point={point} onPick={(lat, lon) => setPoint({ lat, lon })} />
          </div>
          <div className="flex flex-1 flex-col">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">
              {editingId ? 'Editar base' : 'Nueva base'}
            </h2>
            <label className="mb-1 block text-xs text-slate-600">Nombre</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mb-3 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
            <label className="mb-1 block text-xs text-slate-600">Dirección</label>
            <div className="mb-3 flex gap-1">
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleFindAddress();
                  }
                }}
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={handleFindAddress}
                disabled={searchingAddress || !address.trim()}
                className="shrink-0 rounded border border-slate-300 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {searchingAddress ? '...' : 'Buscar'}
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              {point
                ? `Ubicación: ${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`
                : 'Escribí la dirección y tocá "Buscar", o hacé clic directo en el mapa.'}
            </p>
            {formError && <div className="mb-3 text-sm text-red-600">{formError}</div>}
            <div className="mt-auto flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {submitting ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Guardar base'}
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

      {loading && <div className="text-sm text-gray-500">Cargando bases...</div>}
      {error && <div className="text-sm text-red-600">Error: {error}</div>}
      {deleteError && <div className="mb-3 text-sm text-red-600">{deleteError}</div>}
      {!loading && !error && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Dirección</th>
                <th className="px-4 py-2">Ubicación</th>
                <th className="px-4 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bases.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-2 font-medium text-slate-800">{b.name}</td>
                  <td className="px-4 py-2 text-slate-600">{b.address ?? '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">
                    {b.lat.toFixed(5)}, {b.lon.toFixed(5)}
                  </td>
                  <td className="px-4 py-2">
                    {isAdmin ? (
                      <div className="flex gap-2">
                        <button
                          disabled={busyId === b.id}
                          onClick={() => startEdit(b)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Editar
                        </button>
                        <button
                          disabled={busyId === b.id}
                          onClick={() => handleDelete(b.id)}
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
              {bases.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-slate-400">
                    No hay bases todavía.
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
