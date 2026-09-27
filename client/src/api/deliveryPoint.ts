import { apiFetch } from './client';
import type { DeliveryPointInfo } from '../types';

// Public endpoint — the token is the only credential (see routes/deliveryPoint.js).
// This is the PEC (punto de entrega cliente) flow: the customer views/adjusts
// the exact drop-off point for their own package via this link.
export function getDeliveryPoint(token: string): Promise<DeliveryPointInfo> {
  return apiFetch<DeliveryPointInfo>(`/api/pe/${encodeURIComponent(token)}`, {
    skipAuthRedirect: true,
  });
}

export function confirmDeliveryPoint(token: string, lat: number, lon: number): Promise<DeliveryPointInfo> {
  return apiFetch<DeliveryPointInfo>(`/api/pe/${encodeURIComponent(token)}`, {
    method: 'PATCH',
    body: JSON.stringify({ lat, lon }),
    skipAuthRedirect: true,
  });
}
