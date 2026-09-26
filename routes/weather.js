const express = require('express');
const weatherService = require('../services/weatherService');
const { auth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

// Lets the dashboard show current conditions at a base before anyone tries
// to dispatch — the actual go/no-go gate lives in missionService's dispatch
// check, this is just a read so the operator isn't surprised by a rejection.
router.get(
  '/',
  auth,
  asyncHandler(async (req, res) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: 'lat_lon_required' });
    }

    const weather = await weatherService.getCurrentWeather(lat, lon);
    if (!weather) return res.status(503).json({ error: 'weather_unavailable' });
    res.json(weather);
  })
);

module.exports = router;
