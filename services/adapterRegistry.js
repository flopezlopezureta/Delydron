const { createAdapter } = require('./adapters/adapterFactory');

let instance = null;

function initAdapter(deps) {
  instance = createAdapter(deps);
  return instance;
}

function getAdapter() {
  if (!instance) throw new Error('Adapter not initialized');
  return instance;
}

module.exports = { initAdapter, getAdapter };
