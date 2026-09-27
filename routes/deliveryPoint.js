const express = require('express');
const missionService = require('../services/missionService');
const settingsService = require('../services/settingsService');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

const EDITABLE_STATUSES = ['draft', 'scheduled', 'assigned'];

function toPublicShape(mission, waypoint) {
  return {
    missionCode: mission.code,
    missionStatus: mission.status,
    editable: EDITABLE_STATUSES.includes(mission.status),
    lat: waypoint.lat,
    lon: waypoint.lon,
    address: waypoint.address || null,
    packageDesc: waypoint.package_desc || null,
    confirmedAt: waypoint.confirmedAt || null,
    maxAdjustM: settingsService.getSync('pe_max_adjust_m'),
  };
}

// Public — no auth. The token is scoped to ONE destination inside a
// mission, not the whole mission — a multi-stop mission can carry several
// different customers' packages, so this must never expose (or let anyone
// edit) another recipient's point via the same link.
router.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const found = await missionService.getByPeToken(req.params.token);
    if (!found) return res.status(404).json({ error: 'not_found' });
    res.json(toPublicShape(found.mission, found.waypoint));
  })
);

router.patch(
  '/:token',
  asyncHandler(async (req, res) => {
    const { lat, lon } = req.body || {};
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return res.status(400).json({ error: 'lat_lon_required' });
    }

    const result = await missionService.confirmDeliveryPoint(req.params.token, lat, lon);
    if (result.error === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (result.error === 'mission_not_editable') {
      return res.status(409).json({ error: 'mission_not_editable' });
    }
    if (result.error === 'out_of_range') {
      return res.status(409).json({
        error: 'out_of_range',
        message: `Solo puedes ajustar el punto hasta ${result.maxAdjustM} m de distancia del original.`,
      });
    }
    if (result.error === 'route_restricted') {
      return res.status(409).json({ error: 'route_restricted', message: result.message });
    }

    const updated = await missionService.getByPeToken(req.params.token);
    res.json(toPublicShape(updated.mission, updated.waypoint));
  })
);

module.exports = router;
