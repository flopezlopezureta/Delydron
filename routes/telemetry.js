const express = require('express');
const { bus } = require('../services/telemetryBus');
const telemetryService = require('../services/telemetryService');
const { auth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

const HEARTBEAT_MS = 20000;

router.get('/stream', auth, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(':ok\n\n');

  const onTelemetry = (payload) => {
    res.write(`event: TELEMETRY\ndata: ${JSON.stringify(payload)}\n\n`);
  };
  const onMissionStatus = (payload) => {
    res.write(`event: MISSION_STATUS\ndata: ${JSON.stringify(payload)}\n\n`);
  };

  bus.on('fleet:telemetry', onTelemetry);
  bus.on('mission:status', onMissionStatus);

  const heartbeat = setInterval(() => res.write(':hb\n\n'), HEARTBEAT_MS);

  req.on('close', () => {
    clearInterval(heartbeat);
    bus.off('fleet:telemetry', onTelemetry);
    bus.off('mission:status', onMissionStatus);
  });
});

router.get(
  '/:droneId/history',
  auth,
  asyncHandler(async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    res.json(await telemetryService.history(req.params.droneId, limit));
  })
);

module.exports = router;
