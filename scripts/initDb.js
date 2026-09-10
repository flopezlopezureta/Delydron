require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { getPool } = require('../db');

async function run() {
  const pool = getPool();

  const schema = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
  console.log('[initDb] Applying schema.sql...');
  await pool.query(schema);

  if (process.argv.includes('--seed')) {
    const seed = fs.readFileSync(path.join(__dirname, '..', 'seed.sql'), 'utf8');
    console.log('[initDb] Applying seed.sql...');
    await pool.query(seed);
  }

  console.log('[initDb] Done.');
  await pool.end();
}

run().catch((err) => {
  console.error('[initDb] Failed:', err);
  process.exit(1);
});
