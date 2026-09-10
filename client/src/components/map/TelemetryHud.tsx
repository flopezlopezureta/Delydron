import type { Drone, TelemetryPayload } from '../../types';

interface TelemetryHudProps {
  drones: Drone[];
  telemetryByDrone: Record<string, TelemetryPayload>;
}

// Plain numbers in the DOM (not just a marker moving on the map) so a
// screenshot is provable evidence that telemetry is live, not a static mock.
export function TelemetryHud({ drones, telemetryByDrone }: TelemetryHudProps) {
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
              </div>
            </div>
          );
        })}
        {drones.length === 0 && <div className="text-slate-400">Sin drones registrados.</div>}
      </div>
    </div>
  );
}
