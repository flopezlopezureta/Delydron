import { Link } from 'react-router-dom';
import { useMissions } from '../hooks/useMissions';
import { useDrones } from '../hooks/useDrones';
import { useBases } from '../hooks/useBases';
import { useFleetTelemetry } from '../hooks/useFleetTelemetry';
import { MissionTable } from '../components/missions/MissionTable';

export function MissionsPage() {
  const { missions, loading, error, refetch } = useMissions();
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
