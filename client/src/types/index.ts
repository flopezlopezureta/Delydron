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

export type MissionStatus =
  | 'draft'
  | 'scheduled'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'aborted'
  | 'failed';

export interface Waypoint {
  seq: number;
  lat: number;
  lon: number;
  alt_m: number;
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
  pickup_address: string | null;
  dropoff_address: string | null;
  current_waypoint_seq: number;
  created_at: string;
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
}

export interface MissionStatusPayload {
  missionId: string;
  droneId: string | null;
  status: MissionStatus;
}
