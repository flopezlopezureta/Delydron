import { useState } from 'react';
import { useBases } from '../hooks/useBases';
import { createBase, deleteBase } from '../api/bases';
import { geocodeAddress } from '../api/geocoding';
import { BasePickerMap } from '../components/bases/BasePickerMap';

const DEFAULT_CENTER: [number, number] = [-33.4489, -70.6693];

export function BasesPage() {
  const { bases, loading, error, refetch } = useBases();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

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
    setShowForm(false);
  }

  async function handleCreate() {
    setFormError(null);
    if (!name.trim()) return setFormError('Ponle un nombre a la base.');
    if (!point) return setFormError('Haz clic en el mapa para ubicar la base.');

    setSubmitting(true);
    try {
      await createBase({ name, address: address || undefined, lat: point.lat, lon: point.lon });
      resetForm();
      refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo crear la base.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      await deleteBase(id);
      refetch();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">Bases de despacho</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Nueva base
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-4 flex gap-4 rounded-lg border border-slate-200 bg-white p-4">
          <div className="h-80 w-96 shrink-0 overflow-hidden rounded border border-slate-200">
            <BasePickerMap center={DEFAULT_CENTER} point={point} onPick={(lat, lon) => setPoint({ lat, lon })} />
          </div>
          <div className="flex flex-1 flex-col">
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
                onClick={handleCreate}
                disabled={submitting}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {submitting ? 'Guardando...' : 'Guardar base'}
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
                    <button
                      disabled={busyId === b.id}
                      onClick={() => handleDelete(b.id)}
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Eliminar
                    </button>
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
