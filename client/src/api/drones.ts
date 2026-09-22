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
  maintenanceIntervalHours?: number;
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

// droneService.update() reads these keys as snake_case directly (unlike
// create's camelCase) — matching the existing route/service as-is rather
// than changing its convention for this one endpoint.
export interface UpdateDroneInput {
  name?: string;
  serial_number?: string;
  model?: string;
  max_speed_mps?: number;
  max_range_km?: number;
  home_lat?: number;
  home_lon?: number;
  maintenance_interval_hours?: number;
}

export function updateDrone(id: string, input: UpdateDroneInput): Promise<Drone> {
  return apiFetch<Drone>(`/api/drones/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteDrone(id: string): Promise<void> {
  return apiFetch<void>(`/api/drones/${id}`, { method: 'DELETE' });
}

export function returnDroneToHome(id: string): Promise<Drone> {
  return apiFetch<Drone>(`/api/drones/${id}/return-to-home`, { method: 'POST' });
}

export function emergencyStopDrone(id: string): Promise<Drone> {
  return apiFetch<Drone>(`/api/drones/${id}/emergency-stop`, { method: 'POST' });
}
