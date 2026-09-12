import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMissions } from '../hooks/useMissions';
import { useDrones } from '../hooks/useDrones';
import { useBases } from '../hooks/useBases';
import { useFleetTelemetry } from '../hooks/useFleetTelemetry';
import { MissionTable } from '../components/missions/MissionTable';

const FILTERS: { label: string; status?: string }[] = [
  { label: 'Pendientes', status: 'draft,scheduled,assigned' },
  { label: 'En vuelo', status: 'in_progress' },
  { label: 'Completadas', status: 'completed' },
  { label: 'Canceladas', status: 'aborted' },
  { label: 'Fallidas', status: 'failed' },
  { label: 'Todas', status: undefined },
];

export function MissionsPage() {
  const [filter, setFilter] = useState<string | undefined>(FILTERS[0].status);
  const { missions, loading, error, refetch } = useMissions(filter);
  const { drones } = useDrones();
  const { bases } = useBases();
  const { missionStatusById } = useFleetTelemetry();

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">Misiones</h1>
        <Link
          to="/missions/new"
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Nueva misión
        </Link>
      </div>

      <div className="mb-4 flex gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setFilter(f.status)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filter === f.status
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <div className="text-sm text-gray-500">Cargando misiones...</div>}
      {error && <div className="text-sm text-red-600">Error: {error}</div>}
      {!loading && !error && (
        <MissionTable
          missions={missions}
          drones={drones}
          bases={bases}
          liveStatusById={missionStatusById}
          onChanged={refetch}
        />
      )}
    </div>
  );
}
