import { describe, expect, it } from "vitest";
import { approximateDistanceKm, fromGeoPoint, haversineMeters, toGeoPoint } from "@/lib/geo";
import { formatDistance } from "@/lib/format";
import { COLOMBO_FORT, GALLE, KANDY } from "./helpers";

describe("geo helpers", () => {
  it("stores GeoJSON points as [longitude, latitude]", () => {
    const p = toGeoPoint({ lat: 6.9344, lng: 79.8428 });
    expect(p.type).toBe("Point");
    expect(p.coordinates).toEqual([79.843, 6.934]);
    expect(fromGeoPoint(p)).toEqual({ lat: 6.934, lng: 79.843 });
  });

  it("rounds stored coordinates to ~110 m precision", () => {
    const p = toGeoPoint({ lat: 6.93449999, lng: 79.84281234 });
    for (const c of p.coordinates) expect(Number(c.toFixed(3))).toBe(c);
  });

  it("computes realistic great-circle distances", () => {
    expect(haversineMeters(COLOMBO_FORT, KANDY) / 1000).toBeGreaterThan(90);
    expect(haversineMeters(COLOMBO_FORT, KANDY) / 1000).toBeLessThan(100);
    expect(haversineMeters(COLOMBO_FORT, GALLE) / 1000).toBeGreaterThan(100);
    expect(haversineMeters(COLOMBO_FORT, COLOMBO_FORT)).toBe(0);
  });

  it("coarsens distances before they reach clients", () => {
    expect(approximateDistanceKm(120)).toBe(1);
    expect(approximateDistanceKm(999)).toBe(1);
    expect(approximateDistanceKm(2_380)).toBe(2.5);
    expect(approximateDistanceKm(7_740)).toBe(7.5);
    expect(approximateDistanceKm(12_400)).toBe(12);
    expect(formatDistance(1)).toBe("Under 1 km away");
    expect(formatDistance(2.5)).toBe("2.5 km away");
    expect(formatDistance(12)).toBe("12 km away");
  });
});
