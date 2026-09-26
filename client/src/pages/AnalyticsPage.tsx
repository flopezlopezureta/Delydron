import { useEffect, useState } from 'react';
import { getAnalytics, type AnalyticsSummary } from '../api/analytics';
import { MISSION_STATUS_LABELS } from '../components/missions/MissionStatusBadge';
import { ABORT_REASON_LABELS, type MissionStatus } from '../types';

const STATUS_BAR_COLORS: Record<MissionStatus, string> = {
  draft: 'bg-slate-400',
  scheduled: 'bg-sky-500',
  assigned: 'bg-indigo-500',
  in_progress: 'bg-blue-600',
  completed: 'bg-green-600',
  aborted: 'bg-amber-500',
  failed: 'bg-red-600',
};

function formatDuration(totalSeconds: number | string | null): string {
  if (totalSeconds == null) return '—';
  const s = Math.round(Number(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

// technician's whole reason for this role existing (see UsersPage/roles):
// read-only performance analysis across missions and drones, no dispatch
// access. Plain CSS bars instead of a charting library — a handful of
// categories each, not worth a new dependency for this.
export function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAnalytics()
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar la analítica.'));
  }, []);

  if (error) {
    return <div className="p-4 text-sm text-red-600">Error: {error}</div>;
  }
  if (!summary) {
    return <div className="p-4 text-sm text-gray-500">Cargando analítica...</div>;
  }

  const totalMissions = summary.missionStatusBreakdown.reduce((sum, s) => sum + s.count, 0);
  const totalFinished = summary.missionStatusBreakdown
    .filter((s) => ['completed', 'aborted', 'failed'].includes(s.status))
    .reduce((sum, s) => sum + s.count, 0);
  const completedCount = summary.missionStatusBreakdown.find((s) => s.status === 'completed')?.count ?? 0;
  const successRate = totalFinished > 0 ? (completedCount / totalFinished) * 100 : null;
  const maxStatusCount = Math.max(1, ...summary.missionStatusBreakdown.map((s) => s.count));
  const maxReasonCount = Math.max(1, ...summary.abortReasonBreakdown.map((r) => r.count));

  return (
    <div className="h-full overflow-y-auto p-4">
      <h1 className="mb-4 text-lg font-semibold text-slate-800">Analítica</h1>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-center">
          <div className="text-2xl font-semibold text-slate-800">{totalMissions}</div>
          <div className="text-xs text-slate-500">Misiones totales</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-center">
          <div className="text-2xl font-semibold text-slate-800">
            {successRate != null ? `${successRate.toFixed(0)}%` : '—'}
          </div>
          <div className="text-xs text-slate-500">Tasa de éxito (de {totalFinished} finalizadas)</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-center">
          <div className="text-2xl font-semibold text-slate-800">{summary.totalDeliveries}</div>
          <div className="text-xs text-slate-500">Entregas confirmadas</div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Misiones por estado</h2>
          <div className="space-y-2">
            {summary.missionStatusBreakdown.map((s) => (
              <div key={s.status} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0 text-slate-600">{MISSION_STATUS_LABELS[s.status]}</span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-slate-100">
                  <div
                    className={`h-full ${STATUS_BAR_COLORS[s.status]}`}
                    style={{ width: `${(s.count / maxStatusCount) * 100}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right font-medium text-slate-700">{s.count}</span>
              </div>
            ))}
            {summary.missionStatusBreakdown.length === 0 && (
              <p className="text-xs text-slate-400">Sin misiones todavía.</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Motivos de cancelación / falla</h2>
          <div className="space-y-2">
            {summary.abortReasonBreakdown.map((r) => (
              <div key={r.abort_reason_code} className="flex items-center gap-2 text-xs">
                <span
                  className="w-32 shrink-0 truncate text-slate-600"
                  title={ABORT_REASON_LABELS[r.abort_reason_code] ?? r.abort_reason_code}
                >
                  {ABORT_REASON_LABELS[r.abort_reason_code] ?? r.abort_reason_code}
                </span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-slate-100">
                  <div className="h-full bg-red-400" style={{ width: `${(r.count / maxReasonCount) * 100}%` }} />
                </div>
                <span className="w-8 shrink-0 text-right font-medium text-slate-700">{r.count}</span>
              </div>
            ))}
            {summary.abortReasonBreakdown.length === 0 && (
              <p className="text-xs text-slate-400">Sin cancelaciones ni fallas registradas.</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Rendimiento por dron</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Dron</th>
                <th className="px-3 py-2">Completadas</th>
                <th className="px-3 py-2">Abortadas</th>
                <th className="px-3 py-2">Fallidas</th>
                <th className="px-3 py-2">Tasa de éxito</th>
                <th className="px-3 py-2">Duración promedio</th>
                <th className="px-3 py-2">Horas de vuelo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.dronePerformance.map((d) => {
                const rate = d.total_finished > 0 ? (d.completed / d.total_finished) * 100 : null;
                return (
                  <tr key={d.id}>
                    <td className="px-3 py-2 font-medium text-slate-800">{d.name}</td>
                    <td className="px-3 py-2 text-slate-600">{d.completed}</td>
                    <td className="px-3 py-2 text-slate-600">{d.aborted}</td>
                    <td className="px-3 py-2 text-slate-600">{d.failed}</td>
                    <td className="px-3 py-2 text-slate-600">{rate != null ? `${rate.toFixed(0)}%` : '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{formatDuration(d.avg_flight_seconds)}</td>
                    <td className="px-3 py-2 text-slate-600">{(Number(d.total_flight_seconds) / 3600).toFixed(1)} h</td>
                  </tr>
                );
              })}
              {summary.dronePerformance.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-slate-400">
                    No hay drones registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
