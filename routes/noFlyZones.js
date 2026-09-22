const express = require('express');
const noFlyZoneService = require('../services/noFlyZoneService');
const { auth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

// Read is open to every authenticated role — an operator planning a route
// needs to see zones just as much as the admin who maintains them.
router.get(
  '/',
  auth,
  asyncHandler(async (req, res) => {
    res.json(await noFlyZoneService.list());
  })
);

router.post(
  '/',
  auth,
  requireRole('admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const { name, lat, lon, radiusM } = req.body || {};
    if (!name || typeof lat !== 'number' || typeof lon !== 'number' || typeof radiusM !== 'number' || radiusM <= 0) {
      return res.status(400).json({ error: 'name_lat_lon_radius_required' });
    }
    const zone = await noFlyZoneService.create(req.body);
    res.status(201).json(zone);
  })
);

router.patch(
  '/:id',
  auth,
  requireRole('admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const zone = await noFlyZoneService.update(req.params.id, req.body || {});
    if (!zone) return res.status(404).json({ error: 'not_found' });
    res.json(zone);
  })
);

router.delete(
  '/:id',
  auth,
  requireRole('admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    await noFlyZoneService.remove(req.params.id);
    res.status(204).end();
  })
);

module.exports = router;
