require('dotenv').config();

const userService = require('../services/userService');
const { getPool } = require('../db');

async function run() {
  const [, , email, password, fullName, role] = process.argv;
  if (!email || !password || !fullName) {
    console.error('Usage: node scripts/createUser.js <email> <password> <fullName> [admin|operator]');
    process.exit(1);
  }

  const existing = await userService.findByEmail(email);
  if (existing) {
    console.error(`User ${email} already exists.`);
    process.exit(1);
  }

  const user = await userService.createUser({ email, password, fullName, role: role || 'admin' });
  console.log('Created user:', user);
  await getPool().end();
}

run().catch((err) => {
  console.error('Failed to create user:', err);
  process.exit(1);
});
