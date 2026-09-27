import { useState } from 'react';
import type { Waypoint } from '../../types';
import { ShareTrackingLinkDialog } from './ShareTrackingLinkDialog';

interface WaypointListProps {
  waypoints: Waypoint[];
  onAltitudeChange: (index: number, altM: number) => void;
  onPackageChange: (index: number, packageDesc: string) => void;
  onRemove: (index: number) => void;
  onReorder: (index: number, direction: -1 | 1) => void;
}

export function WaypointList({ waypoints, onAltitudeChange, onPackageChange, onRemove, onReorder }: WaypointListProps) {
  // peToken only exists once the mission has been saved at least once (it's
  // generated server-side on first save), so this stays null until then —
  // there's nothing to share for a destination that isn't persisted yet.
  const [shareTarget, setShareTarget] = useState<Waypoint | null>(null);

  if (waypoints.length === 0) {
    return <div className="text-sm text-slate-400 dark:text-slate-500">Haz clic en el mapa para agregar destinos.</div>;
  }

  return (
    <>
    <ul className="space-y-2">
      {waypoints.map((wp, index) => (
        <li key={index} className="rounded border border-slate-200 p-2 text-sm dark:border-slate-700">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">
              {wp.seq}
            </span>
            <div className="flex shrink-0 flex-col">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => onReorder(index, -1)}
                className="leading-none text-slate-400 hover:text-slate-700 disabled:opacity-25 dark:text-slate-500 dark:hover:text-slate-200"
                title="Mover antes"
              >
                ▲
              </button>
              <button
                type="button"
                disabled={index === waypoints.length - 1}
                onClick={() => onReorder(index, 1)}
                className="leading-none text-slate-400 hover:text-slate-700 disabled:opacity-25 dark:text-slate-500 dark:hover:text-slate-200"
                title="Mover después"
              >
                ▼
              </button>
            </div>
            <span className="min-w-0 flex-1 text-xs text-slate-600 dark:text-slate-300">
              {wp.address ? (
                <span className="block truncate" title={wp.address}>
                  {wp.address}
                </span>
              ) : (
                <span className="font-mono">
                  {wp.lat.toFixed(5)}, {wp.lon.toFixed(5)}
                </span>
              )}
            </span>
            <label className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              alt(m)
              <input
                type="number"
                min={0}
                value={wp.alt_m}
                onChange={(e) => onAltitudeChange(index, Number(e.target.value))}
                className="w-16 rounded border border-slate-300 bg-white px-1 py-0.5 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
            {wp.peToken && (
              <button
                type="button"
                onClick={() => setShareTarget(wp)}
                className="shrink-0 rounded px-1.5 py-0.5 text-xs text-brand hover:bg-blue-50 dark:hover:bg-blue-950/40"
                title="Copiar link para que el cliente confirme su punto de entrega (PEC)"
              >
                Link PEC
              </button>
            )}
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="rounded px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              Quitar
            </button>
          </div>
          <input
            value={wp.package_desc ?? ''}
            onChange={(e) => onPackageChange(index, e.target.value)}
            placeholder="Descripción del paquete para este destino"
            className="mt-2 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </li>
      ))}
    </ul>
    {shareTarget && shareTarget.peToken && (
      <ShareTrackingLinkDialog
        missionCode={null}
        title={`Link PEC — destino #${shareTarget.seq}`}
        description="El cliente usa este link para confirmar o ajustar dónde exactamente quiere recibir este paquete."
        url={`${window.location.origin}/pec/${shareTarget.peToken}`}
        onClose={() => setShareTarget(null)}
      />
    )}
    </>
  );
}
