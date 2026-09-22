const express = require('express');
const missionService = require('../services/missionService');
const droneService = require('../services/droneService');
const auditService = require('../services/auditService');
const { getAdapter } = require('../services/adapterRegistry');
const { auth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { validateWaypoints, validateReasonCode } = require('../utils/validation');

const router = express.Router();
// technician and auxiliary don't dispatch — technician's scope is drones'
// home bases + read access, auxiliary is read-only across the whole app.
const canDispatch = requireRole('admin', 'super_admin', 'operator');

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
  canDispatch,
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
  canDispatch,
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
  canDispatch,
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
  canDispatch,
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

    const infeasibleReason = await missionService.checkDispatchFeasible(mission, drone);
    if (infeasibleReason) {
      return res.status(409).json({ error: 'insufficient_range', message: infeasibleReason });
    }

    await getAdapter().startMission(mission.drone_id, mission);
    await auditService.log({
      actorUserId: req.user.sub,
      actorEmail: req.user.email,
      action: 'mission.dispatch',
      entityType: 'mission',
      entityId: mission.id,
      detail: { droneId: mission.drone_id, missionCode: mission.code },
    });
    res.json(await missionService.getById(req.params.id));
  })
);

router.post(
  '/:id/abort',
  auth,
  canDispatch,
  asyncHandler(async (req, res) => {
    const mission = await missionService.getById(req.params.id);
    if (!mission) return res.status(404).json({ error: 'not_found' });
    // Cancellable at any point before it reaches a terminal state — a
    // 'scheduled' order that the client cancels is just as real a
    // cancellation as one aborted mid-flight, and both should leave a
    // record (unlike a plain 'draft' delete, which is for mistakes/tests).
    if (!['draft', 'scheduled', 'assigned', 'in_progress'].includes(mission.status)) {
      return res.status(409).json({ error: 'invalid_status' });
    }
    if (validateReasonCode(req.body?.reasonCode)) {
      return res.status(400).json({ error: 'invalid_reason_code' });
    }

    const reasonCode = req.body?.reasonCode || 'operator_abort';
    if (mission.status === 'in_progress' && mission.drone_id) {
      await getAdapter().abortMission(mission.drone_id, req.body?.reason, reasonCode);
    } else {
      await missionService.updateStatus(mission.id, 'aborted', { notes: req.body?.reason, reasonCode });
    }
    await auditService.log({
      actorUserId: req.user.sub,
      actorEmail: req.user.email,
      action: 'mission.abort',
      entityType: 'mission',
      entityId: mission.id,
      detail: { reasonCode, reason: req.body?.reason },
    });
    res.json(await missionService.getById(req.params.id));
  })
);

module.exports = router;
