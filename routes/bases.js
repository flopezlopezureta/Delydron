const express = require('express');
const baseService = require('../services/baseService');
const missionService = require('../services/missionService');
const { auth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();
const VALID_KINDS = ['bdd', 'prd', 'ped'];

router.get(
  '/',
  auth,
  asyncHandler(async (req, res) => {
    const { kind } = req.query;
    if (kind && !VALID_KINDS.includes(kind)) {
      return res.status(400).json({ error: 'invalid_kind' });
    }
    res.json(await baseService.list(kind));
  })
);

router.get(
  '/:id',
  auth,
  asyncHandler(async (req, res) => {
    const base = await baseService.getById(req.params.id);
    if (!base) return res.status(404).json({ error: 'not_found' });
    res.json(base);
  })
);

router.post(
  '/',
  auth,
  requireRole('admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const { name, address, lat, lon, kind } = req.body || {};
    if (!name || typeof lat !== 'number' || typeof lon !== 'number') {
      return res.status(400).json({ error: 'name_lat_lon_required' });
    }
    if (kind && !VALID_KINDS.includes(kind)) {
      return res.status(400).json({ error: 'invalid_kind' });
    }
    const base = await baseService.create({ name, address, lat, lon, kind });
    res.status(201).json(base);
  })
);

router.patch(
  '/:id',
  auth,
  requireRole('admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const { kind } = req.body || {};
    if (kind && !VALID_KINDS.includes(kind)) {
      return res.status(400).json({ error: 'invalid_kind' });
    }
    const base = await baseService.update(req.params.id, req.body || {});
    if (!base) return res.status(404).json({ error: 'not_found' });
    res.json(base);
  })
);

router.delete(
  '/:id',
  auth,
  requireRole('admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    if (await missionService.existsForBase(req.params.id)) {
      return res.status(409).json({ error: 'base_in_use_by_mission' });
    }
    await baseService.remove(req.params.id);
    res.status(204).end();
  })
);

module.exports = router;
