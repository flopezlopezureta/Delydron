const db = require('../db');

const MAJOR_MINOR = '1.1';
const INITIAL_PATCH = 100;

// Cached for the life of this process — bumping must happen exactly once
// per boot (= once per deploy, since redeploying always restarts the
// container), never per-request.
let cachedVersion = null;

// Persists in the same Postgres the rest of the app already uses, instead
// of a build-time constant — Docker builds are stateless/reproducible by
// design, so there's no way to count "builds so far" from inside one, and
// Coolify's own repo import strips .git from the build context regardless
// of .dockerignore, so git history isn't reachable either. A real counter
// needs state that outlives a single build, and this app already has one.
async function bumpAndGetVersion() {
  if (cachedVersion) return cachedVersion;

  const { rows } = await db.query(
    `INSERT INTO settings (key, value) VALUES ('app_version_patch', $1)
     ON CONFLICT (key) DO UPDATE SET value = (settings.value::int + 1)::text, updated_at = now()
     RETURNING value`,
    [String(INITIAL_PATCH)]
  );
  cachedVersion = `${MAJOR_MINOR}.${rows[0].value}`;
  return cachedVersion;
}

function getCachedVersion() {
  return cachedVersion;
}

module.exports = { bumpAndGetVersion, getCachedVersion };
