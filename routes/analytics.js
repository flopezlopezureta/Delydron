const express = require('express');
const analyticsService = require('../services/analyticsService');
const { auth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

// technician's whole reason for existing per spec: read mission history to
// analyze drone performance. admin/super_admin get it too since it's
// useful ops data, not because they need the role check relaxed.
router.get(
  '/',
  auth,
  requireRole('admin', 'super_admin', 'technician'),
  asyncHandler(async (req, res) => {
    const [missionStatusBreakdown, abortReasonBreakdown, dronePerformance, totalDeliveries] = await Promise.all([
      analyticsService.missionStatusBreakdown(),
      analyticsService.abortReasonBreakdown(),
      analyticsService.dronePerformance(),
      analyticsService.deliveriesTotal(),
    ]);
    res.json({ missionStatusBreakdown, abortReasonBreakdown, dronePerformance, totalDeliveries });
  })
);

module.exports = router;
