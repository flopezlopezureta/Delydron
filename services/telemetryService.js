const db = require('../db');

async function insert({ droneId, missionId, lat, lon, altitudeM, headingDeg, speedMps, batteryPct, status }) {
  await db.query(
    `INSERT INTO telemetry_log (drone_id, mission_id, lat, lon, altitude_m, heading_deg, speed_mps, battery_pct, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [droneId, missionId || null, lat, lon, altitudeM, headingDeg, speedMps, batteryPct, status]
  );
}

async function history(droneId, limit = 500) {
  const { rows } = await db.query(
    `SELECT * FROM telemetry_log WHERE drone_id = $1 ORDER BY recorded_at DESC LIMIT $2`,
    [droneId, limit]
  );
  return rows;
}

module.exports = { insert, history };
