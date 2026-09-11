const express = require('express');
const baseService = require('../services/baseService');
const { auth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get(
  '/',
  auth,
  asyncHandler(async (req, res) => {
    res.json(await baseService.list());
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
  asyncHandler(async (req, res) => {
    const { name, address, lat, lon } = req.body || {};
    if (!name || typeof lat !== 'number' || typeof lon !== 'number') {
      return res.status(400).json({ error: 'name_lat_lon_required' });
    }
    const base = await baseService.create({ name, address, lat, lon });
    res.status(201).json(base);
  })
);

router.patch(
  '/:id',
  auth,
  asyncHandler(async (req, res) => {
    const base = await baseService.update(req.params.id, req.body || {});
    if (!base) return res.status(404).json({ error: 'not_found' });
    res.json(base);
  })
);

router.delete(
  '/:id',
  auth,
  asyncHandler(async (req, res) => {
    await baseService.remove(req.params.id);
    res.status(204).end();
  })
);

module.exports = router;
