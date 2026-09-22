import { apiFetch } from './client';
import type { NoFlyZone } from '../types';

export interface NoFlyZoneInput {
  name: string;
  lat: number;
  lon: number;
  radiusM: number;
  notes?: string;
}

export function listNoFlyZones(): Promise<NoFlyZone[]> {
  return apiFetch<NoFlyZone[]>('/api/no-fly-zones');
}

export function createNoFlyZone(input: NoFlyZoneInput): Promise<NoFlyZone> {
  return apiFetch<NoFlyZone>('/api/no-fly-zones', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export interface UpdateNoFlyZoneInput {
  name?: string;
  lat?: number;
  lon?: number;
  radiusM?: number;
  active?: boolean;
  notes?: string;
}

export function updateNoFlyZone(id: string, input: UpdateNoFlyZoneInput): Promise<NoFlyZone> {
  return apiFetch<NoFlyZone>(`/api/no-fly-zones/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteNoFlyZone(id: string): Promise<void> {
  return apiFetch<void>(`/api/no-fly-zones/${id}`, { method: 'DELETE' });
}
