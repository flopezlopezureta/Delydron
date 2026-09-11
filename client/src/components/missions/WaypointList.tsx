import type { Waypoint } from '../../types';

interface WaypointListProps {
  waypoints: Waypoint[];
  onAltitudeChange: (index: number, altM: number) => void;
  onPackageChange: (index: number, packageDesc: string) => void;
  onRemove: (index: number) => void;
}

export function WaypointList({ waypoints, onAltitudeChange, onPackageChange, onRemove }: WaypointListProps) {
  if (waypoints.length === 0) {
    return <div className="text-sm text-slate-400">Haz clic en el mapa para agregar destinos.</div>;
  }

  return (
    <ul className="space-y-2">
      {waypoints.map((wp, index) => (
        <li key={index} className="rounded border border-slate-200 p-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
              {wp.seq}
            </span>
            <span className="flex-1 font-mono text-xs text-slate-600">
              {wp.lat.toFixed(5)}, {wp.lon.toFixed(5)}
            </span>
            <label className="flex items-center gap-1 text-xs text-slate-500">
              alt(m)
              <input
                type="number"
                min={0}
                value={wp.alt_m}
                onChange={(e) => onAltitudeChange(index, Number(e.target.value))}
                className="w-16 rounded border border-slate-300 px-1 py-0.5"
              />
            </label>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="rounded px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50"
            >
              Quitar
            </button>
          </div>
          <input
            value={wp.package_desc ?? ''}
            onChange={(e) => onPackageChange(index, e.target.value)}
            placeholder="Descripción del paquete para este destino"
            className="mt-2 w-full rounded border border-slate-300 px-2 py-1 text-xs"
          />
        </li>
      ))}
    </ul>
  );
}
