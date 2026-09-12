// Client-side call straight to MapTiler (same key/account already used for
// map tiles) — no need to proxy this through our own backend, this key is
// meant to be used from the browser like any map-tile key.
const MAPTILER_KEY = 'zy6sHDBhSRsVvSPe3MCL';

export interface GeocodeResult {
  lat: number;
  lon: number;
  placeName: string;
}

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${MAPTILER_KEY}&country=cl&limit=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('No se pudo buscar la dirección.');

  const data = await res.json();
  const feature = data.features?.[0];
  if (!feature) return null;

  const [lon, lat] = feature.geometry.coordinates;
  return { lat, lon, placeName: feature.place_name };
}
