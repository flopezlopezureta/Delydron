const db = require('../db');

async function list() {
  const { rows } = await db.query('SELECT * FROM no_fly_zones ORDER BY name');
  return rows;
}

async function listActive() {
  const { rows } = await db.query('SELECT * FROM no_fly_zones WHERE active = true');
  return rows;
}

async function getById(id) {
  const { rows } = await db.query('SELECT * FROM no_fly_zones WHERE id = $1', [id]);
  return rows[0] || null;
}

async function create({ name, lat, lon, radiusM, notes }) {
  const { rows } = await db.query(
    `INSERT INTO no_fly_zones (name, lat, lon, radius_m, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [name, lat, lon, radiusM, notes || null]
  );
  return rows[0];
}

async function update(id, fields) {
  const allowed = {
    name: fields.name,
    lat: fields.lat,
    lon: fields.lon,
    radius_m: fields.radiusM,
    active: fields.active,
    notes: fields.notes,
  };
  const sets = [];
  const values = [];
  let i = 1;
  for (const [column, value] of Object.entries(allowed)) {
    if (value !== undefined) {
      sets.push(`${column} = $${i++}`);
      values.push(value);
    }
  }
  if (!sets.length) return getById(id);
  values.push(id);
  const { rows } = await db.query(
    `UPDATE no_fly_zones SET ${sets.join(', ')}, updated_at = now() WHERE id = $${i} RETURNING *`,
    values
  );
  return rows[0] || null;
}

async function remove(id) {
  await db.query('DELETE FROM no_fly_zones WHERE id = $1', [id]);
}

module.exports = { list, listActive, getById, create, update, remove };
