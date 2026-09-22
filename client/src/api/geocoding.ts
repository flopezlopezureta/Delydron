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

export interface AddressSuggestion {
  lat: number;
  lon: number;
  placeName: string;
  relevance: number;
}

// Unlike geocodeAddress() above (blind top-1 pick), this returns several
// candidates so the operator can see exactly what MapTiler matched and
// choose — needed because Chile's OSM address coverage is patchy outside
// well-mapped comunas: a house number that isn't in the data still returns
// a "result" (the street's centroid, silently missing the number), so
// picking [0] without showing it to a human is how addresses go "missing"
// without any error ever being thrown.
export async function searchAddresses(query: string): Promise<AddressSuggestion[]> {
  const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${MAPTILER_KEY}&country=cl&limit=5`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('No se pudo buscar la dirección.');

  const data = await res.json();
  const features = (data.features ?? []) as Array<{
    geometry: { coordinates: [number, number] };
    place_name: string;
    relevance?: number;
  }>;
  return features.map((f) => ({
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0],
    placeName: f.place_name,
    relevance: f.relevance ?? 0,
  }));
}
