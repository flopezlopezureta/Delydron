const db = require('../db');

async function record({ missionId, droneId, waypointSeq, lat, lon, packageDesc }) {
  const { rows } = await db.query(
    `INSERT INTO deliveries (mission_id, drone_id, waypoint_seq, lat, lon, package_desc)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [missionId || null, droneId || null, waypointSeq, lat, lon, packageDesc || null]
  );
  return rows[0];
}

async function list(limit = 200) {
  const { rows } = await db.query(
    `SELECT
       d.*,
       m.code AS mission_code,
       dr.name AS drone_name
     FROM deliveries d
     LEFT JOIN missions m ON m.id = d.mission_id
     LEFT JOIN drones dr ON dr.id = d.drone_id
     ORDER BY d.delivered_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

module.exports = { record, list };
