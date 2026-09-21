const db = require('../db');

async function list() {
  const { rows } = await db.query('SELECT * FROM drones ORDER BY name');
  return rows;
}

async function getById(id) {
  const { rows } = await db.query('SELECT * FROM drones WHERE id = $1', [id]);
  return rows[0] || null;
}

async function create({ name, serialNumber, model, homeLat, homeLon, maxSpeedMps, maxRangeKm }) {
  const { rows } = await db.query(
    `INSERT INTO drones (name, serial_number, model, status, lat, lon, home_lat, home_lon, max_speed_mps, max_range_km, last_seen_at)
     VALUES ($1, $2, $3, 'idle', $4, $5, $4, $5, COALESCE($6, 15.0), COALESCE($7, 10.0), now())
     RETURNING *`,
    [name, serialNumber || null, model || null, homeLat, homeLon, maxSpeedMps, maxRangeKm]
  );
  return rows[0];
}

async function update(id, fields) {
  const allowed = ['name', 'serial_number', 'model', 'max_speed_mps', 'max_range_km', 'home_lat', 'home_lon'];
  const sets = [];
  const values = [];
  let i = 1;
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = $${i++}`);
      values.push(fields[key]);
    }
  }
  if (!sets.length) return getById(id);
  values.push(id);
  const { rows } = await db.query(
    `UPDATE drones SET ${sets.join(', ')}, updated_at = now() WHERE id = $${i} RETURNING *`,
    values
  );
  return rows[0] || null;
}

async function updatePosition(id, { lat, lon, altitudeM, headingDeg, speedMps, batteryPct }) {
  await db.query(
    `UPDATE drones
     SET lat = $2, lon = $3, altitude_m = $4, heading_deg = $5, speed_mps = $6,
         battery_pct = $7, last_seen_at = now(), updated_at = now()
     WHERE id = $1`,
    [id, lat, lon, altitudeM, headingDeg, speedMps, batteryPct]
  );
}

async function updateStatus(id, status) {
  const { rows } = await db.query(
    `UPDATE drones SET status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, status]
  );
  return rows[0] || null;
}

// Only removes an idle drone — returns false (no-op) instead of silently
// deleting one that's mid-mission, so the caller can tell the difference
// between "gone" and "still flying, didn't touch it".
async function remove(id) {
  const result = await db.query(`DELETE FROM drones WHERE id = $1 AND status = 'idle'`, [id]);
  return result.rowCount > 0;
}

module.exports = { list, getById, create, update, updatePosition, updateStatus, remove };
