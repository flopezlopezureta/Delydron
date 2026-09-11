import { useDrones } from '../hooks/useDrones';
import { useBases } from '../hooks/useBases';
import { useMissions } from '../hooks/useMissions';
import { useFleetTelemetry } from '../hooks/useFleetTelemetry';
import { LiveMap } from '../components/map/LiveMap';
import { TelemetryHud } from '../components/map/TelemetryHud';

export function DashboardPage() {
  const { drones, loading, error } = useDrones();
  const { bases } = useBases();
  const { missions } = useMissions();
  const { telemetryByDrone, liveDeliveries } = useFleetTelemetry();

  if (loading) {
    return <div className="flex h-full items-center justify-center text-gray-500">Cargando flota...</div>;
  }

  if (error) {
    return <div className="flex h-full items-center justify-center text-red-600">Error: {error}</div>;
  }

  return (
    <div className="relative h-full w-full">
      <LiveMap
        drones={drones}
        bases={bases}
        missions={missions}
        deliveries={liveDeliveries}
        telemetryByDrone={telemetryByDrone}
      />
      <TelemetryHud drones={drones} telemetryByDrone={telemetryByDrone} />
    </div>
  );
}
