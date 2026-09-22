export type UserRole = 'super_admin' | 'admin' | 'operator' | 'technician' | 'auxiliary';

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  operator: 'Operador',
  technician: 'Técnico',
  auxiliary: 'Auxiliar',
};

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

// Raw shape from /api/users (management list) — snake_case, unlike the
// camelCase `User` above which mirrors /api/auth/me's response instead.
export interface ManagedUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export type DroneStatus =
  | 'offline'
  | 'idle'
  | 'armed'
  | 'in_flight'
  | 'unloading'
  | 'returning'
  | 'charging'
  | 'maintenance'
  | 'error';

export interface Drone {
  id: string;
  name: string;
  serial_number: string | null;
  model: string | null;
  adapter_type: 'simulated' | 'mavlink' | 'dji';
  status: DroneStatus;
  battery_pct: string | number;
  lat: number | null;
  lon: number | null;
  altitude_m: string | number | null;
  heading_deg: string | number | null;
  speed_mps: string | number | null;
  home_lat: number;
  home_lon: number;
  max_speed_mps: string | number;
  max_range_km: string | number;
  last_seen_at: string | null;
  total_flight_seconds: string | number;
  maintenance_interval_hours: string | number;
}

export interface Base {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lon: number;
}

export type MissionStatus =
  | 'draft'
  | 'scheduled'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'aborted'
  | 'failed';

// A drone has one discharge gate per cargo bay — 4 bays, so at most 4
// destinations (deliveries) per mission.
export const MAX_DESTINATIONS_PER_MISSION = 4;

export interface Waypoint {
  seq: number;
  lat: number;
  lon: number;
  alt_m: number;
  package_desc?: string;
  action?: string;
  hold_s?: number;
}

// Mirrors missions_abort_reason_code_check in schema.sql / ABORT_REASON_CODES
// in utils/validation.js — kept in sync by hand across the three, they
// change together rarely enough that a shared-codegen step isn't worth it.
export type AbortReasonCode =
  | 'operator_abort'
  | 'emergency_stop'
  | 'return_to_home_manual'
  | 'low_battery_diversion'
  | 'battery_depleted'
  | 'hardware_fault'
  | 'payload_fault'
  | 'weather'
  | 'airspace_conflict'
  | 'other';

export const ABORT_REASON_LABELS: Record<AbortReasonCode, string> = {
  operator_abort: 'Cancelada por el operador',
  emergency_stop: 'Parada de emergencia',
  return_to_home_manual: 'Retorno a base manual',
  low_battery_diversion: 'Retorno automático por batería baja',
  battery_depleted: 'Batería agotada en vuelo',
  hardware_fault: 'Falla de hardware',
  payload_fault: 'Falla en la carga/compuerta',
  weather: 'Condiciones climáticas',
  airspace_conflict: 'Conflicto de espacio aéreo',
  other: 'Otro motivo',
};

export interface Mission {
  id: string;
  code: string | null;
  drone_id: string | null;
  status: MissionStatus;
  priority: number;
  waypoints: Waypoint[];
  payload_desc: string | null;
  pickup_base_id: string | null;
  pickup_address: string | null;
  dropoff_address: string | null;
  return_base_id: string | null;
  current_waypoint_seq: number;
  tracking_token: string | null;
  abort_reason_code: AbortReasonCode | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface TelemetryPayload {
  droneId: string;
  missionId: string | null;
  lat: number;
  lon: number;
  altitudeM: number;
  headingDeg: number;
  speedMps: number;
  batteryPct: number;
  status: DroneStatus;
  phase?: 'delivering' | 'returning' | null;
  etaSeconds?: number | null;
  arrived?: boolean;
}

export interface MissionStatusPayload {
  missionId: string;
  droneId: string | null;
  status: MissionStatus;
}

// Matches the raw `deliveries` DB row (snake_case) — both the REST list
// endpoint and the live SSE 'DELIVERY' event use this same shape. The SSE
// event just won't have mission_code/drone_name populated (no join there);
// pages resolve those from their already-loaded missions/drones lists.
export interface Delivery {
  id: string;
  mission_id: string | null;
  drone_id: string | null;
  waypoint_seq: number;
  lat: number;
  lon: number;
  package_desc: string | null;
  delivered_at: string;
  confirmation_code: string | null;
  mission_code?: string | null;
  drone_name?: string | null;
}

// Shape of GET /api/track/:token — the public, unauthenticated view of a
// mission. Deliberately narrower than `Mission`/`Delivery`: no drone id,
// serial, internal ids, or anything about other missions.
export interface PublicTrackingDelivery {
  waypointSeq: number;
  confirmationCode: string | null;
  deliveredAt: string;
  lat: number;
  lon: number;
  packageDesc: string | null;
}

export interface PublicTrackingLive {
  lat: number;
  lon: number;
  headingDeg: number;
  batteryPct: number;
  status: DroneStatus;
}

export interface PublicTracking {
  code: string | null;
  status: MissionStatus;
  abortReasonCode: AbortReasonCode | null;
  payloadDesc: string | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  waypoints: { seq: number; lat: number; lon: number; packageDesc: string | null }[];
  currentWaypointSeq: number;
  droneName: string | null;
  live: PublicTrackingLive | null;
  deliveries: PublicTrackingDelivery[];
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface AuditLogEntry {
  id: number;
  actor_user_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}
