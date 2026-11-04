export type Point = { lat: number; lng: number };

/** Straight-line distance in miles. */
export function haversineMiles(a: Point, b: Point) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Keys sorted by distance from the start; cities with no location go last. */
export function byDistance(keys: string[], points: Record<string, Point | null | undefined>, start: string) {
  const origin = points[start];
  const miles = (key: string) => (origin && points[key] ? haversineMiles(origin, points[key]!) : Infinity);
  return [...keys].sort((a, b) => (a === start ? -1 : b === start ? 1 : miles(a) - miles(b)));
}

/** Start, then always the nearest city not yet visited. Cities with no location go last. */
export function nearestChain(keys: string[], points: Record<string, Point | null | undefined>, start: string) {
  const left = new Set(keys.filter((key) => points[key]));
  const order: string[] = [];
  let at = left.has(start) ? start : [...left][0];
  while (at) {
    order.push(at);
    left.delete(at);
    let best: string | undefined;
    let bestMiles = Infinity;
    for (const key of left) {
      const miles = haversineMiles(points[at]!, points[key]!);
      if (miles < bestMiles) { bestMiles = miles; best = key; }
    }
    at = best as string;
  }
  return [...order, ...keys.filter((key) => !points[key])];
}
