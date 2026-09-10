import { useEffect, useState } from 'react';
import { apiBaseUrl, getToken } from '../api/client';
import type { TelemetryPayload, MissionStatusPayload } from '../types';

export function useFleetTelemetry() {
  const [telemetryByDrone, setTelemetryByDrone] = useState<Record<string, TelemetryPayload>>({});
  const [missionStatusById, setMissionStatusById] = useState<Record<string, MissionStatusPayload>>({});

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const url = `${apiBaseUrl()}/api/telemetry/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    es.addEventListener('TELEMETRY', (event) => {
      const payload: TelemetryPayload = JSON.parse((event as MessageEvent).data);
      setTelemetryByDrone((prev) => ({ ...prev, [payload.droneId]: payload }));
    });

    es.addEventListener('MISSION_STATUS', (event) => {
      const payload: MissionStatusPayload = JSON.parse((event as MessageEvent).data);
      setMissionStatusById((prev) => ({ ...prev, [payload.missionId]: payload }));
    });

    return () => es.close();
  }, []);

  return { telemetryByDrone, missionStatusById };
}
