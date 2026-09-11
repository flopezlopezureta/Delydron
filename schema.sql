CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SEQUENCE IF NOT EXISTS mission_code_seq START 1;

-- USERS ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'operator' CHECK (role IN ('admin','operator')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
    CHECK (status IN ('offline','idle','armed','in_flight','returning','charging','maintenance','error')),
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
CREATE INDEX IF NOT EXISTS idx_drones_status ON drones(status);

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
