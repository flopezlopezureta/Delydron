import { apiFetch } from './client';
import type { AuditLogEntry } from '../types';

export function listAuditLog(params: { entityType?: string; entityId?: string; limit?: number } = {}): Promise<AuditLogEntry[]> {
  const query = new URLSearchParams();
  if (params.entityType) query.set('entityType', params.entityType);
  if (params.entityId) query.set('entityId', params.entityId);
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiFetch<AuditLogEntry[]>(`/api/audit${qs ? `?${qs}` : ''}`);
}
