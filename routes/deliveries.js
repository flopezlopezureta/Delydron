const express = require('express');
const deliveryService = require('../services/deliveryService');
const { auth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get(
  '/',
  auth,
  asyncHandler(async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    res.json(await deliveryService.list(limit));
  })
);

module.exports = router;
