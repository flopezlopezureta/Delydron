const db = require('../db');

// Flight-tuning knobs an operator can change from the Configuración page —
// takes effect on the very next simulator tick, no restart needed. Anything
// not yet in the DB (fresh install, or a key added after some rows already
// exist) falls back to these.
const DEFAULTS = {
  default_altitude_m: 60,
  discharge_seconds: 5,
  battery_drain_pct_per_min: 1.5,
  // % of battery that must always stay in reserve. A dispatch is rejected if
  // the planned round trip would eat into it, and a drone already flying
  // diverts straight to its return point the moment the remaining route
  // would too — see the range checks in missionService and SimulatedAdapter.
  low_battery_reserve_pct: 20,
};

// In-memory mirror of the settings table — advanceFlight() runs once per
// second per active drone, so hitting the DB on every read would be a lot
// of pointless round-trips for values that change maybe once a season.
let cache = null;

async function loadCache() {
  const { rows } = await db.query('SELECT key, value FROM settings');
  cache = { ...DEFAULTS };
  for (const row of rows) {
    if (row.key in DEFAULTS) cache[row.key] = Number(row.value);
  }
}

async function ensureCache() {
  if (!cache) await loadCache();
}

async function getAll() {
  await ensureCache();
  return { ...cache };
}

// Synchronous read for the hot tick path — call ensureCache() once at
// adapter startup so this is never reached cold.
function getSync(key) {
  return (cache ?? DEFAULTS)[key] ?? DEFAULTS[key];
}

async function set(key, value) {
  if (!(key in DEFAULTS)) throw new Error(`unknown_setting_${key}`);
  await ensureCache();
  await db.query(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, String(value)]
  );
  cache[key] = Number(value);
}

module.exports = { DEFAULTS, ensureCache, getAll, getSync, set };
