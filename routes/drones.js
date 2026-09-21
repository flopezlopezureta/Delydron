const express = require('express');
const droneService = require('../services/droneService');
const { getAdapter } = require('../services/adapterRegistry');
const { auth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get(
  '/',
  auth,
  asyncHandler(async (req, res) => {
    res.json(await droneService.list());
  })
);

router.post(
  '/',
  auth,
  requireRole('admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const { name, homeLat, homeLon } = req.body || {};
    if (!name || homeLat == null || homeLon == null) {
      return res.status(400).json({ error: 'name_and_home_position_required' });
    }
    const drone = await droneService.create(req.body);
    res.status(201).json(drone);
  })
);

router.get(
  '/:id',
  auth,
  asyncHandler(async (req, res) => {
    const drone = await droneService.getById(req.params.id);
    if (!drone) return res.status(404).json({ error: 'not_found' });
    res.json(drone);
  })
);

router.patch(
  '/:id',
  auth,
  requireRole('admin', 'super_admin', 'technician'),
  asyncHandler(async (req, res) => {
    const drone = await droneService.update(req.params.id, req.body || {});
    if (!drone) return res.status(404).json({ error: 'not_found' });
    res.json(drone);
  })
);

router.delete(
  '/:id',
  auth,
  requireRole('admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const drone = await droneService.getById(req.params.id);
    if (!drone) return res.status(404).json({ error: 'not_found' });
    const removed = await droneService.remove(req.params.id);
    if (!removed) return res.status(409).json({ error: 'drone_not_idle' });
    res.status(204).end();
  })
);

router.post(
  '/:id/return-to-home',
  auth,
  requireRole('admin', 'super_admin', 'operator'),
  asyncHandler(async (req, res) => {
    const drone = await droneService.getById(req.params.id);
    if (!drone) return res.status(404).json({ error: 'not_found' });
    await getAdapter().returnToHome(req.params.id);
    res.json(await droneService.getById(req.params.id));
  })
);

router.post(
  '/:id/emergency-stop',
  auth,
  requireRole('admin', 'super_admin', 'operator'),
  asyncHandler(async (req, res) => {
    const drone = await droneService.getById(req.params.id);
    if (!drone) return res.status(404).json({ error: 'not_found' });
    await getAdapter().emergencyStop(req.params.id);
    res.json(await droneService.getById(req.params.id));
  })
);

module.exports = router;
