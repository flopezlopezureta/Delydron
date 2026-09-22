const express = require('express');
const missionService = require('../services/missionService');
const droneService = require('../services/droneService');
const deliveryService = require('../services/deliveryService');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

// Public — deliberately no `auth`. The token is a 40-char random string (see
// missions.tracking_token in schema.sql), not the mission's sequential id,
// so a client can watch their own delivery the same way any courier's
// tracking link works elsewhere: no account, unguessable URL. Only
// customer-safe, mission-scoped fields go out — no fleet internals
// (drone id/serial/model), no other users, no other missions.
router.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const mission = await missionService.getByTrackingToken(req.params.token);
    if (!mission) return res.status(404).json({ error: 'not_found' });

    const drone = mission.drone_id ? await droneService.getById(mission.drone_id) : null;
    const deliveries = (await deliveryService.listByMission(mission.id)).map((d) => ({
      waypointSeq: d.waypoint_seq,
      confirmationCode: d.confirmation_code,
      deliveredAt: d.delivered_at,
      lat: d.lat,
      lon: d.lon,
      packageDesc: d.package_desc,
    }));

    // Live drone position only while actually flying — once the mission
    // lands (any terminal status) there's nothing useful to keep polling.
    const live =
      mission.status === 'in_progress' && drone
        ? {
            lat: drone.lat,
            lon: drone.lon,
            headingDeg: Number(drone.heading_deg) || 0,
            batteryPct: Number(drone.battery_pct),
            status: drone.status,
          }
        : null;

    res.json({
      code: mission.code,
      status: mission.status,
      abortReasonCode: mission.abort_reason_code,
      payloadDesc: mission.payload_desc,
      pickupAddress: mission.pickup_address,
      dropoffAddress: mission.dropoff_address,
      waypoints: (mission.waypoints || []).map((wp) => ({
        seq: wp.seq,
        lat: wp.lat,
        lon: wp.lon,
        packageDesc: wp.package_desc || null,
      })),
      currentWaypointSeq: mission.current_waypoint_seq,
      droneName: drone ? drone.name : null,
      live,
      deliveries,
      createdAt: mission.created_at,
      startedAt: mission.started_at,
      completedAt: mission.completed_at,
    });
  })
);

module.exports = router;
