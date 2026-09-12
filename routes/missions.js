const express = require('express');
const missionService = require('../services/missionService');
const droneService = require('../services/droneService');
const { getAdapter } = require('../services/adapterRegistry');
const { auth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { validateWaypoints } = require('../utils/validation');

const router = express.Router();

router.get(
  '/',
  auth,
  asyncHandler(async (req, res) => {
    const { status, droneId } = req.query;
    res.json(await missionService.list({ status, droneId }));
  })
);

router.get(
  '/:id',
  auth,
  asyncHandler(async (req, res) => {
    const mission = await missionService.getById(req.params.id);
    if (!mission) return res.status(404).json({ error: 'not_found' });
    res.json(mission);
  })
);

router.post(
  '/',
  auth,
  asyncHandler(async (req, res) => {
    const waypointsError = validateWaypoints(req.body?.waypoints);
    if (waypointsError) return res.status(400).json({ error: waypointsError });

    const mission = await missionService.create({ ...req.body, createdBy: req.user.sub });
    res.status(201).json(mission);
  })
);

router.patch(
  '/:id',
  auth,
  asyncHandler(async (req, res) => {
    const existing = await missionService.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'not_found' });
    if (!['draft', 'scheduled', 'assigned'].includes(existing.status)) {
      return res.status(409).json({ error: 'mission_not_editable' });
    }

    const waypointsError = validateWaypoints(req.body?.waypoints);
    if (waypointsError) return res.status(400).json({ error: waypointsError });

    res.json(await missionService.update(req.params.id, req.body || {}));
  })
);

router.delete(
  '/:id',
  auth,
  asyncHandler(async (req, res) => {
    const existing = await missionService.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'not_found' });
    if (existing.status !== 'draft') {
      return res.status(409).json({ error: 'only_draft_missions_can_be_deleted' });
    }
    await missionService.remove(req.params.id);
    res.status(204).end();
  })
);

router.post(
  '/:id/dispatch',
  auth,
  asyncHandler(async (req, res) => {
    const mission = await missionService.getById(req.params.id);
    if (!mission) return res.status(404).json({ error: 'not_found' });
    if (!mission.drone_id) return res.status(400).json({ error: 'no_drone_assigned' });
    if (!['draft', 'scheduled', 'assigned'].includes(mission.status)) {
      return res.status(409).json({ error: 'invalid_status' });
    }

    const drone = await droneService.getById(mission.drone_id);
    if (!drone) return res.status(400).json({ error: 'drone_not_found' });
    if (drone.status !== 'idle') return res.status(409).json({ error: 'drone_not_idle' });

    await getAdapter().startMission(mission.drone_id, mission);
    res.json(await missionService.getById(req.params.id));
  })
);

router.post(
  '/:id/abort',
  auth,
  asyncHandler(async (req, res) => {
    const mission = await missionService.getById(req.params.id);
    if (!mission) return res.status(404).json({ error: 'not_found' });
    if (!['assigned', 'in_progress'].includes(mission.status)) {
      return res.status(409).json({ error: 'invalid_status' });
    }

    if (mission.status === 'in_progress' && mission.drone_id) {
      await getAdapter().abortMission(mission.drone_id);
    } else {
      await missionService.updateStatus(mission.id, 'aborted');
    }
    res.json(await missionService.getById(req.params.id));
  })
);

router.post(
  '/:id/repeat',
  auth,
  asyncHandler(async (req, res) => {
    const existing = await missionService.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'not_found' });

    // Fresh draft with the same route/payload — no drone_id, since the one
    // that flew it last time may no longer be idle or even exist; the
    // dispatcher assigns one again like any new mission.
    const mission = await missionService.create({
      createdBy: req.user.sub,
      priority: existing.priority,
      waypoints: existing.waypoints,
      payloadDesc: existing.payload_desc,
      pickupBaseId: existing.pickup_base_id,
      pickupAddress: existing.pickup_address,
      dropoffAddress: existing.dropoff_address,
      returnBaseId: existing.return_base_id,
    });
    res.status(201).json(mission);
  })
);

module.exports = router;
