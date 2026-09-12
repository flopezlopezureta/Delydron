import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { abortMission, deleteMission, dispatchMission, updateMission } from '../../api/missions';
import { MissionStatusBadge } from './MissionStatusBadge';
import type { Base, Drone, Mission, MissionStatusPayload } from '../../types';

interface MissionTableProps {
  missions: Mission[];
  drones: Drone[];
  bases: Base[];
  liveStatusById: Record<string, MissionStatusPayload>;
  onChanged: () => void;
}

export function MissionTable({ missions, drones, bases, liveStatusById, onChanged }: MissionTableProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const idleDrones = useMemo(() => drones.filter((d) => d.status === 'idle'), [drones]);

  const droneNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const d of drones) map[d.id] = d.name;
    return map;
  }, [drones]);

  const baseNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const b of bases) map[b.id] = b.name;
    return map;
  }, [bases]);

  async function run(id: string, action: () => Promise<unknown>) {
    setError(null);
    setBusyId(id);
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La acción falló.');
    } finally {
      setBusyId(null);
    }
  }

  function handleCancel(m: Mission) {
    const reason = window.prompt('Motivo de la cancelación (opcional):');
    if (reason === null) return; // backed out of the prompt itself, not just left it blank
    run(m.id, () => abortMission(m.id, reason || undefined));
  }

  if (missions.length === 0) {
    return <div className="p-4 text-sm text-slate-400">No hay misiones todavía.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      {error && <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-2">Código</th>
            <th className="px-4 py-2">Dron</th>
            <th className="px-4 py-2">Estado</th>
            <th className="px-4 py-2">Prioridad</th>
            <th className="px-4 py-2">Retorno</th>
            <th className="px-4 py-2">Creada</th>
            <th className="px-4 py-2">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {missions.map((m) => {
            const status = liveStatusById[m.id]?.status ?? m.status;
            const canDispatch = ['draft', 'scheduled', 'assigned'].includes(status) && m.drone_id;
            const canCancel = ['draft', 'scheduled', 'assigned', 'in_progress'].includes(status);
            const canDelete = status === 'draft';
            const canRepeat = ['completed', 'aborted', 'failed'].includes(status);
            const canEdit = ['draft', 'scheduled', 'assigned'].includes(status);
            const busy = busyId === m.id;

            return (
              <tr key={m.id}>
                <td className="px-4 py-2 font-mono text-xs">{m.code}</td>
                <td className="px-4 py-2">
                  {canEdit ? (
                    <select
                      disabled={busy}
                      value={m.drone_id ?? ''}
                      onChange={(e) => run(m.id, () => updateMission(m.id, { droneId: e.target.value || null }))}
                      className="rounded border border-slate-300 px-1.5 py-1 text-xs disabled:opacity-50"
                    >
                      <option value="">Sin asignar</option>
                      {idleDrones.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>{m.drone_id ? droneNameById[m.drone_id] ?? m.drone_id : '—'}</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <MissionStatusBadge status={status} />
                </td>
                <td className="px-4 py-2">{m.priority}</td>
                <td className="px-4 py-2">
                  {canEdit ? (
                    <select
                      disabled={busy}
                      value={m.return_base_id ?? ''}
                      onChange={(e) =>
                        run(m.id, () => updateMission(m.id, { returnBaseId: e.target.value || null }))
                      }
                      className="rounded border border-slate-300 px-1.5 py-1 text-xs disabled:opacity-50"
                    >
                      <option value="">Base propia del dron</option>
                      {bases.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-slate-500">
                      {m.return_base_id ? baseNameById[m.return_base_id] ?? m.return_base_id : 'Base propia del dron'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-slate-500">{new Date(m.created_at).toLocaleString('es-CL')}</td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-2">
                    {canDispatch && (
                      <button
                        disabled={busy}
                        onClick={() => run(m.id, () => dispatchMission(m.id))}
                        className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                      >
                        Despachar
                      </button>
                    )}
                    {canEdit && (
                      <Link
                        to={`/missions/new?editId=${m.id}`}
                        className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        Editar
                      </Link>
                    )}
                    {canCancel && (
                      <button
                        disabled={busy}
                        onClick={() => handleCancel(m)}
                        className="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    )}
                    {canDelete && (
                      <button
                        disabled={busy}
                        onClick={() => run(m.id, () => deleteMission(m.id))}
                        className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Eliminar
                      </button>
                    )}
                    {canRepeat && (
                      <Link
                        to={`/missions/new?repeatFrom=${m.id}`}
                        className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-500"
                      >
                        Repetir
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
