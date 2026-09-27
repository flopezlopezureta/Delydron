import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useDrones } from '../hooks/useDrones';
import { useBases } from '../hooks/useBases';
import {
  createDrone,
  updateDrone,
  deleteDrone,
  returnDroneToHome,
  emergencyStopDrone,
} from '../api/drones';
import { getSettings, updateSettings, type Settings } from '../api/settings';
import type { Drone } from '../types';

// A drone is only truly "parked" in these states — anything else (flying,
// unloading, returning, armed) is a candidate for a manual recall/stop.
const RECALLABLE_STATUSES = ['in_flight', 'unloading', 'returning', 'armed'];

const labelClass = 'mb-1 block text-xs text-slate-600 dark:text-slate-400';
const inputClass =
  'w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-900 dark:disabled:text-slate-500';
const cardClass = 'rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900';
const primaryButtonClass = 'rounded bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50';
const secondaryButtonClass =
  'rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800';

export function ConfigPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  // Technicians can't create/delete drones or touch flight settings, but
  // they can edit an existing drone's profile — including reassigning its
  // home base, which is the whole point of the role per Fabian's spec.
  const canEditDrones = isAdmin || user?.role === 'technician';
  const { drones, loading, error, refetch } = useDrones();
  const { bases } = useBases();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [model, setModel] = useState('');
  const [maxSpeedMps, setMaxSpeedMps] = useState('');
  const [maxRangeKm, setMaxRangeKm] = useState('');
  const [maintenanceIntervalHours, setMaintenanceIntervalHours] = useState('');
  const [homeBaseId, setHomeBaseId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

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
    setMaintenanceIntervalHours('');
    setHomeBaseId('');
    setFormError(null);
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(d: Drone) {
    setEditingId(d.id);
    setName(d.name);
    setSerialNumber(d.serial_number ?? '');
    setModel(d.model ?? '');
    setMaxSpeedMps(String(d.max_speed_mps));
    setMaxRangeKm(String(d.max_range_km));
    setMaintenanceIntervalHours(String(d.maintenance_interval_hours));
    // Best-effort: preselect the base whose coordinates match the drone's
    // current home position, so editing doesn't look like it "forgot" it.
    // No match (e.g. it was set by geocoding an address) just leaves it
    // unselected — you still pick one explicitly to actually change it.
    const currentBase = bases.find((b) => b.lat === d.home_lat && b.lon === d.home_lon);
    setHomeBaseId(currentBase?.id ?? '');
    setFormError(null);
    setShowForm(true);
  }

  async function handleSubmitDrone() {
    setFormError(null);
    if (!name.trim()) return setFormError('Ponle un nombre al dron.');

    setSubmitting(true);
    try {
      if (editingId) {
        const base = bases.find((b) => b.id === homeBaseId);
        await updateDrone(editingId, {
          name,
          serial_number: serialNumber || undefined,
          model: model || undefined,
          max_speed_mps: maxSpeedMps ? Number(maxSpeedMps) : undefined,
          max_range_km: maxRangeKm ? Number(maxRangeKm) : undefined,
          maintenance_interval_hours: maintenanceIntervalHours ? Number(maintenanceIntervalHours) : undefined,
          // Only sent when a base is actually selected — leaving it on "sin
          // cambios" keeps whatever home position the drone already has.
          ...(base ? { home_lat: base.lat, home_lon: base.lon } : {}),
        });
      } else {
        const base = bases.find((b) => b.id === homeBaseId);
        if (!base) return setFormError('Elige la base de origen del dron.');
        await createDrone({
          name,
          serialNumber: serialNumber || undefined,
          model: model || undefined,
          homeLat: base.lat,
          homeLon: base.lon,
          maxSpeedMps: maxSpeedMps ? Number(maxSpeedMps) : undefined,
          maxRangeKm: maxRangeKm ? Number(maxRangeKm) : undefined,
          maintenanceIntervalHours: maintenanceIntervalHours ? Number(maintenanceIntervalHours) : undefined,
        });
      }
      resetForm();
      refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el dron.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteDrone(id: string) {
    setBusyId(id);
    setRowError(null);
    try {
      await deleteDrone(id);
      refetch();
    } catch (err) {
      setRowError(
        err instanceof Error && err.message === 'drone_not_idle'
          ? 'Solo se puede eliminar un dron que esté inactivo (idle).'
          : err instanceof Error
            ? err.message
            : 'No se pudo eliminar el dron.'
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleReturnToHome(id: string) {
    setBusyId(id);
    setRowError(null);
    try {
      await returnDroneToHome(id);
      refetch();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'No se pudo enviar a la base.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleEmergencyStop(id: string) {
    if (!window.confirm('¿Confirmas la parada de emergencia? El dron se detendrá donde esté.')) return;
    setBusyId(id);
    setRowError(null);
    try {
      await emergencyStopDrone(id);
      refetch();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'No se pudo detener el dron.');
    } finally {
      setBusyId(null);
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
      <h1 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-100">Configuración</h1>

      <section className={`mb-6 ${cardClass}`}>
        <h2 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Ajustes de vuelo</h2>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Se aplican de inmediato — no hace falta redeployar.
        </p>
        {!settings ? (
          <div className="text-sm text-gray-500 dark:text-slate-400">Cargando...</div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Altura de vuelo por defecto (m)</label>
              <input
                type="number"
                min={1}
                disabled={!isAdmin}
                value={settings.default_altitude_m}
                onChange={(e) => updateSettingField('default_altitude_m', Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Espera de descarga en destino (s)</label>
              <input
                type="number"
                min={0}
                disabled={!isAdmin}
                value={settings.discharge_seconds}
                onChange={(e) => updateSettingField('discharge_seconds', Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Consumo de batería (%/min, simulación)</label>
              <input
                type="number"
                min={0}
                step={0.1}
                disabled={!isAdmin}
                value={settings.battery_drain_pct_per_min}
                onChange={(e) => updateSettingField('battery_drain_pct_per_min', Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Reserva mínima de batería (%)</label>
              <input
                type="number"
                min={0}
                max={90}
                disabled={!isAdmin}
                value={settings.low_battery_reserve_pct}
                onChange={(e) => updateSettingField('low_battery_reserve_pct', Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Viento máximo para despachar (km/h)</label>
              <input
                type="number"
                min={0}
                disabled={!isAdmin}
                value={settings.max_wind_kmh}
                onChange={(e) => updateSettingField('max_wind_kmh', Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Precipitación máxima para despachar (mm)</label>
              <input
                type="number"
                min={0}
                step={0.1}
                disabled={!isAdmin}
                value={settings.max_precipitation_mm}
                onChange={(e) => updateSettingField('max_precipitation_mm', Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Velocidad de carga (%/min)</label>
              <input
                type="number"
                min={0}
                step={0.1}
                disabled={!isAdmin}
                value={settings.battery_charge_pct_per_min}
                onChange={(e) => updateSettingField('battery_charge_pct_per_min', Number(e.target.value))}
                className={inputClass}
              />
            </div>
          </div>
        )}
        {isAdmin ? (
          <div className="mt-3 flex items-center gap-3">
            <button onClick={handleSaveSettings} disabled={!settings || settingsSaving} className={primaryButtonClass}>
              {settingsSaving ? 'Guardando...' : 'Guardar ajustes'}
            </button>
            {settingsSaved && (
              <span className="text-sm text-emerald-600 dark:text-emerald-400">Guardado — ya está activo.</span>
            )}
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
            Solo un administrador puede cambiar estos ajustes.
          </p>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Flota de drones</h2>
          {isAdmin && !showForm && (
            <button onClick={() => setShowForm(true)} className={primaryButtonClass}>
              Nuevo dron
            </button>
          )}
        </div>

        {canEditDrones && showForm && (
          <div className={`mb-4 max-w-lg ${cardClass}`}>
            <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              {editingId ? 'Editar dron' : 'Nuevo dron'}
            </h3>
            <label className={labelClass}>Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={`mb-3 ${inputClass}`} />
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>N° de serie</label>
                <input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Modelo</label>
                <input value={model} onChange={(e) => setModel(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Velocidad máx. (m/s)</label>
                <input
                  type="number"
                  min={0}
                  value={maxSpeedMps}
                  onChange={(e) => setMaxSpeedMps(e.target.value)}
                  placeholder="15"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Autonomía (km)</label>
                <input
                  type="number"
                  min={0}
                  value={maxRangeKm}
                  onChange={(e) => setMaxRangeKm(e.target.value)}
                  placeholder="10"
                  className={inputClass}
                />
              </div>
            </div>
            <label className={labelClass}>Intervalo de mantención (horas de vuelo)</label>
            <input
              type="number"
              min={1}
              value={maintenanceIntervalHours}
              onChange={(e) => setMaintenanceIntervalHours(e.target.value)}
              placeholder="100"
              className={`mb-3 ${inputClass}`}
            />
            <label className={labelClass}>Base de origen</label>
            <select value={homeBaseId} onChange={(e) => setHomeBaseId(e.target.value)} className={`mb-3 ${inputClass}`}>
              <option value="">{editingId ? 'Sin cambios' : 'Elige una base...'}</option>
              {bases.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            {bases.length === 0 && (
              <p className="mb-3 text-xs text-amber-600 dark:text-amber-400">
                Todavía no hay bases creadas — anda a "Bases" y crea una primero.
              </p>
            )}
            {formError && <div className="mb-3 text-sm text-red-600 dark:text-red-400">{formError}</div>}
            <div className="flex gap-2">
              <button onClick={handleSubmitDrone} disabled={submitting} className={primaryButtonClass}>
                {submitting ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Guardar dron'}
              </button>
              <button
                onClick={resetForm}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {loading && <div className="text-sm text-gray-500 dark:text-slate-400">Cargando drones...</div>}
        {error && <div className="text-sm text-red-600 dark:text-red-400">Error: {error}</div>}
        {rowError && <div className="mb-3 text-sm text-red-600 dark:text-red-400">{rowError}</div>}
        {!loading && !error && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2">Nombre</th>
                  <th className="px-4 py-2">N° de serie</th>
                  <th className="px-4 py-2">Modelo</th>
                  <th className="px-4 py-2">Estado</th>
                  <th className="px-4 py-2">Velocidad</th>
                  <th className="px-4 py-2">Autonomía</th>
                  <th className="px-4 py-2">Horas de vuelo</th>
                  <th className="px-4 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {drones.map((d) => {
                  const busy = busyId === d.id;
                  const canDelete = d.status === 'idle';
                  const canRecall = RECALLABLE_STATUSES.includes(d.status);
                  const flightHours = Number(d.total_flight_seconds) / 3600;
                  const maintenanceDue = flightHours >= Number(d.maintenance_interval_hours);
                  return (
                    <tr key={d.id}>
                      <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">{d.name}</td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{d.serial_number ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{d.model ?? '—'}</td>
                      <td className="px-4 py-2 uppercase text-slate-500 dark:text-slate-400">{d.status}</td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{Number(d.max_speed_mps)} m/s</td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{Number(d.max_range_km)} km</td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                        {flightHours.toFixed(1)} / {Number(d.maintenance_interval_hours).toFixed(0)} h
                        {maintenanceDue && (
                          <span className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                            Mantención
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-2">
                          {canEditDrones && (
                            <button disabled={busy} onClick={() => startEdit(d)} className={secondaryButtonClass}>
                              Editar
                            </button>
                          )}
                          {canRecall && (
                            <button
                              disabled={busy}
                              onClick={() => handleReturnToHome(d.id)}
                              className="rounded bg-brand px-2 py-1 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50"
                            >
                              Volver a base
                            </button>
                          )}
                          {canRecall && (
                            <button
                              disabled={busy}
                              onClick={() => handleEmergencyStop(d.id)}
                              className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
                            >
                              Parada de emergencia
                            </button>
                          )}
                          {isAdmin && canDelete && (
                            <button disabled={busy} onClick={() => handleDeleteDrone(d.id)} className={secondaryButtonClass}>
                              Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {drones.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-4 text-center text-slate-400 dark:text-slate-500">
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
