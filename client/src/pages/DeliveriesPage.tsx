import { useEffect, useMemo, useState } from 'react';
import { listDeliveries } from '../api/deliveries';
import { useDrones } from '../hooks/useDrones';
import { useMissions } from '../hooks/useMissions';
import { useFleetTelemetry } from '../hooks/useFleetTelemetry';
import type { Delivery } from '../types';

export function DeliveriesPage() {
  const [initialDeliveries, setInitialDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { drones } = useDrones();
  const { missions } = useMissions();
  const { liveDeliveries } = useFleetTelemetry();

  useEffect(() => {
    listDeliveries()
      .then(setInitialDeliveries)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const droneNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const d of drones) map[d.id] = d.name;
    return map;
  }, [drones]);

  const missionCodeById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of missions) map[m.id] = m.code ?? m.id;
    return map;
  }, [missions]);

  const deliveries = useMemo(() => {
    const byId = new Map<string, Delivery>();
    for (const d of initialDeliveries) byId.set(d.id, d);
    for (const d of liveDeliveries) byId.set(d.id, d);
    return [...byId.values()].sort(
      (a, b) => new Date(b.delivered_at).getTime() - new Date(a.delivered_at).getTime()
    );
  }, [initialDeliveries, liveDeliveries]);

  return (
    <div className="h-full overflow-y-auto p-4">
      <h1 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-100">Historial de despachos</h1>

      {loading && <div className="text-sm text-gray-500 dark:text-slate-400">Cargando historial...</div>}
      {error && <div className="text-sm text-red-600 dark:text-red-400">Error: {error}</div>}
      {!loading && !error && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2">Fecha / hora</th>
                <th className="px-4 py-2">Misión</th>
                <th className="px-4 py-2">Dron</th>
                <th className="px-4 py-2">Destino</th>
                <th className="px-4 py-2">Ubicación</th>
                <th className="px-4 py-2">Paquete</th>
                <th className="px-4 py-2">Código de entrega</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {deliveries.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                    {new Date(d.delivered_at).toLocaleString('es-CL')}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {d.mission_code ?? (d.mission_id ? missionCodeById[d.mission_id] ?? d.mission_id : '—')}
                  </td>
                  <td className="px-4 py-2">
                    {d.drone_name ?? (d.drone_id ? droneNameById[d.drone_id] ?? d.drone_id : '—')}
                  </td>
                  <td className="px-4 py-2">#{d.waypoint_seq}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {d.lat.toFixed(5)}, {d.lon.toFixed(5)}
                  </td>
                  <td className="px-4 py-2">{d.package_desc ?? '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {d.confirmation_code ?? '—'}
                  </td>
                </tr>
              ))}
              {deliveries.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-4 text-center text-slate-400 dark:text-slate-500">
                    Todavía no hay despachos entregados.
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
