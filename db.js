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
  });

  const tz = process.env.SYSTEM_TZ || 'America/Santiago';
  pool.on('connect', (client) => {
    client.query(`SET TIME ZONE '${tz}'`).catch((err) => {
      console.error('[db] Failed to set session timezone:', err.message);
    });
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

module.exports = { getPool, query, getClient };
