import { useEffect, useState } from 'react';
import { useDrones } from '../hooks/useDrones';
import { useBases } from '../hooks/useBases';
import { useMissions } from '../hooks/useMissions';
import { useNoFlyZones } from '../hooks/useNoFlyZones';
import { useFleetTelemetry } from '../hooks/useFleetTelemetry';
import { getSettings, type Settings } from '../api/settings';
import { LiveMap } from '../components/map/LiveMap';
import { TelemetryHud } from '../components/map/TelemetryHud';
import { MissionSummaryBar } from '../components/missions/MissionSummaryBar';
import { WeatherStrip } from '../components/dashboard/WeatherStrip';
import { FleetCapacityBar } from '../components/dashboard/FleetCapacityBar';

export function DashboardPage() {
  const { drones, loading, error } = useDrones();
  const { bases } = useBases();
  const { missions } = useMissions();
  const { zones: noFlyZones } = useNoFlyZones();
  const { telemetryByDrone, liveDeliveries } = useFleetTelemetry();
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    getSettings().then(setSettings).catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500 dark:text-slate-400">
        Cargando flota...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-red-600 dark:text-red-400">Error: {error}</div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <LiveMap
        drones={drones}
        bases={bases}
        missions={missions}
        deliveries={liveDeliveries}
        telemetryByDrone={telemetryByDrone}
        noFlyZones={noFlyZones}
      />
      {/* A flex row (stacked on phone/tablet, side-by-side from `lg`) so the
          left group and TelemetryHud lay out next to each other instead of
          each owning a hardcoded corner — two independently-widthed absolute
          boxes anchored to opposite edges can grow into each other on a
          narrow screen; flex items along the same axis never can. */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-[1000] flex flex-col items-start gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col items-start gap-2">
          <MissionSummaryBar missions={missions} />
          {settings && (
            <WeatherStrip
              bases={bases}
              maxWindKmh={settings.max_wind_kmh}
              maxPrecipitationMm={settings.max_precipitation_mm}
            />
          )}
        </div>
        <TelemetryHud drones={drones} telemetryByDrone={telemetryByDrone} missions={missions} />
      </div>
      <FleetCapacityBar drones={drones} />
    </div>
  );
}
