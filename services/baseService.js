const db = require('../db');

// kind: 'bdd' | 'prd' | 'ped' — omit to get all three together (the map
// views want that), pass it to power a filtered list (e.g. the mission
// planner's PED picker only wants 'ped' rows).
async function list(kind) {
  const { rows } = kind
    ? await db.query('SELECT * FROM bases WHERE kind = $1 ORDER BY name', [kind])
    : await db.query('SELECT * FROM bases ORDER BY name');
  return rows;
}

async function getById(id) {
  const { rows } = await db.query('SELECT * FROM bases WHERE id = $1', [id]);
  return rows[0] || null;
}

async function create({ name, address, lat, lon, kind }) {
  const { rows } = await db.query(
    `INSERT INTO bases (name, address, lat, lon, kind) VALUES ($1, $2, $3, $4, COALESCE($5, 'bdd')) RETURNING *`,
    [name, address || null, lat, lon, kind]
  );
  return rows[0];
}

async function update(id, fields) {
  const allowed = ['name', 'address', 'lat', 'lon', 'kind'];
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
    `UPDATE bases SET ${sets.join(', ')}, updated_at = now() WHERE id = $${i} RETURNING *`,
    values
  );
  return rows[0] || null;
}

async function remove(id) {
  await db.query('DELETE FROM bases WHERE id = $1', [id]);
}

module.exports = { list, getById, create, update, remove };
