export interface Town {
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  area: string;
}

export const TOWNS: Town[] = [
  { city: "Bozeman", state: "MT", zip: "59715", lat: 45.677, lng: -111.0429, area: "406" },
  { city: "Billings", state: "MT", zip: "59102", lat: 45.7833, lng: -108.5007, area: "406" },
  { city: "Missoula", state: "MT", zip: "59801", lat: 46.8721, lng: -113.994, area: "406" },
  { city: "Great Falls", state: "MT", zip: "59401", lat: 47.5053, lng: -111.3008, area: "406" },
  { city: "Helena", state: "MT", zip: "59601", lat: 46.5891, lng: -112.0391, area: "406" },
  { city: "Kalispell", state: "MT", zip: "59901", lat: 48.1917, lng: -114.3168, area: "406" },
  { city: "Havre", state: "MT", zip: "59501", lat: 48.55, lng: -109.6841, area: "406" },
  { city: "Miles City", state: "MT", zip: "59301", lat: 46.4083, lng: -105.8406, area: "406" },
  { city: "Bangor", state: "ME", zip: "04401", lat: 44.8016, lng: -68.7712, area: "207" },
  { city: "Augusta", state: "ME", zip: "04330", lat: 44.3106, lng: -69.7795, area: "207" },
  { city: "Presque Isle", state: "ME", zip: "04769", lat: 46.6812, lng: -68.0159, area: "207" },
  { city: "Farmington", state: "ME", zip: "04938", lat: 44.6706, lng: -70.1517, area: "207" },
  { city: "Ellsworth", state: "ME", zip: "04605", lat: 44.5434, lng: -68.4195, area: "207" },
  { city: "Fargo", state: "ND", zip: "58103", lat: 46.8772, lng: -96.7898, area: "701" },
  { city: "Bismarck", state: "ND", zip: "58501", lat: 46.8083, lng: -100.7837, area: "701" },
  { city: "Minot", state: "ND", zip: "58701", lat: 48.233, lng: -101.2923, area: "701" },
  { city: "Dickinson", state: "ND", zip: "58601", lat: 46.8792, lng: -102.7896, area: "701" },
  { city: "Sioux Falls", state: "SD", zip: "57104", lat: 43.546, lng: -96.7313, area: "605" },
  { city: "Rapid City", state: "SD", zip: "57701", lat: 44.0805, lng: -103.231, area: "605" },
  { city: "Aberdeen", state: "SD", zip: "57401", lat: 45.4647, lng: -98.4865, area: "605" },
  { city: "Pierre", state: "SD", zip: "57501", lat: 44.3683, lng: -100.351, area: "605" },
  { city: "Cheyenne", state: "WY", zip: "82001", lat: 41.14, lng: -104.8202, area: "307" },
  { city: "Casper", state: "WY", zip: "82601", lat: 42.8666, lng: -106.3131, area: "307" },
  { city: "Laramie", state: "WY", zip: "82070", lat: 41.3114, lng: -105.5911, area: "307" },
  { city: "Sheridan", state: "WY", zip: "82801", lat: 44.7972, lng: -106.9561, area: "307" },
  { city: "Grand Island", state: "NE", zip: "68801", lat: 40.9264, lng: -98.342, area: "308" },
  { city: "Scottsbluff", state: "NE", zip: "69361", lat: 41.8666, lng: -103.6672, area: "308" },
  { city: "North Platte", state: "NE", zip: "69101", lat: 41.1239, lng: -100.7654, area: "308" },
  { city: "Dodge City", state: "KS", zip: "67801", lat: 37.7528, lng: -100.0171, area: "620" },
  { city: "Hays", state: "KS", zip: "67601", lat: 38.8792, lng: -99.3268, area: "785" },
  { city: "Mason City", state: "IA", zip: "50401", lat: 43.1536, lng: -93.201, area: "641" },
  { city: "Sioux City", state: "IA", zip: "51101", lat: 42.4999, lng: -96.4003, area: "712" },
  { city: "Burlington", state: "VT", zip: "05401", lat: 44.4759, lng: -73.2121, area: "802" },
  { city: "Montpelier", state: "VT", zip: "05602", lat: 44.2601, lng: -72.5754, area: "802" },
  { city: "Rutland", state: "VT", zip: "05701", lat: 43.6106, lng: -72.9726, area: "802" },
  { city: "Keene", state: "NH", zip: "03431", lat: 42.9337, lng: -72.2781, area: "603" },
  { city: "Berlin", state: "NH", zip: "03570", lat: 44.4687, lng: -71.1851, area: "603" },
  { city: "Concord", state: "NH", zip: "03301", lat: 43.2081, lng: -71.5376, area: "603" },
  { city: "Idaho Falls", state: "ID", zip: "83402", lat: 43.4917, lng: -112.0339, area: "208" },
  { city: "Pocatello", state: "ID", zip: "83201", lat: 42.8713, lng: -112.4455, area: "208" },
  { city: "Twin Falls", state: "ID", zip: "83301", lat: 42.563, lng: -114.4609, area: "208" },
  { city: "Santa Fe", state: "NM", zip: "87501", lat: 35.687, lng: -105.9378, area: "505" },
  { city: "Roswell", state: "NM", zip: "88201", lat: 33.3943, lng: -104.523, area: "575" },
  { city: "Las Cruces", state: "NM", zip: "88001", lat: 32.3199, lng: -106.7637, area: "575" },
];

export function findTown(city: string, state: string): Town | null {
  const c = city.trim().toLowerCase();
  const s = state.trim().toLowerCase();
  return (
    TOWNS.find((t) => t.city.toLowerCase() === c && t.state.toLowerCase() === s) ?? null
  );
}

function hashKey(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function geocodeAddress(
  city: string,
  state: string,
  street: string,
): { lat: number; lng: number } | null {
  const town = findTown(city, state);
  if (!town) return null;
  const h = hashKey(`${street}|${city}|${state}`);
  const latJ = ((h & 255) - 128) / 9000;
  const lngJ = (((h >> 8) & 255) - 128) / 7000;
  return {
    lat: Math.round((town.lat + latJ) * 1e6) / 1e6,
    lng: Math.round((town.lng + lngJ) * 1e6) / 1e6,
  };
}

export function miles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = (n: number) => (n * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function nearestNeighbor(
  start: { lat: number; lng: number } | null,
  points: { id: string; lat: number | null; lng: number | null }[],
): string[] {
  const located = points.filter(
    (p): p is { id: string; lat: number; lng: number } => p.lat != null && p.lng != null,
  );
  const missing = points.filter((p) => p.lat == null || p.lng == null).map((p) => p.id);
  const remaining = [...located];
  const ordered: string[] = [];
  let current = start;
  if (!current && remaining.length) {
    const first = remaining.shift()!;
    ordered.push(first.id);
    current = first;
  }
  while (remaining.length && current) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = miles(current, remaining[i]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const next = remaining.splice(best, 1)[0];
    ordered.push(next.id);
    current = next;
  }
  return [...ordered, ...missing];
}

export function routeMiles(
  start: { lat: number; lng: number } | null,
  points: { lat: number | null; lng: number | null }[],
): number | null {
  const located = points.filter(
    (p): p is { lat: number; lng: number } => p.lat != null && p.lng != null,
  );
  if (located.length < 1) return null;
  let total = 0;
  let prev = start ?? located[0];
  const rest = start ? located : located.slice(1);
  if (!start && located.length < 2) return 0;
  for (const point of rest) {
    total += miles(prev, point);
    prev = point;
  }
  return Math.round(total * 10) / 10;
}
