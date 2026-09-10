const express = require('express');
const droneService = require('../services/droneService');
const { auth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

// Phase 2 scope: read-only. Create/update/return-to-home/emergency-stop
// land in Phase 3 alongside the dispatch UI that would actually call them.

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

module.exports = router;
