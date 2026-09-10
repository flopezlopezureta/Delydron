const { EventEmitter } = require('events');

const bus = new EventEmitter();
bus.setMaxListeners(0);

function publishTelemetry(payload) {
  bus.emit('drone:' + payload.droneId, payload);
  bus.emit('fleet:telemetry', payload);
}

function publishMissionStatus(payload) {
  bus.emit('mission:status', payload);
}

module.exports = { bus, publishTelemetry, publishMissionStatus };
