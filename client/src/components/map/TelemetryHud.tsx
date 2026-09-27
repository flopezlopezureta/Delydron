import { useState } from 'react';
import type { Drone, Mission, TelemetryPayload } from '../../types';

interface TelemetryHudProps {
  drones: Drone[];
  telemetryByDrone: Record<string, TelemetryPayload>;
  missions: Mission[];
}

// m:ss — flight durations here run from seconds to a few minutes, never
// hours, so this is plenty and reads faster than an "Xm Ys" sentence.
function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

// Plain numbers in the DOM (not just a marker moving on the map) so a
// screenshot is provable evidence that telemetry is live, not a static mock.
export function TelemetryHud({ drones, telemetryByDrone, missions }: TelemetryHudProps) {
  // Collapsed by default below `lg` — a phone screen is barely wider than
  // this panel, and with several drones it can grow tall enough to bury the
  // map underneath it entirely if left expanded on load.
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches
  );

  const missionById: Record<string, Mission> = {};
  for (const m of missions) missionById[m.id] = m;

  return (
    <div
      className={`pointer-events-auto max-w-[calc(100vw-1.5rem)] rounded-lg bg-white/95 p-3 text-xs shadow-lg dark:bg-slate-900/95 ${
        collapsed ? '' : 'w-72'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-700 dark:text-slate-200">Telemetría en vivo</span>
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Mostrar telemetría' : 'Ocultar telemetría'}
          aria-expanded={!collapsed}
          className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className={`transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>
      {collapsed ? (
        <div className="mt-1 text-slate-400 dark:text-slate-500">
          {drones.length} {drones.length === 1 ? 'dron' : 'drones'}
        </div>
      ) : (
        <div className="mt-2 max-h-[55vh] space-y-2 overflow-y-auto pr-1">
          {drones.map((drone) => {
            const t = telemetryByDrone[drone.id];
            const lat = t?.lat ?? drone.lat ?? drone.home_lat;
            const lon = t?.lon ?? drone.lon ?? drone.home_lon;
            const battery = t?.batteryPct ?? Number(drone.battery_pct);
            const status = t?.status ?? drone.status;
            const heading = t?.headingDeg ?? Number(drone.heading_deg) ?? 0;
            const altitude = t?.altitudeM ?? Number(drone.altitude_m) ?? 0;

            const mission = t?.missionId ? missionById[t.missionId] : undefined;
            const elapsedSeconds = mission?.started_at
              ? (Date.now() - new Date(mission.started_at).getTime()) / 1000
              : null;

            return (
              <div key={drone.id} className="rounded border border-slate-200 p-2 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800 dark:text-slate-100">{drone.name}</span>
                  <span className="uppercase text-slate-500 dark:text-slate-400">{status}</span>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-x-2 text-slate-600 dark:text-slate-300">
                  <span>lat: {lat?.toFixed(5)}</span>
                  <span>lon: {lon?.toFixed(5)}</span>
                  <span>batería: {battery?.toFixed(1)}%</span>
                  <span>rumbo: {heading.toFixed(0)}°</span>
                  <span>altitud: {altitude.toFixed(0)}m</span>
                </div>
                {elapsedSeconds !== null && (
                  <div className="mt-1 grid grid-cols-2 gap-x-2 border-t border-slate-100 pt-1 text-slate-600 dark:border-slate-800 dark:text-slate-300">
                    <span>vuelo: {formatDuration(elapsedSeconds)}</span>
                    <span>
                      {t?.status === 'unloading' ? 'descarga' : t?.phase === 'returning' ? 'regreso' : 'a destino'}:{' '}
                      {t?.etaSeconds != null ? formatDuration(t.etaSeconds) : '—'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
          {drones.length === 0 && <div className="text-slate-400 dark:text-slate-500">Sin drones registrados.</div>}
        </div>
      )}
    </div>
  );
}
