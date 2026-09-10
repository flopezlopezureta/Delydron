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

module.exports = { findByEmail, findById, createUser, verifyPassword };
