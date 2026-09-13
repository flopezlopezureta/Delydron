import { apiFetch } from './client';

export interface Settings {
  default_altitude_m: number;
  discharge_seconds: number;
  battery_drain_pct_per_min: number;
}

export function getSettings(): Promise<Settings> {
  return apiFetch<Settings>('/api/settings');
}

export function updateSettings(input: Partial<Settings>): Promise<Settings> {
  return apiFetch<Settings>('/api/settings', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
