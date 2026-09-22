// Contract every drone backend implements — simulated today, real hardware
// (MAVLink, DJI) later. Telemetry is always PUSHED onto the shared bus by
// the adapter; nothing in the rest of the app polls a drone directly.
//
// A real adapter also owns the failsafes this app can't implement from the
// ground station side — lost-C2-link behavior (hover/RTL/land), geofence
// enforcement, and low-battery RTL all live in the flight controller/dock
// firmware, not here. SimulatedAdapter's low-battery diversion (see
// advanceFlight) exists only because there's no real firmware underneath it
// to do that job; a hardware adapter should NOT need to re-implement it.
class DroneAdapter {
  constructor({ bus, pool }) {
    this.bus = bus;
    this.pool = pool;
  }

  async init() {
    throw new Error('init() not implemented');
  }

  async shutdown() {
    throw new Error('shutdown() not implemented');
  }

  async registerDrone(droneRow) {
    throw new Error('registerDrone() not implemented');
  }

  async unregisterDrone(droneId) {
    throw new Error('unregisterDrone() not implemented');
  }

  async startMission(droneId, missionRow) {
    throw new Error('startMission() not implemented');
  }

  async abortMission(droneId, reason, reasonCode) {
    throw new Error('abortMission() not implemented');
  }

  async returnToHome(droneId) {
    throw new Error('returnToHome() not implemented');
  }

  async emergencyStop(droneId) {
    throw new Error('emergencyStop() not implemented');
  }

  async getState(droneId) {
    throw new Error('getState() not implemented');
  }
}

module.exports = DroneAdapter;
