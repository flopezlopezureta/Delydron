const db = require('../db');

async function list() {
  const { rows } = await db.query('SELECT * FROM bases ORDER BY name');
  return rows;
}

async function getById(id) {
  const { rows } = await db.query('SELECT * FROM bases WHERE id = $1', [id]);
  return rows[0] || null;
}

async function create({ name, address, lat, lon }) {
  const { rows } = await db.query(
    `INSERT INTO bases (name, address, lat, lon) VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, address || null, lat, lon]
  );
  return rows[0];
}

async function update(id, fields) {
  const allowed = ['name', 'address', 'lat', 'lon'];
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
