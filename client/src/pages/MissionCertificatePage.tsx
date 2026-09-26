import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getMissionCertificate } from '../api/missions';
import { MISSION_STATUS_LABELS } from '../components/missions/MissionStatusBadge';
import { ABORT_REASON_LABELS, type MissionCertificate } from '../types';

const ACTION_LABELS: Record<string, string> = {
  'mission.dispatch': 'Despacho de misión',
  'mission.abort': 'Cancelación de misión',
  'system.low_battery_diversion': 'Retorno automático por batería baja',
  'system.battery_depleted': 'Batería agotada en vuelo',
  'system.maintenance_due': 'Dron marcado para mantención',
};

// Printable record for a finished mission — "prove this delivery happened
// correctly" for a client or the DGAC. window.print() -> "Guardar como PDF"
// covers the export need without a server-side PDF-generation dependency.
export function MissionCertificatePage() {
  const { id } = useParams<{ id: string }>();
  const [cert, setCert] = useState<MissionCertificate | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getMissionCertificate(id)
      .then(setCert)
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar el certificado.'));
  }, [id]);

  if (error) return <div className="p-4 text-sm text-red-600">Error: {error}</div>;
  if (!cert) return <div className="p-4 text-sm text-gray-500">Cargando certificado...</div>;

  return (
    <div className="mx-auto max-w-2xl p-6 print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <h1 className="text-lg font-semibold text-slate-800">Certificado de misión</h1>
        <button
          onClick={() => window.print()}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Imprimir / Guardar como PDF
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 print:border-0 print:shadow-none">
        <div className="mb-4 flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <div className="text-xl font-semibold text-slate-800">Delydrone</div>
            <div className="text-sm text-slate-500">Certificado de misión</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm text-slate-700">{cert.code}</div>
            <div className="text-xs text-slate-500">{MISSION_STATUS_LABELS[cert.status]}</div>
          </div>
        </div>

        <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Dron</dt>
            <dd className="text-slate-800">
              {cert.droneName ?? '—'} {cert.droneModel ? `(${cert.droneModel})` : ''}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">N° de serie</dt>
            <dd className="text-slate-800">{cert.droneSerialNumber ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Retiro</dt>
            <dd className="text-slate-800">{cert.pickupBaseName ?? cert.pickupAddress ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Retorno</dt>
            <dd className="text-slate-800">{cert.returnBaseName ?? 'Base propia del dron'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Creada</dt>
            <dd className="text-slate-800">{new Date(cert.createdAt).toLocaleString('es-CL')}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Despachada</dt>
            <dd className="text-slate-800">
              {cert.startedAt ? new Date(cert.startedAt).toLocaleString('es-CL') : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Finalizada</dt>
            <dd className="text-slate-800">
              {cert.completedAt ? new Date(cert.completedAt).toLocaleString('es-CL') : '—'}
            </dd>
          </div>
          {cert.abortReasonCode && (
            <div>
              <dt className="text-xs text-slate-500">Motivo</dt>
              <dd className="text-slate-800">{ABORT_REASON_LABELS[cert.abortReasonCode] ?? cert.abortReasonCode}</dd>
            </div>
          )}
        </dl>

        <h2 className="mb-2 text-sm font-semibold text-slate-700">
          Destinos y entregas ({cert.deliveries.length}/{cert.waypoints.length})
        </h2>
        <table className="mb-6 w-full text-left text-xs">
          <thead className="text-slate-500">
            <tr>
              <th className="pb-1">#</th>
              <th className="pb-1">Destino</th>
              <th className="pb-1">Entregado</th>
              <th className="pb-1">Código</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cert.waypoints.map((wp) => {
              const delivery = cert.deliveries.find((d) => d.waypointSeq === wp.seq);
              return (
                <tr key={wp.seq}>
                  <td className="py-1">{wp.seq}</td>
                  <td className="py-1">
                    {wp.packageDesc || wp.address || `${wp.lat.toFixed(5)}, ${wp.lon.toFixed(5)}`}
                  </td>
                  <td className="py-1">
                    {delivery ? new Date(delivery.deliveredAt).toLocaleString('es-CL') : '—'}
                  </td>
                  <td className="py-1 font-mono">{delivery?.confirmationCode ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <h2 className="mb-2 text-sm font-semibold text-slate-700">Historial de auditoría</h2>
        {cert.auditEntries.length === 0 ? (
          <p className="text-xs text-slate-400">Sin eventos registrados.</p>
        ) : (
          <ul className="text-xs text-slate-600">
            {cert.auditEntries.map((a, i) => (
              <li key={i} className="border-b border-slate-100 py-1">
                {new Date(a.createdAt).toLocaleString('es-CL')} — {ACTION_LABELS[a.action] ?? a.action}
                {a.actorEmail ? ` (${a.actorEmail})` : ' (Sistema)'}
              </li>
            ))}
          </ul>
        )}

        {cert.notes && (
          <div className="mt-4 border-t border-slate-200 pt-4 text-xs text-slate-500">
            <span className="font-medium text-slate-600">Notas:</span> {cert.notes}
          </div>
        )}
      </div>
    </div>
  );
}
