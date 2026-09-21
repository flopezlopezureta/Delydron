const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (pool) return pool;

  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT, DB_SSL } = process.env;

  if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
    console.error('[db] Missing DB_HOST/DB_USER/DB_PASSWORD/DB_NAME env vars.');
    return {
      query: () => Promise.reject(new Error('Database not configured')),
      connect: () => Promise.reject(new Error('Database not configured')),
    };
  }

  const tz = process.env.SYSTEM_TZ || 'America/Santiago';

  pool = new Pool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    port: DB_PORT ? Number(DB_PORT) : 5432,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 20000,
    ssl: DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    // Set via connection startup options (not a post-connect query) so
    // there's no race with the first query issued once the pool hands the
    // client out — pool.on('connect') firing a detached client.query()
    // can overlap with that first checkout and trip pg's "query already
    // in progress" warning.
    options: `-c TimeZone=${tz}`,
  });

  pool.on('error', (err) => {
    console.error('[db] Unexpected idle client error:', err.message);
  });

  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

async function getClient() {
  return getPool().connect();
}

// schema.sql is written entirely as CREATE ... IF NOT EXISTS / DROP
// CONSTRAINT IF EXISTS + ADD CONSTRAINT, specifically so it's safe to run
// on every boot — no separate manual migration step (and no dependency on
// shell/Terminal access) needed for a schema change to actually reach a
// running deploy.
async function applySchema() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await query(schema);
}

module.exports = { getPool, query, getClient, applySchema };
