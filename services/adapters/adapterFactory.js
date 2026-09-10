function createAdapter(deps) {
  const type = process.env.DRONE_ADAPTER || 'simulated';

  if (type === 'simulated') {
    const SimulatedAdapter = require('./SimulatedAdapter');
    return new SimulatedAdapter(deps);
  }

  // 'mavlink' | 'dji' land here post-v1, once real hardware is confirmed —
  // same DroneAdapter interface, one new file, no changes anywhere else.
  throw new Error(`Unsupported DRONE_ADAPTER: ${type}`);
}

module.exports = { createAdapter };
