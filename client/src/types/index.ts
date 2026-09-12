export type UserRole = 'admin' | 'operator';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export type DroneStatus =
  | 'offline'
  | 'idle'
  | 'armed'
  | 'in_flight'
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
  mission_code?: string | null;
  drone_name?: string | null;
}
