/**
 * Location helpers. Coordinates stay on the server: only coarsened distances
 * ever reach other users.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeoPoint {
  type: "Point";
  /** GeoJSON order: [longitude, latitude]. */
  coordinates: [number, number];
}

/**
 * Precision we keep for stored locations. 3 decimal places ≈ 110 m, which is
 * plenty for "people within N km" and means we never hold a precise position.
 */
const STORED_DECIMALS = 3;

const round = (n: number, d: number) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

export function toGeoPoint({ lat, lng }: LatLng): GeoPoint {
  return { type: "Point", coordinates: [round(lng, STORED_DECIMALS), round(lat, STORED_DECIMALS)] };
}

export function fromGeoPoint(p: GeoPoint): LatLng {
  return { lng: p.coordinates[0], lat: p.coordinates[1] };
}

/**
 * "Any distance". Half the Earth's circumference, so it covers the whole globe
 * while still sorting after every finite option (keeps "widen" logic simple).
 */
export const ANY_RADIUS_KM = 20_000;

export const RADIUS_OPTIONS_KM = [1, 5, 10, 25, 50, 100, ANY_RADIUS_KM] as const;
export type RadiusKm = (typeof RADIUS_OPTIONS_KM)[number];

/** Short label for the radius picker: "10 km" or "Any". */
export function radiusLabel(r: number): string {
  return r >= ANY_RADIUS_KM ? "Any distance" : `${r} km`;
}

/** Phrase for sentences: "within 10 km" or "anywhere". */
export function withinRadius(r: number): string {
  return r >= ANY_RADIUS_KM ? "anywhere" : `within ${r} km`;
}

/** A location older than this is not used to present someone as "nearby". */
export const LOCATION_FRESH_MS = 30 * 60_000;

/** Great-circle distance in metres (haversine). */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_008.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Coarsen a distance before it leaves the server, so repeated queries from
 * spoofed positions can't pinpoint someone.
 *   < 1 km  → 1 (shown as "Under 1 km")
 *   < 10 km → nearest 0.5 km
 *   ≥ 10 km → nearest 1 km
 */
export function approximateDistanceKm(meters: number): number {
  const km = meters / 1000;
  if (km < 1) return 1;
  if (km < 10) return Math.max(1, Math.round(km * 2) / 2);
  return Math.round(km);
}
