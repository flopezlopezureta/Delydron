import { apiFetch } from './client';
import type { Base } from '../types';

export interface BaseInput {
  name: string;
  address?: string;
  lat: number;
  lon: number;
}

export function listBases(): Promise<Base[]> {
  return apiFetch<Base[]>('/api/bases');
}

export function createBase(input: BaseInput): Promise<Base> {
  return apiFetch<Base>('/api/bases', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateBase(id: string, input: Partial<BaseInput>): Promise<Base> {
  return apiFetch<Base>(`/api/bases/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteBase(id: string): Promise<void> {
  return apiFetch<void>(`/api/bases/${id}`, { method: 'DELETE' });
}
