import { useEffect, useState } from 'react';
import { useDrones } from '../hooks/useDrones';
import { useBases } from '../hooks/useBases';
import { createDrone } from '../api/drones';
import { getSettings, updateSettings, type Settings } from '../api/settings';

export function ConfigPage() {
  const { drones, loading, error, refetch } = useDrones();
  const { bases } = useBases();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [model, setModel] = useState('');
  const [maxSpeedMps, setMaxSpeedMps] = useState('');
  const [maxRangeKm, setMaxRangeKm] = useState('');
  const [homeBaseId, setHomeBaseId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [settings, setSettings] = useState<Settings | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  function resetForm() {
    setName('');
    setSerialNumber('');
    setModel('');
    setMaxSpeedMps('');
    setMaxRangeKm('');
    setHomeBaseId('');
    setFormError(null);
    setShowForm(false);
  }

  async function handleCreateDrone() {
    setFormError(null);
    if (!name.trim()) return setFormError('Ponle un nombre al dron.');
    const base = bases.find((b) => b.id === homeBaseId);
    if (!base) return setFormError('Elegí la base de origen del dron.');

    setSubmitting(true);
    try {
      await createDrone({
        name,
        serialNumber: serialNumber || undefined,
        model: model || undefined,
        homeLat: base.lat,
        homeLon: base.lon,
        maxSpeedMps: maxSpeedMps ? Number(maxSpeedMps) : undefined,
        maxRangeKm: maxRangeKm ? Number(maxRangeKm) : undefined,
      });
      resetForm();
      refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo crear el dron.');
    } finally {
      setSubmitting(false);
    }
  }

  function updateSettingField(field: keyof Settings, value: number) {
    setSettingsSaved(false);
    setSettings((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  async function handleSaveSettings() {
    if (!settings) return;
    setSettingsSaving(true);
    try {
      setSettings(await updateSettings(settings));
      setSettingsSaved(true);
    } finally {
      setSettingsSaving(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <h1 className="mb-4 text-lg font-semibold text-slate-800">Configuración</h1>

      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">Ajustes de vuelo</h2>
        <p className="mb-3 text-xs text-slate-500">Se aplican de inmediato — no hace falta redeployar.</p>
        {!settings ? (
          <div className="text-sm text-gray-500">Cargando...</div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-xs text-slate-600">Altura de vuelo por defecto (m)</label>
              <input
                type="number"
                min={1}
                value={settings.default_altitude_m}
                onChange={(e) => updateSettingField('default_altitude_m', Number(e.target.value))}
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-600">Espera de descarga en destino (s)</label>
              <input
                type="number"
                min={0}
                value={settings.discharge_seconds}
                onChange={(e) => updateSettingField('discharge_seconds', Number(e.target.value))}
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-600">Consumo de batería (%/min, simulación)</label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={settings.battery_drain_pct_per_min}
                onChange={(e) => updateSettingField('battery_drain_pct_per_min', Number(e.target.value))}
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
          </div>
        )}
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={handleSaveSettings}
            disabled={!settings || settingsSaving}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {settingsSaving ? 'Guardando...' : 'Guardar ajustes'}
          </button>
          {settingsSaved && <span className="text-sm text-emerald-600">Guardado — ya está activo.</span>}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Flota de drones</h2>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Nuevo dron
            </button>
          )}
        </div>

        {showForm && (
          <div className="mb-4 max-w-lg rounded-lg border border-slate-200 bg-white p-4">
            <label className="mb-1 block text-xs text-slate-600">Nombre</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mb-3 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-600">N° de serie</label>
                <input
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-600">Modelo</label>
                <input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-600">Velocidad máx. (m/s)</label>
                <input
                  type="number"
                  min={0}
                  value={maxSpeedMps}
                  onChange={(e) => setMaxSpeedMps(e.target.value)}
                  placeholder="15"
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-600">Autonomía (km)</label>
                <input
                  type="number"
                  min={0}
                  value={maxRangeKm}
                  onChange={(e) => setMaxRangeKm(e.target.value)}
                  placeholder="10"
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <label className="mb-1 block text-xs text-slate-600">Base de origen</label>
            <select
              value={homeBaseId}
              onChange={(e) => setHomeBaseId(e.target.value)}
              className="mb-3 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">Elegí una base...</option>
              {bases.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            {bases.length === 0 && (
              <p className="mb-3 text-xs text-amber-600">
                Todavía no hay bases creadas — andá a "Bases" y creá una primero.
              </p>
            )}
            {formError && <div className="mb-3 text-sm text-red-600">{formError}</div>}
            <div className="flex gap-2">
              <button
                onClick={handleCreateDrone}
                disabled={submitting}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {submitting ? 'Guardando...' : 'Guardar dron'}
              </button>
              <button
                onClick={resetForm}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {loading && <div className="text-sm text-gray-500">Cargando drones...</div>}
        {error && <div className="text-sm text-red-600">Error: {error}</div>}
        {!loading && !error && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Nombre</th>
                  <th className="px-4 py-2">N° de serie</th>
                  <th className="px-4 py-2">Modelo</th>
                  <th className="px-4 py-2">Estado</th>
                  <th className="px-4 py-2">Velocidad</th>
                  <th className="px-4 py-2">Autonomía</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {drones.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-2 font-medium text-slate-800">{d.name}</td>
                    <td className="px-4 py-2 text-slate-600">{d.serial_number ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{d.model ?? '—'}</td>
                    <td className="px-4 py-2 uppercase text-slate-500">{d.status}</td>
                    <td className="px-4 py-2 text-slate-600">{Number(d.max_speed_mps)} m/s</td>
                    <td className="px-4 py-2 text-slate-600">{Number(d.max_range_km)} km</td>
                  </tr>
                ))}
                {drones.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-4 text-center text-slate-400">
                      No hay drones todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
