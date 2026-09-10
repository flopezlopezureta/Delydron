import { apiFetch } from './client';
import type { Drone } from '../types';

export function listDrones(): Promise<Drone[]> {
  return apiFetch<Drone[]>('/api/drones');
}

export function getDrone(id: string): Promise<Drone> {
  return apiFetch<Drone>(`/api/drones/${id}`);
}
