-- Demo drone + mission so there is something to fly right after db:init.
-- The mission is seeded as already 'in_progress' (as if it were dispatched
-- right before the server's first boot) so server.js's boot-resume logic
-- picks it up automatically — 'assigned' would NOT auto-fly, since that
-- status means "waiting for a human to click Dispatch".
-- Fixed UUIDs make this script idempotent (safe to re-run).

INSERT INTO drones (
  id, name, serial_number, model, adapter_type, status,
  battery_pct, lat, lon, altitude_m, heading_deg, speed_mps,
  home_lat, home_lon, max_speed_mps, max_range_km, last_seen_at
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Halcon-1', 'SIM-0001', 'Simulated Quad', 'simulated', 'in_flight',
  100.00, -33.4489, -70.6693, 0, 0, 0,
  -33.4489, -70.6693, 15.0, 10.0, now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO missions (
  id, code, drone_id, created_by, status, priority, waypoints,
  payload_desc, pickup_address, dropoff_address,
  current_waypoint_seq, distance_planned_m
) VALUES (
  '22222222-2222-2222-2222-222222222222',
  'MSN-DEMO-0001',
  '11111111-1111-1111-1111-111111111111',
  NULL,
  'in_progress',
  3,
  '[
    {"seq": 1, "lat": -33.4520, "lon": -70.6650, "alt_m": 60, "action": "flyto", "hold_s": 0},
    {"seq": 2, "lat": -33.4550, "lon": -70.6600, "alt_m": 60, "action": "flyto", "hold_s": 0}
  ]'::jsonb,
  'Paquete de demostracion', 'Bodega Central', 'Cliente Demo',
  0, 950
)
ON CONFLICT (id) DO NOTHING;
