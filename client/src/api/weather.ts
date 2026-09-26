import { apiFetch } from './client';

export interface Weather {
  windKmh: number;
  windGustsKmh: number;
  precipitationMm: number;
}

export function getWeather(lat: number, lon: number): Promise<Weather> {
  return apiFetch<Weather>(`/api/weather?lat=${lat}&lon=${lon}`);
}
