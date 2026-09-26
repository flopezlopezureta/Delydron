const settingsService = require('./settingsService');

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const FETCH_TIMEOUT_MS = 5000;

// Open-Meteo: free, keyless, no account needed — good enough for a
// go/no-go check at dispatch time. Returns null on any failure (network,
// timeout, malformed response) rather than throwing, because callers must
// fail OPEN: a weather-API outage grounding the whole fleet would be worse
// than dispatching this one time without a fresh reading.
async function getCurrentWeather(lat, lon) {
  try {
    const url = `${OPEN_METEO_URL}?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_gusts_10m,precipitation&wind_speed_unit=kmh`;
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;

    const data = await res.json();
    const current = data.current;
    if (!current || current.wind_speed_10m == null) return null;

    return {
      windKmh: Number(current.wind_speed_10m),
      windGustsKmh: Number(current.wind_gusts_10m),
      precipitationMm: Number(current.precipitation ?? 0),
    };
  } catch (err) {
    console.error('[weatherService] fetch failed:', err.message);
    return null;
  }
}

// Pre-dispatch weather gate. Returns null when clear to fly (including when
// weather data couldn't be fetched at all — see getCurrentWeather's
// fail-open note), or a human-readable reason to block otherwise.
async function checkWeatherFeasible(lat, lon) {
  const weather = await getCurrentWeather(lat, lon);
  if (!weather) return null;

  const maxWindKmh = settingsService.getSync('max_wind_kmh');
  const maxPrecipitationMm = settingsService.getSync('max_precipitation_mm');

  if (weather.windKmh > maxWindKmh) {
    return `Viento actual de ${weather.windKmh.toFixed(0)} km/h supera el máximo permitido para volar (${maxWindKmh} km/h).`;
  }
  if (weather.precipitationMm > maxPrecipitationMm) {
    return `Precipitación actual de ${weather.precipitationMm.toFixed(1)} mm supera el máximo permitido para volar (${maxPrecipitationMm} mm).`;
  }
  return null;
}

module.exports = { getCurrentWeather, checkWeatherFeasible };
