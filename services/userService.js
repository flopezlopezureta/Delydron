const bcrypt = require('bcryptjs');
const db = require('../db');

async function findByEmail(email) {
  const { rows } = await db.query(
    'SELECT * FROM users WHERE email = $1 AND is_active = true',
    [email]
  );
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await db.query(
    'SELECT id, email, full_name, role, is_active FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

async function createUser({ email, password, fullName, role }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const { rows } = await db.query(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, full_name, role, is_active`,
    [email, passwordHash, fullName, role || 'operator']
  );
  return rows[0];
}

async function verifyPassword(user, password) {
  return bcrypt.compare(password, user.password_hash);
}

async function list() {
  const { rows } = await db.query(
    'SELECT id, email, full_name, role, is_active, created_at FROM users ORDER BY full_name'
  );
  return rows;
}

async function update(id, fields) {
  const allowed = {};
  if (fields.email !== undefined) allowed.email = fields.email;
  if (fields.fullName !== undefined) allowed.full_name = fields.fullName;
  if (fields.role !== undefined) allowed.role = fields.role;
  if (fields.isActive !== undefined) allowed.is_active = fields.isActive;
  if (fields.password) allowed.password_hash = await bcrypt.hash(fields.password, 10);

  const sets = [];
  const values = [];
  let i = 1;
  for (const [column, value] of Object.entries(allowed)) {
    sets.push(`${column} = $${i++}`);
    values.push(value);
  }
  if (!sets.length) return findById(id);

  values.push(id);
  const { rows } = await db.query(
    `UPDATE users SET ${sets.join(', ')}, updated_at = now() WHERE id = $${i}
     RETURNING id, email, full_name, role, is_active`,
    values
  );
  return rows[0] || null;
}

// Soft delete — flips is_active instead of a hard DELETE, so the account
// can't log in anymore (findByEmail already filters on is_active) but stays
// intact as created_by on any mission it dispatched. Reversible via update().
async function remove(id) {
  await db.query('UPDATE users SET is_active = false, updated_at = now() WHERE id = $1', [id]);
}

// Recovery hatch for a locked-out deploy: set BOOTSTRAP_ADMIN_EMAIL and
// BOOTSTRAP_ADMIN_PASSWORD, redeploy once, log in, then remove both env
// vars — leaving them set would reset that account's password back to this
// value on every future restart, silently undoing any later password change.
async function bootstrapAdminFromEnv() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) return;

  const passwordHash = await bcrypt.hash(password, 10);
  const fullName = process.env.BOOTSTRAP_ADMIN_NAME || 'Admin';
  const { rows } = await db.query(
    `INSERT INTO users (email, password_hash, full_name, role, is_active)
     VALUES ($1, $2, $3, 'admin', true)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, role = 'admin', is_active = true, updated_at = now()
     RETURNING id, email`,
    [email, passwordHash, fullName]
  );
  console.log(`[bootstrap] Admin account ready: ${rows[0].email} (${rows[0].id}) — remove BOOTSTRAP_ADMIN_* env vars now.`);
}

module.exports = {
  findByEmail,
  findById,
  createUser,
  verifyPassword,
  list,
  update,
  remove,
  bootstrapAdminFromEnv,
};
