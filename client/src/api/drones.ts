import { apiFetch } from './client';
import type { Drone } from '../types';

export interface DroneInput {
  name: string;
  serialNumber?: string;
  model?: string;
  homeLat: number;
  homeLon: number;
  maxSpeedMps?: number;
  maxRangeKm?: number;
}

export function listDrones(): Promise<Drone[]> {
  return apiFetch<Drone[]>('/api/drones');
}

export function getDrone(id: string): Promise<Drone> {
  return apiFetch<Drone>(`/api/drones/${id}`);
}

export function createDrone(input: DroneInput): Promise<Drone> {
  return apiFetch<Drone>('/api/drones', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
