import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getPublicTracking } from '../api/track';
import { TrackingMiniMap } from '../components/map/TrackingMiniMap';
import { ABORT_REASON_LABELS, type PublicTracking } from '../types';

const POLL_MS = 4000;

const STATUS_LABELS: Record<string, string> = {
  draft: 'Preparando el envío',
  scheduled: 'Programada',
  assigned: 'Dron asignado, por despachar',
  in_progress: 'En camino',
  completed: 'Entregado',
  aborted: 'Cancelada',
  failed: 'No se pudo completar',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  scheduled: 'bg-slate-100 text-slate-700',
  assigned: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  aborted: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
};

// Public, unauthenticated page — no NavBar/login, reachable straight from a
// link shared with a client (see the "Copiar link de seguimiento" button in
// MissionTable). Polls instead of using the SSE stream on purpose: that
// stream is behind a JWT and broadcasts the whole fleet, neither of which
// belongs on a page anyone with the link can open.
export function TrackingPage() {
  const { token } = useParams<{ token: string }>();
  const [tracking, setTracking] = useState<PublicTracking | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    function poll() {
      getPublicTracking(token!)
        .then((data) => {
          if (!cancelled) setTracking(data);
        })
        .catch(() => {
          if (!cancelled) setNotFound(true);
        });
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token]);

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-sm text-center">
          <h1 className="mb-2 text-lg font-semibold text-slate-800">Delydron</h1>
          <p className="text-sm text-slate-500">No encontramos esta misión. Verifica que el link esté completo.</p>
        </div>
      </div>
    );
  }

  if (!tracking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <p className="text-sm text-slate-500">Cargando seguimiento...</p>
      </div>
    );
  }

  const deliveredCount = tracking.deliveries.length;
  const totalCount = tracking.waypoints.length;

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-lg">
        <header className="mb-4 text-center">
          <h1 className="text-lg font-semibold text-slate-800">Delydron</h1>
          <p className="text-xs text-slate-400">Seguimiento de envío por dron</p>
        </header>

        <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-sm text-slate-700">{tracking.code}</span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                STATUS_COLORS[tracking.status] ?? 'bg-slate-100 text-slate-700'
              }`}
            >
              {STATUS_LABELS[tracking.status] ?? tracking.status}
            </span>
          </div>
          {tracking.abortReasonCode && (
            <p className="text-xs text-slate-500">
              Motivo: {ABORT_REASON_LABELS[tracking.abortReasonCode] ?? tracking.abortReasonCode}
            </p>
          )}
          {tracking.droneName && tracking.status === 'in_progress' && (
            <p className="text-xs text-slate-500">Dron: {tracking.droneName}</p>
          )}
          <p className="mt-1 text-xs text-slate-400">
            {deliveredCount}/{totalCount} destinos entregados
          </p>
        </div>

        <div className="mb-4 overflow-hidden rounded-lg border border-slate-200">
          <TrackingMiniMap tracking={tracking} />
        </div>

        {tracking.live && (
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-white p-4 text-center text-sm">
            <div>
              <div className="text-xs text-slate-400">Batería</div>
              <div className="font-semibold text-slate-700">{tracking.live.batteryPct.toFixed(0)}%</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Estado del dron</div>
              <div className="font-semibold text-slate-700">{tracking.live.status}</div>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Entregas confirmadas</h2>
          {tracking.deliveries.length === 0 ? (
            <p className="text-sm text-slate-400">Todavía no hay entregas confirmadas.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {tracking.deliveries.map((d) => (
                <li key={d.confirmationCode ?? `${d.waypointSeq}-${d.deliveredAt}`} className="py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-700">{d.packageDesc || `Destino #${d.waypointSeq}`}</span>
                    <span className="text-xs text-slate-400">{new Date(d.deliveredAt).toLocaleString('es-CL')}</span>
                  </div>
                  {d.confirmationCode && (
                    <div className="mt-0.5 font-mono text-xs text-slate-400">Código: {d.confirmationCode}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
