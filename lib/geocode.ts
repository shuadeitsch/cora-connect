import "server-only";

/**
 * Looks up map points for contacts that have no saved coordinates. Nothing is written to the database.
 * Street addresses go to the US Census geocoder; anything it cannot match falls back to the town center
 * from OpenStreetMap Nominatim (one request a second, per its usage policy). Answers are kept in the
 * Next.js data cache for 30 days and in memory, so the same address is not looked up again.
 */

export type GeocodeQuery = { key: string; street: string; city: string; state: string; zip: string };
export type GeocodePoint = { lat: number; lng: number; approximate: boolean };

const MONTH = 60 * 60 * 24 * 30;
const USER_AGENT = "CoraConnect/1.0 (https://outreach-crm-brown.vercel.app; info@chabadora.com)";
const memory = new Map<string, GeocodePoint | null>();
const towns = new Map<string, Promise<{ lat: number; lng: number } | null>>();
let nominatimNext = 0;

function clean(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function addressKey(parts: { street: string; city: string; state: string; zip: string }) {
  return [parts.street, parts.city, parts.state, parts.zip].map((part) => clean(part).toLowerCase()).join("|");
}

async function census(line: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(line)}&benchmark=Public_AR_Current&format=json`;
  try {
    const response = await fetch(url, { next: { revalidate: MONTH }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const body = (await response.json()) as { result?: { addressMatches?: { coordinates?: { x: number; y: number } }[] } };
    const hit = body.result?.addressMatches?.[0]?.coordinates;
    return hit && Number.isFinite(hit.x) && Number.isFinite(hit.y) ? { lat: hit.y, lng: hit.x } : null;
  } catch {
    return null;
  }
}

async function nominatimTown(city: string, state: string, zip: string): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({ country: "United States", format: "json", limit: "1" });
  if (city) params.set("city", city);
  if (state) params.set("state", state);
  if (!city && zip) params.set("postalcode", zip);
  const url = `https://nominatim.openstreetmap.org/search?${params}`;
  const wait = nominatimNext - Date.now();
  nominatimNext = Math.max(Date.now(), nominatimNext) + 1100;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  try {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, next: { revalidate: MONTH }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const rows = (await response.json()) as { lat: string; lon: string }[];
    const row = rows[0];
    return row ? { lat: Number(row.lat), lng: Number(row.lon) } : null;
  } catch {
    return null;
  }
}

function jitter(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h >>>= 0;
  return { lat: ((h & 255) - 128) / 25000, lng: (((h >> 8) & 255) - 128) / 18000 };
}

async function one(query: GeocodeQuery): Promise<GeocodePoint | null> {
  const street = clean(query.street);
  const city = clean(query.city);
  const state = clean(query.state);
  const zip = clean(query.zip);
  const cacheKey = addressKey(query);
  if (memory.has(cacheKey)) return memory.get(cacheKey) ?? null;
  let point: GeocodePoint | null = null;
  if (street) {
    const exact = await census([street, city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", "));
    if (exact) point = { ...exact, approximate: false };
  }
  if (!point && (city || zip)) {
    const townKey = [city, state, city ? "" : zip].join("|").toLowerCase();
    if (!towns.has(townKey)) towns.set(townKey, nominatimTown(city, state, zip));
    const town = await towns.get(townKey)!;
    if (town) {
      const offset = jitter(cacheKey);
      point = { lat: town.lat + offset.lat, lng: town.lng + offset.lng, approximate: true };
    }
  }
  memory.set(cacheKey, point);
  return point;
}

export async function geocodeMany(queries: GeocodeQuery[]): Promise<Record<string, GeocodePoint | null>> {
  const out: Record<string, GeocodePoint | null> = {};
  let index = 0;
  async function worker() {
    while (index < queries.length) {
      const query = queries[index++]!;
      out[query.key] = await one(query);
    }
  }
  await Promise.all(Array.from({ length: Math.min(5, queries.length) }, worker));
  return out;
}

/** A typed starting point: a full address through the Census geocoder, anything else (a town, a place name) through Nominatim. */
export async function geocodeText(text: string): Promise<GeocodePoint | null> {
  const line = clean(text).slice(0, 200);
  if (!line) return null;
  const exact = await census(line);
  if (exact) return { ...exact, approximate: false };
  const wait = nominatimNext - Date.now();
  nominatimNext = Math.max(Date.now(), nominatimNext) + 1100;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  try {
    const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q: line, countrycodes: "us", format: "json", limit: "1" })}`;
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, next: { revalidate: MONTH }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const rows = (await response.json()) as { lat: string; lon: string }[];
    return rows[0] ? { lat: Number(rows[0].lat), lng: Number(rows[0].lon), approximate: true } : null;
  } catch {
    return null;
  }
}

/** Town centers for city+state pairs (Nominatim, cached 30 days). Nothing is written to the database. */
export async function geocodeTowns(list: { key: string; city: string; state: string }[]): Promise<Record<string, { lat: number; lng: number } | null>> {
  const out: Record<string, { lat: number; lng: number } | null> = {};
  for (const item of list) {
    const city = clean(item.city);
    const state = clean(item.state);
    if (!city) { out[item.key] = null; continue; }
    const townKey = [city, state, ""].join("|").toLowerCase();
    if (!towns.has(townKey)) towns.set(townKey, nominatimTown(city, state, ""));
    out[item.key] = await towns.get(townKey)!;
  }
  return out;
}
