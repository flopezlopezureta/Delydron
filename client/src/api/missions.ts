import { apiFetch } from './client';
import type { AbortReasonCode, Mission, MissionCertificate, Waypoint } from '../types';

export interface MissionInput {
  droneId?: string | null;
  priority?: number;
  waypoints?: Waypoint[];
  payloadDesc?: string;
  pickupBaseId?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  returnBaseId?: string | null;
  notes?: string;
}

export function listMissions(status?: string): Promise<Mission[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiFetch<Mission[]>(`/api/missions${query}`);
}

export function getMission(id: string): Promise<Mission> {
  return apiFetch<Mission>(`/api/missions/${id}`);
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

export function abortMission(id: string, reasonCode: AbortReasonCode, reason?: string): Promise<Mission> {
  return apiFetch<Mission>(`/api/missions/${id}/abort`, {
    method: 'POST',
    body: JSON.stringify({ reasonCode, reason }),
  });
}

export function getMissionCertificate(id: string): Promise<MissionCertificate> {
  return apiFetch<MissionCertificate>(`/api/missions/${id}/certificate`);
}
