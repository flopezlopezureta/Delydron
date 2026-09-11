import { apiFetch } from './client';
import type { Mission, Waypoint } from '../types';

export interface MissionInput {
  droneId?: string | null;
  priority?: number;
  waypoints?: Waypoint[];
  payloadDesc?: string;
  pickupBaseId?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  notes?: string;
}

export function listMissions(): Promise<Mission[]> {
  return apiFetch<Mission[]>('/api/missions');
}

export function createMission(input: MissionInput): Promise<Mission> {
  return apiFetch<Mission>('/api/missions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateMission(id: string, input: MissionInput): Promise<Mission> {
  return apiFetch<Mission>(`/api/missions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteMission(id: string): Promise<void> {
  return apiFetch<void>(`/api/missions/${id}`, { method: 'DELETE' });
}

export function dispatchMission(id: string): Promise<Mission> {
  return apiFetch<Mission>(`/api/missions/${id}/dispatch`, { method: 'POST' });
}

export function abortMission(id: string): Promise<Mission> {
  return apiFetch<Mission>(`/api/missions/${id}/abort`, { method: 'POST' });
}
