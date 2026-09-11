import { apiFetch } from './client';
import type { Delivery } from '../types';

export function listDeliveries(): Promise<Delivery[]> {
  return apiFetch<Delivery[]>('/api/deliveries');
}
