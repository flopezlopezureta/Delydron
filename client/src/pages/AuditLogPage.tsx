import { useEffect, useState } from 'react';
import { listAuditLog } from '../api/audit';
import type { AuditLogEntry } from '../types';

const ACTION_LABELS: Record<string, string> = {
  'mission.dispatch': 'Despacho de misión',
  'mission.abort': 'Cancelación de misión',
  'drone.return_to_home': 'Retorno a base (manual)',
  'drone.emergency_stop': 'Parada de emergencia',
  'user.create': 'Usuario creado',
  'user.update': 'Usuario editado',
  'user.role_change': 'Cambio de rol',
  'user.deactivate': 'Usuario desactivado',
  'system.low_battery_diversion': 'Retorno automático por batería baja',
  'system.battery_depleted': 'Batería agotada en vuelo',
  'system.maintenance_due': 'Dron marcado para mantención',
};

// Admin/super_admin only (see App.tsx route + NavBar link) — combines
// operator-attributed actions (dispatch/abort/role changes) with
// system-triggered safety events into one timeline, so "what happened to
// this mission/drone" never requires grepping free-text notes.
export function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAuditLog({ limit: 300 })
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar la auditoría.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full overflow-y-auto p-4">
      <h1 className="mb-1 text-lg font-semibold text-slate-800">Auditoría</h1>
      <p className="mb-4 text-xs text-slate-500">
        Quién despachó, canceló o modificó qué — incluye eventos automáticos de seguridad (batería, mantención).
      </p>

      {loading && <div className="text-sm text-gray-500">Cargando...</div>}
      {error && <div className="text-sm text-red-600">Error: {error}</div>}
      {!loading && !error && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Fecha / hora</th>
                <th className="px-4 py-2">Acción</th>
                <th className="px-4 py-2">Quién</th>
                <th className="px-4 py-2">Sobre</th>
                <th className="px-4 py-2">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2 text-slate-500">{new Date(e.created_at).toLocaleString('es-CL')}</td>
                  <td className="px-4 py-2 text-slate-700">{ACTION_LABELS[e.action] ?? e.action}</td>
                  <td className="px-4 py-2 text-slate-600">{e.actor_email ?? 'Sistema'}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">
                    {e.entity_type}
                    {e.entity_id ? ` · ${e.entity_id.slice(0, 8)}` : ''}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-400">
                    {e.detail ? JSON.stringify(e.detail) : '—'}
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-slate-400">
                    Todavía no hay actividad registrada.
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
