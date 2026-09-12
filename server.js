require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const { getPool } = require('./db');
const { bus } = require('./services/telemetryBus');
const { initAdapter } = require('./services/adapterRegistry');
const missionService = require('./services/missionService');
const { errorHandler } = require('./middleware/errorHandler');

const PORT = process.env.PORT || 3000;

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'img-src': ["'self'", 'data:', 'https://*.tile.openstreetmap.org'],
      },
    },
  })
);
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

app.use(
  '/api',
  rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    max: Number(process.env.RATE_LIMIT_MAX) || 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/drones', require('./routes/drones'));
app.use('/api/bases', require('./routes/bases'));
app.use('/api/missions', require('./routes/missions'));
app.use('/api/deliveries', require('./routes/deliveries'));
app.use('/api/telemetry', require('./routes/telemetry'));

const clientDist = path.join(__dirname, 'client', 'dist');
const clientIndexHtml = path.join(clientDist, 'index.html');
app.use(express.static(clientDist));
if (fs.existsSync(clientIndexHtml)) {
  // SPA fallback for built frontend (production). In dev the Vite server
  // on its own port handles everything except /api/*, so this is skipped.
  app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(clientIndexHtml));
}

app.use(errorHandler);

async function start() {
  const adapter = initAdapter({ bus, pool: getPool() });
  await adapter.init();

  const inProgress = await missionService.getInProgress();
  for (const mission of inProgress) {
    if (mission.drone_id) {
      await adapter.startMission(mission.drone_id, mission);
    }
  }
  if (inProgress.length) {
    console.log(`[server] Resumed ${inProgress.length} in-flight mission(s) on boot.`);
  }

  app.listen(PORT, () => {
    console.log(`[server] DroneControl listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});
