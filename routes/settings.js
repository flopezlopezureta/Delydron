const express = require('express');
const settingsService = require('../services/settingsService');
const { auth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get(
  '/',
  auth,
  asyncHandler(async (req, res) => {
    res.json(await settingsService.getAll());
  })
);

router.patch(
  '/',
  auth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    for (const [key, value] of Object.entries(req.body || {})) {
      if (!(key in settingsService.DEFAULTS)) continue; // ignore anything unrecognized
      await settingsService.set(key, value);
    }
    res.json(await settingsService.getAll());
  })
);

module.exports = router;
