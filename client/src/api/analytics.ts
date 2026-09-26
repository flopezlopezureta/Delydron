import { apiFetch } from './client';
import type { AbortReasonCode, MissionStatus } from '../types';

export interface MissionStatusCount {
  status: MissionStatus;
  count: number;
}

export interface AbortReasonCount {
  abort_reason_code: AbortReasonCode;
  count: number;
}

export interface DronePerformance {
  id: string;
  name: string;
  total_flight_seconds: string | number;
  maintenance_interval_hours: string | number;
  completed: number;
  aborted: number;
  failed: number;
  total_finished: number;
  avg_flight_seconds: string | number | null;
}

export interface AnalyticsSummary {
  missionStatusBreakdown: MissionStatusCount[];
  abortReasonBreakdown: AbortReasonCount[];
  dronePerformance: DronePerformance[];
  totalDeliveries: number;
}

export function getAnalytics(): Promise<AnalyticsSummary> {
  return apiFetch<AnalyticsSummary>('/api/analytics');
}
