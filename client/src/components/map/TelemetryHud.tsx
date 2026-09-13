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
  const missionById: Record<string, Mission> = {};
  for (const m of missions) missionById[m.id] = m;

  return (
    <div className="absolute right-3 top-3 z-[1000] w-72 rounded-lg bg-white/95 p-3 text-xs shadow-lg">
      <div className="mb-2 font-semibold text-slate-700">Telemetría en vivo</div>
      <div className="space-y-2">
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
            <div key={drone.id} className="rounded border border-slate-200 p-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-800">{drone.name}</span>
                <span className="uppercase text-slate-500">{status}</span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-x-2 text-slate-600">
                <span>lat: {lat?.toFixed(5)}</span>
                <span>lon: {lon?.toFixed(5)}</span>
                <span>batería: {battery?.toFixed(1)}%</span>
                <span>rumbo: {heading.toFixed(0)}°</span>
                <span>altitud: {altitude.toFixed(0)}m</span>
              </div>
              {elapsedSeconds !== null && (
                <div className="mt-1 grid grid-cols-2 gap-x-2 border-t border-slate-100 pt-1 text-slate-600">
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
        {drones.length === 0 && <div className="text-slate-400">Sin drones registrados.</div>}
      </div>
    </div>
  );
}
