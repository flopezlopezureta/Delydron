import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useBases } from '../hooks/useBases';
import { createBase, updateBase, deleteBase } from '../api/bases';
import { geocodeAddress } from '../api/geocoding';
import { BasePickerMap } from '../components/bases/BasePickerMap';
import { BASE_KIND_LABELS, type Base, type BaseKind } from '../types';

const DEFAULT_CENTER: [number, number] = [-33.4489, -70.6693];

const KIND_FILTERS: { label: string; kind?: BaseKind }[] = [
  { label: 'Todas' },
  { label: 'BDD', kind: 'bdd' },
  { label: 'PRD', kind: 'prd' },
  { label: 'PED', kind: 'ped' },
];

const KIND_BADGE_CLASSES: Record<BaseKind, string> = {
  bdd: 'bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-300',
  prd: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  ped: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
};

const filterPillClass = (active: boolean) =>
  `rounded-full px-3 py-1 text-xs font-medium ${
    active
      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
  }`;
const inputClass =
  'w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
const secondaryButtonClass =
  'rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800';

export function BasesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const { bases, loading, error, refetch } = useBases();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [kind, setKind] = useState<BaseKind>('bdd');
  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<BaseKind | undefined>(undefined);

  const visibleBases = kindFilter ? bases.filter((b) => b.kind === kindFilter) : bases;

  async function handleFindAddress() {
    if (!address.trim()) return;
    setFormError(null);
    setSearchingAddress(true);
    try {
      const result = await geocodeAddress(address);
      if (!result) {
        setFormError('No se encontró esa dirección — prueba con más detalle o marca el punto directo en el mapa.');
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
    setKind('bdd');
    setPoint(null);
    setFormError(null);
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(b: Base) {
    setEditingId(b.id);
    setName(b.name);
    setAddress(b.address ?? '');
    setKind(b.kind);
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
      const input = { name, address: address || undefined, lat: point.lat, lon: point.lon, kind };
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
        <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Bases de despacho</h1>
        {kindFilter && (
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {BASE_KIND_LABELS[kindFilter]}
          </p>
        )}
        {isAdmin && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Nueva base
          </button>
        )}
      </div>

      {isAdmin && showForm && (
        <div className="mb-4 flex gap-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="h-80 w-96 shrink-0 overflow-hidden rounded border border-slate-200 dark:border-slate-700">
            <BasePickerMap
              center={point ? [point.lat, point.lon] : DEFAULT_CENTER}
              point={point}
              kind={kind}
              onPick={(lat, lon) => setPoint({ lat, lon })}
            />
          </div>
          <div className="flex flex-1 flex-col">
            <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              {editingId ? 'Editar base' : 'Nueva base'}
            </h2>
            <label className="mb-1 block text-xs text-slate-600 dark:text-slate-400">Tipo</label>
            <div className="mb-3 flex gap-1.5">
              {(Object.keys(BASE_KIND_LABELS) as BaseKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={filterPillClass(kind === k)}
                >
                  {k.toUpperCase()}
                </button>
              ))}
            </div>
            <p className="mb-3 -mt-2 text-xs text-slate-400 dark:text-slate-500">{BASE_KIND_LABELS[kind]}</p>
            <label className="mb-1 block text-xs text-slate-600 dark:text-slate-400">Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={`mb-3 ${inputClass}`} />
            <label className="mb-1 block text-xs text-slate-600 dark:text-slate-400">Dirección</label>
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
                className={inputClass}
              />
              <button
                type="button"
                onClick={handleFindAddress}
                disabled={searchingAddress || !address.trim()}
                className={`shrink-0 ${secondaryButtonClass}`}
              >
                {searchingAddress ? '...' : 'Buscar'}
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              {point
                ? `Ubicación: ${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`
                : 'Escribe la dirección y toca "Buscar", o haz clic directo en el mapa.'}
            </p>
            {formError && <div className="mb-3 text-sm text-red-600 dark:text-red-400">{formError}</div>}
            <div className="mt-auto flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
              >
                {submitting ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Guardar base'}
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

      <div className="mb-4 flex gap-1.5">
        {KIND_FILTERS.map((f) => (
          <button key={f.label} onClick={() => setKindFilter(f.kind)} className={filterPillClass(kindFilter === f.kind)}>
            {f.label}
          </button>
        ))}
      </div>

      {loading && <div className="text-sm text-gray-500 dark:text-slate-400">Cargando bases...</div>}
      {error && <div className="text-sm text-red-600 dark:text-red-400">Error: {error}</div>}
      {deleteError && <div className="mb-3 text-sm text-red-600 dark:text-red-400">{deleteError}</div>}
      {!loading && !error && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2">Dirección</th>
                <th className="px-4 py-2">Ubicación</th>
                <th className="px-4 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visibleBases.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">{b.name}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${KIND_BADGE_CLASSES[b.kind]}`}>
                      {b.kind.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{b.address ?? '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {b.lat.toFixed(5)}, {b.lon.toFixed(5)}
                  </td>
                  <td className="px-4 py-2">
                    {isAdmin ? (
                      <div className="flex gap-2">
                        <button disabled={busyId === b.id} onClick={() => startEdit(b)} className={secondaryButtonClass}>
                          Editar
                        </button>
                        <button
                          disabled={busyId === b.id}
                          onClick={() => handleDelete(b.id)}
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
              {visibleBases.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-slate-400 dark:text-slate-500">
                    {bases.length === 0 ? 'No hay bases todavía.' : 'Ningún resultado para este filtro.'}
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
