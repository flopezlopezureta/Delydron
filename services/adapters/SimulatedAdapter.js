const DroneAdapter = require('./DroneAdapter');
const { haversineMeters, interpolateAlongPath, bearingDeg } = require('../../utils/geo');
const droneService = require('../droneService');
const missionService = require('../missionService');
const telemetryService = require('../telemetryService');
const deliveryService = require('../deliveryService');
const baseService = require('../baseService');
const settingsService = require('../settingsService');
const { publishTelemetry, publishDelivery } = require('../telemetryBus');

// Engine-internal tuning, not exposed in the Configuración page — changing
// these needs a redeploy either way (TICK_MS is read once by setInterval,
// DEFAULT_SPEED_MPS is a defensive fallback for a drone missing its own
// max_speed_mps). battery_drain_pct_per_min and discharge_seconds ARE
// operator-facing, so those live in settingsService instead, re-read fresh
// on every use — see below.
const TICK_MS = Number(process.env.SIM_TICK_MS) || 1000;
const DEFAULT_SPEED_MPS = Number(process.env.SIM_DEFAULT_SPEED_MPS) || 12;
const ARRIVAL_EPSILON_M = 2;

// Fake flight backend: interpolates a drone's position toward its mission's
// waypoints on a tick loop, draining battery and persisting/publishing
// telemetry every tick. The `drones` row is always the source of truth for
// position, so restarting the server just resumes the current leg.
//
// A mission flight has up to three phases: an optional 'picking_up' (flying
// to the mission's pickup base first, only when one is linked and the
// mission hasn't started its route yet), then 'delivering' (working through
// the real destinations, opening a gate at each), then 'returning' (flying
// to the mission's return base, or the drone's own home if none was set)
// before the mission is actually marked completed.
class SimulatedAdapter extends DroneAdapter {
  constructor(deps) {
    super(deps);
    // droneId -> { missionId, waypoints, targetIndex, speedMps, homeOnly, phase, returnPoint, pickupPoint, dischargeUntil }
    this.flights = new Map();
    this.timer = null;
  }

  async init() {
    await settingsService.ensureCache();
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

  async resolveReturnPoint(missionRow, drone) {
    if (missionRow.return_base_id) {
      const base = await baseService.getById(missionRow.return_base_id);
      if (base) return { lat: base.lat, lon: base.lon };
    }
    return { lat: drone.home_lat, lon: drone.home_lon };
  }

  // Only resolvable from a linked base — a free-typed pickup_address with no
  // pickup_base_id has no coordinates to fly to, so that case is left for
  // startMission to skip (drone departs straight from wherever it is, same
  // as today) rather than guessing a location.
  async resolvePickupPoint(missionRow) {
    if (missionRow.pickup_base_id) {
      const base = await baseService.getById(missionRow.pickup_base_id);
      if (base) return { lat: base.lat, lon: base.lon };
    }
    return null;
  }

  async startMission(droneId, missionRow) {
    const drone = await droneService.getById(droneId);
    if (!drone) throw new Error(`Unknown drone ${droneId}`);

    const waypoints = [...(missionRow.waypoints || [])].sort((a, b) => a.seq - b.seq);
    const lastDone = missionRow.current_waypoint_seq || 0;
    const targetIndex = waypoints.findIndex((wp) => wp.seq > lastDone);
    const returnPoint = await this.resolveReturnPoint(missionRow, drone);
    // Only fly an explicit pickup leg on a fresh start (lastDone === 0) —
    // once any real destination has been reached the pickup already
    // happened, whether that was this boot or one before a restart.
    const pickupPoint = lastDone === 0 ? await this.resolvePickupPoint(missionRow) : null;
    const speedMps = Number(drone.max_speed_mps) || DEFAULT_SPEED_MPS;

    // No real destinations left (e.g. resuming after a restart that
    // happened mid-return) — skip straight to flying the return leg.
    // Otherwise go via the pickup base first if the mission has one linked.
    const phase = targetIndex === -1 ? 'returning' : pickupPoint ? 'picking_up' : 'delivering';

    this.flights.set(droneId, {
      missionId: missionRow.id,
      waypoints,
      targetIndex: targetIndex === -1 ? waypoints.length : targetIndex,
      speedMps,
      pickupPoint,
      homeOnly: false,
      phase,
      returnPoint,
    });

    await droneService.updateStatus(droneId, phase === 'returning' ? 'returning' : 'in_flight');
    if (missionRow.status !== 'in_progress') {
      await missionService.updateStatus(missionRow.id, 'in_progress');
    }
  }

  async abortMission(droneId, reason) {
    const flight = this.flights.get(droneId);
    this.flights.delete(droneId);
    await droneService.updateStatus(droneId, 'idle');
    if (flight && flight.missionId) {
      await missionService.updateStatus(flight.missionId, 'aborted', { notes: reason || 'aborted_by_operator' });
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

    // Holding at a delivery point to unload — position/altitude/heading
    // don't change, just wait out the timer (or drain out early into
    // 'error' the same as flying, in case a discharge is left running long
    // enough for that to matter).
    if (flight.dischargeUntil) {
      const drainedBattery = Math.max(
        0,
        Number(drone.battery_pct) - (settingsService.getSync('battery_drain_pct_per_min') * TICK_MS) / 60000
      );
      if (drainedBattery <= 0) {
        this.flights.delete(droneId);
        await droneService.updatePosition(droneId, {
          lat: drone.lat,
          lon: drone.lon,
          altitudeM: drone.altitude_m || 0,
          headingDeg: drone.heading_deg || 0,
          speedMps: 0,
          batteryPct: 0,
        });
        await droneService.updateStatus(droneId, 'error');
        if (flight.missionId) {
          await missionService.updateStatus(flight.missionId, 'failed', { notes: 'battery_depleted' });
        }
        return;
      }

      await droneService.updatePosition(droneId, {
        lat: drone.lat,
        lon: drone.lon,
        altitudeM: drone.altitude_m || 0,
        headingDeg: drone.heading_deg || 0,
        speedMps: 0,
        batteryPct: drainedBattery,
      });

      if (Date.now() < flight.dischargeUntil) {
        const payload = {
          droneId,
          missionId: flight.missionId,
          lat: drone.lat,
          lon: drone.lon,
          altitudeM: drone.altitude_m || 0,
          headingDeg: Number(drone.heading_deg) || 0,
          speedMps: 0,
          batteryPct: drainedBattery,
          status: 'unloading',
          phase: flight.phase,
          etaSeconds: Math.round((flight.dischargeUntil - Date.now()) / 1000),
          arrived: false,
        };
        await telemetryService.insert(payload);
        publishTelemetry(payload);
        return;
      }

      // Discharge finished — advance to whichever leg is next and fall
      // through to the normal movement logic below on the very same tick.
      flight.dischargeUntil = null;
      const isLastDestination = flight.targetIndex + 1 >= flight.waypoints.length;
      if (!isLastDestination) {
        flight.targetIndex += 1;
        await droneService.updateStatus(droneId, 'in_flight');
      } else {
        flight.phase = 'returning';
        await droneService.updateStatus(droneId, 'returning');
      }
    }

    const current = { lat: drone.lat, lon: drone.lon };
    const target =
      flight.phase === 'returning'
        ? { seq: null, lat: flight.returnPoint.lat, lon: flight.returnPoint.lon, alt_m: 0 }
        : flight.phase === 'picking_up'
          ? { seq: null, lat: flight.pickupPoint.lat, lon: flight.pickupPoint.lon, alt_m: 0 }
          : flight.waypoints[flight.targetIndex];
    const targetPoint = { lat: target.lat, lon: target.lon };

    const distRemaining = haversineMeters(current, targetPoint);
    // Nominal cruise speed, not this tick's (possibly zeroed-out-on-arrival
    // or battery-depleted) speed — an ETA that resets to null the instant
    // the drone arrives or dies is useless, this reflects "at normal speed".
    const etaSeconds = flight.speedMps > 0 ? Math.round(distRemaining / flight.speedMps) : null;
    const stepDist = flight.speedMps * (TICK_MS / 1000);
    const heading = bearingDeg(current, targetPoint);
    const arrived = stepDist >= distRemaining - ARRIVAL_EPSILON_M;
    const nextPoint = arrived
      ? targetPoint
      : interpolateAlongPath(current, targetPoint, stepDist / distRemaining);

    const drainedBattery = Math.max(
      0,
      Number(drone.battery_pct) - (settingsService.getSync('battery_drain_pct_per_min') * TICK_MS) / 60000
    );

    let status = drone.status;
    let speedMps = flight.speedMps;
    let batteryDepleted = false;

    if (drainedBattery <= 0) {
      batteryDepleted = true;
      status = 'error';
      speedMps = 0;
      this.flights.delete(droneId);
    } else if (arrived && flight.homeOnly) {
      // Manual return-to-home recall (not tied to a mission's own return leg).
      status = 'idle';
      speedMps = 0;
      this.flights.delete(droneId);
      await droneService.updateStatus(droneId, 'idle');
    } else if (arrived && flight.phase === 'picking_up') {
      // Package loaded — proceed to the real destinations. Status stays
      // 'in_flight' throughout, same as the leg before and after this one.
      flight.phase = 'delivering';
    } else if (arrived && flight.phase === 'delivering') {
      // Reaching a real destination opens that bay's discharge gate and
      // logs the delivery, then holds here for SIM_DISCHARGE_SECONDS before
      // moving on to the next stop or the return leg (handled at the top of
      // this function on the tick the hold expires).
      const delivery = await deliveryService.record({
        missionId: flight.missionId,
        droneId,
        waypointSeq: target.seq,
        lat: target.lat,
        lon: target.lon,
        packageDesc: target.package_desc,
      });
      publishDelivery(delivery);
      await missionService.updateCurrentWaypoint(flight.missionId, target.seq);

      flight.dischargeUntil = Date.now() + settingsService.getSync('discharge_seconds') * 1000;
      status = 'unloading';
      speedMps = 0;
      await droneService.updateStatus(droneId, 'unloading');
    } else if (arrived && flight.phase === 'returning') {
      status = 'idle';
      speedMps = 0;
      this.flights.delete(droneId);
      await missionService.updateStatus(flight.missionId, 'completed');
      await droneService.updateStatus(droneId, 'idle');
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
      phase: flight.missionId ? flight.phase : null,
      etaSeconds: this.flights.has(droneId) ? etaSeconds : null,
      // True on the exact tick a leg is reached — a waypoint, the final
      // return point, or a manual return-to-home — so the map can react to
      // "just arrived" once instead of the client guessing from ETA.
      arrived,
    };

    await telemetryService.insert(payload);
    publishTelemetry(payload);
  }
}

module.exports = SimulatedAdapter;
