const express = require('express');
const auditService = require('../services/auditService');
const { auth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get(
  '/',
  auth,
  requireRole('admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    res.json(
      await auditService.list({
        limit,
        entityType: req.query.entityType,
        entityId: req.query.entityId,
      })
    );
  })
);

module.exports = router;
