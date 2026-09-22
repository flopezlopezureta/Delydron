CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SEQUENCE IF NOT EXISTS mission_code_seq START 1;

-- SETTINGS (flight-tuning knobs editable from the app, no redeploy needed) -
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- USERS ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'operator'
    CHECK (role IN ('super_admin','admin','operator','technician','auxiliary')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Explicit ALTER so the new roles reach databases that already ran an
-- earlier version of this script (the inline CHECK above is a no-op
-- against an existing table).
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('super_admin','admin','operator','technician','auxiliary'));

-- BASES (dispatch depots/hubs) --------------------------------------------
CREATE TABLE IF NOT EXISTS bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  address VARCHAR(255),
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- DRONES -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  serial_number VARCHAR(100) UNIQUE,
  model VARCHAR(100),
  adapter_type VARCHAR(20) NOT NULL DEFAULT 'simulated'
    CHECK (adapter_type IN ('simulated','mavlink','dji')),
  status VARCHAR(20) NOT NULL DEFAULT 'offline'
    CHECK (status IN ('offline','idle','armed','in_flight','unloading','returning','charging','maintenance','error')),
  battery_pct NUMERIC(5,2) NOT NULL DEFAULT 100.00 CHECK (battery_pct BETWEEN 0 AND 100),
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  altitude_m NUMERIC(6,2),
  heading_deg NUMERIC(5,2),
  speed_mps NUMERIC(6,2),
  home_lat DOUBLE PRECISION NOT NULL,
  home_lon DOUBLE PRECISION NOT NULL,
  max_speed_mps NUMERIC(6,2) NOT NULL DEFAULT 15.0,
  max_range_km NUMERIC(6,2) NOT NULL DEFAULT 10.0,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Explicit ALTER so 'unloading' reaches databases that already ran an
-- earlier version of this script (the inline CHECK above is a no-op
-- against an existing table).
ALTER TABLE drones DROP CONSTRAINT IF EXISTS drones_status_check;
ALTER TABLE drones ADD CONSTRAINT drones_status_check
  CHECK (status IN ('offline','idle','armed','in_flight','unloading','returning','charging','maintenance','error'));
CREATE INDEX IF NOT EXISTS idx_drones_status ON drones(status);

-- Airworthiness tracking: cumulative flight time drives an automatic
-- maintenance flag (see SimulatedAdapter) instead of relying on someone
-- remembering to schedule it.
ALTER TABLE drones ADD COLUMN IF NOT EXISTS total_flight_seconds BIGINT NOT NULL DEFAULT 0;
ALTER TABLE drones ADD COLUMN IF NOT EXISTS maintenance_interval_hours NUMERIC(8,2) NOT NULL DEFAULT 100;

-- MISSIONS ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) UNIQUE,
  drone_id UUID REFERENCES drones(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','scheduled','assigned','in_progress','completed','aborted','failed')),
  priority SMALLINT NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  waypoints JSONB NOT NULL DEFAULT '[]',
  payload_desc VARCHAR(255),
  pickup_base_id UUID REFERENCES bases(id) ON DELETE SET NULL,
  pickup_address VARCHAR(255),
  dropoff_address VARCHAR(255),
  return_base_id UUID REFERENCES bases(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  current_waypoint_seq INT NOT NULL DEFAULT 0,
  distance_planned_m NUMERIC(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
CREATE INDEX IF NOT EXISTS idx_missions_drone_id ON missions(drone_id);

-- Explicit ALTER so this column reaches databases that already ran an
-- earlier version of this script (CREATE TABLE IF NOT EXISTS is a no-op
-- against an existing table, it won't backfill new columns on its own).
ALTER TABLE missions ADD COLUMN IF NOT EXISTS pickup_base_id UUID REFERENCES bases(id) ON DELETE SET NULL;
-- NULL = return to the assigned drone's own home position (the old,
-- implicit behavior); set = return to this base instead.
ALTER TABLE missions ADD COLUMN IF NOT EXISTS return_base_id UUID REFERENCES bases(id) ON DELETE SET NULL;

-- Public, unguessable token so a client can watch their own delivery without
-- an account (see routes/track.js) — the DEFAULT means every existing and
-- future mission gets one for free, no application code required.
ALTER TABLE missions ADD COLUMN IF NOT EXISTS tracking_token VARCHAR(40)
  UNIQUE DEFAULT encode(gen_random_bytes(20), 'hex');
CREATE INDEX IF NOT EXISTS idx_missions_tracking_token ON missions(tracking_token);

-- Structured cause for an aborted/failed mission — `notes` stays as free-text
-- detail, this is the fixed code a safety/compliance report can group by.
ALTER TABLE missions ADD COLUMN IF NOT EXISTS abort_reason_code VARCHAR(30);
ALTER TABLE missions DROP CONSTRAINT IF EXISTS missions_abort_reason_code_check;
ALTER TABLE missions ADD CONSTRAINT missions_abort_reason_code_check
  CHECK (abort_reason_code IS NULL OR abort_reason_code IN (
    'operator_abort', 'emergency_stop', 'return_to_home_manual', 'low_battery_diversion',
    'battery_depleted', 'hardware_fault', 'payload_fault', 'weather', 'airspace_conflict', 'other'
  ));

-- TELEMETRY_LOG (time-series trail) ---------------------------------------
CREATE TABLE IF NOT EXISTS telemetry_log (
  id BIGSERIAL PRIMARY KEY,
  drone_id UUID NOT NULL REFERENCES drones(id) ON DELETE CASCADE,
  mission_id UUID REFERENCES missions(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  altitude_m NUMERIC(6,2),
  heading_deg NUMERIC(5,2),
  speed_mps NUMERIC(6,2),
  battery_pct NUMERIC(5,2),
  status VARCHAR(20)
);
CREATE INDEX IF NOT EXISTS idx_telemetry_drone_time ON telemetry_log(drone_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_mission ON telemetry_log(mission_id);

-- DELIVERIES (one row per destination reached — the discharge-gate log) ---
CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES missions(id) ON DELETE SET NULL,
  drone_id UUID REFERENCES drones(id) ON DELETE SET NULL,
  waypoint_seq INT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  package_desc VARCHAR(255),
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deliveries_mission ON deliveries(mission_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_delivered_at ON deliveries(delivered_at DESC);

-- Short, shareable receipt code — the proof of delivery a client can quote
-- back if they dispute or ask about an entrega. DEFAULT generates it for
-- every row automatically, same trick as missions.tracking_token above.
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS confirmation_code VARCHAR(12)
  UNIQUE DEFAULT upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));

-- AUDIT_LOG (who did what, to which mission/drone/user, and when) ---------
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_email VARCHAR(255),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(30) NOT NULL,
  entity_id UUID,
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
