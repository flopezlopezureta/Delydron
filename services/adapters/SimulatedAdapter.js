const DroneAdapter = require('./DroneAdapter');
const { haversineMeters, interpolateAlongPath, bearingDeg } = require('../../utils/geo');
const droneService = require('../droneService');
const missionService = require('../missionService');
const telemetryService = require('../telemetryService');
const { publishTelemetry } = require('../telemetryBus');

const TICK_MS = Number(process.env.SIM_TICK_MS) || 1000;
const DEFAULT_SPEED_MPS = Number(process.env.SIM_DEFAULT_SPEED_MPS) || 12;
const BATTERY_DRAIN_PCT_PER_MIN = Number(process.env.SIM_BATTERY_DRAIN_PCT_PER_MIN) || 1.5;
const ARRIVAL_EPSILON_M = 2;

// Fake flight backend: interpolates a drone's position toward its mission's
// waypoints on a tick loop, draining battery and persisting/publishing
// telemetry every tick. The `drones` row is always the source of truth for
// position, so restarting the server just resumes the current leg.
class SimulatedAdapter extends DroneAdapter {
  constructor(deps) {
    super(deps);
    this.flights = new Map(); // droneId -> { missionId, waypoints, targetIndex, speedMps, homeOnly }
    this.timer = null;
  }

  async init() {
    this.timer = setInterval(() => {
      this.tick().catch((err) => console.error('[SimulatedAdapter] tick error:', err));
    }, TICK_MS);
  }

  async shutdown() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async registerDrone(_droneRow) {
    // No hardware handshake needed in simulation.
  }

  async unregisterDrone(droneId) {
    this.flights.delete(droneId);
  }

  async startMission(droneId, missionRow) {
    const drone = await droneService.getById(droneId);
    if (!drone) throw new Error(`Unknown drone ${droneId}`);

    const waypoints = [...(missionRow.waypoints || [])].sort((a, b) => a.seq - b.seq);
    const lastDone = missionRow.current_waypoint_seq || 0;
    const targetIndex = waypoints.findIndex((wp) => wp.seq > lastDone);

    if (targetIndex === -1) {
      await missionService.updateStatus(missionRow.id, 'completed');
      await droneService.updateStatus(droneId, 'idle');
      return;
    }

    this.flights.set(droneId, {
      missionId: missionRow.id,
      waypoints,
      targetIndex,
      speedMps: Number(drone.max_speed_mps) || DEFAULT_SPEED_MPS,
      homeOnly: false,
    });

    await droneService.updateStatus(droneId, 'in_flight');
    if (missionRow.status !== 'in_progress') {
      await missionService.updateStatus(missionRow.id, 'in_progress');
    }
  }

  async abortMission(droneId) {
    const flight = this.flights.get(droneId);
    this.flights.delete(droneId);
    await droneService.updateStatus(droneId, 'idle');
    if (flight && flight.missionId) {
      await missionService.updateStatus(flight.missionId, 'aborted', { notes: 'aborted_by_operator' });
    }
  }

  async returnToHome(droneId) {
    const drone = await droneService.getById(droneId);
    if (!drone) throw new Error(`Unknown drone ${droneId}`);

    const existing = this.flights.get(droneId);
    if (existing && existing.missionId) {
      await missionService.updateStatus(existing.missionId, 'aborted', { notes: 'return_to_home' });
    }

    this.flights.set(droneId, {
      missionId: null,
      waypoints: [{ seq: 1, lat: drone.home_lat, lon: drone.home_lon, alt_m: 0 }],
      targetIndex: 0,
      speedMps: Number(drone.max_speed_mps) || DEFAULT_SPEED_MPS,
      homeOnly: true,
    });
    await droneService.updateStatus(droneId, 'returning');
  }

  async emergencyStop(droneId) {
    const flight = this.flights.get(droneId);
    this.flights.delete(droneId);
    await droneService.updateStatus(droneId, 'error');
    if (flight && flight.missionId) {
      await missionService.updateStatus(flight.missionId, 'aborted', { notes: 'emergency_stop' });
    }
  }

  async getState(droneId) {
    return droneService.getById(droneId);
  }

  async tick() {
    for (const [droneId, flight] of this.flights.entries()) {
      await this.advanceFlight(droneId, flight);
    }
  }

  async advanceFlight(droneId, flight) {
    const drone = await droneService.getById(droneId);
    if (!drone) {
      this.flights.delete(droneId);
      return;
    }

    const current = { lat: drone.lat, lon: drone.lon };
    const target = flight.waypoints[flight.targetIndex];
    const targetPoint = { lat: target.lat, lon: target.lon };

    const distRemaining = haversineMeters(current, targetPoint);
    const stepDist = flight.speedMps * (TICK_MS / 1000);
    const heading = bearingDeg(current, targetPoint);
    const arrived = stepDist >= distRemaining - ARRIVAL_EPSILON_M;
    const nextPoint = arrived
      ? targetPoint
      : interpolateAlongPath(current, targetPoint, stepDist / distRemaining);

    const drainedBattery = Math.max(
      0,
      Number(drone.battery_pct) - (BATTERY_DRAIN_PCT_PER_MIN * TICK_MS) / 60000
    );

    let status = drone.status;
    let speedMps = flight.speedMps;
    let batteryDepleted = false;

    if (drainedBattery <= 0) {
      batteryDepleted = true;
      status = 'error';
      speedMps = 0;
      this.flights.delete(droneId);
    } else if (arrived) {
      if (flight.targetIndex + 1 < flight.waypoints.length) {
        flight.targetIndex += 1;
        if (flight.missionId) {
          await missionService.updateCurrentWaypoint(flight.missionId, target.seq);
        }
      } else {
        status = 'idle';
        speedMps = 0;
        this.flights.delete(droneId);

        if (flight.homeOnly) {
          await droneService.updateStatus(droneId, 'idle');
        } else if (flight.missionId) {
          await missionService.updateCurrentWaypoint(flight.missionId, target.seq);
          await missionService.updateStatus(flight.missionId, 'completed');
          await droneService.updateStatus(droneId, 'idle');
        }
      }
    }

    await droneService.updatePosition(droneId, {
      lat: nextPoint.lat,
      lon: nextPoint.lon,
      altitudeM: target.alt_m || 0,
      headingDeg: heading,
      speedMps,
      batteryPct: drainedBattery,
    });

    if (batteryDepleted) {
      await droneService.updateStatus(droneId, 'error');
      if (flight.missionId) {
        await missionService.updateStatus(flight.missionId, 'failed', { notes: 'battery_depleted' });
      }
    }

    const payload = {
      droneId,
      missionId: flight.missionId,
      lat: nextPoint.lat,
      lon: nextPoint.lon,
      altitudeM: target.alt_m || 0,
      headingDeg: heading,
      speedMps,
      batteryPct: drainedBattery,
      status,
    };

    await telemetryService.insert(payload);
    publishTelemetry(payload);
  }
}

module.exports = SimulatedAdapter;
