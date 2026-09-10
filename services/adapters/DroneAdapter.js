// Contract every drone backend implements — simulated today, real hardware
// (MAVLink, DJI) later. Telemetry is always PUSHED onto the shared bus by
// the adapter; nothing in the rest of the app polls a drone directly.
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

  async abortMission(droneId) {
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
