const express = require('express');
const droneService = require('../services/droneService');
const { getAdapter } = require('../services/adapterRegistry');
const { auth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get(
  '/',
  auth,
  asyncHandler(async (req, res) => {
    res.json(await droneService.list());
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
  asyncHandler(async (req, res) => {
    const drone = await droneService.update(req.params.id, req.body || {});
    if (!drone) return res.status(404).json({ error: 'not_found' });
    res.json(drone);
  })
);

router.post(
  '/:id/return-to-home',
  auth,
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
  asyncHandler(async (req, res) => {
    const drone = await droneService.getById(req.params.id);
    if (!drone) return res.status(404).json({ error: 'not_found' });
    await getAdapter().emergencyStop(req.params.id);
    res.json(await droneService.getById(req.params.id));
  })
);

module.exports = router;
