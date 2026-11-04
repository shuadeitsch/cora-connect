// Same link form as Start route (1.8.6): /maps/dir/A/B/C path links keep every stop; 10 stops per part.
const LEG = 10;
const WHOLE_MAX = 25;

export function dirLink(points: string[]) {
  const kept = points.filter((point, index) => point && point !== points[index - 1]);
  const path = (kept.length === 1 ? ["", ...kept] : kept).map((point) => encodeURIComponent(point).replace(/%20/g, "+"));
  return `https://www.google.com/maps/dir/${path.join("/")}/data=!4m2!4m1!3e0`;
}

/** Google Maps links for a start plus stops: "Part N of M" legs of 10, plus the whole route when it fits. */
export function googleParts(start: string, stops: string[]) {
  const parts: { label: string; url: string }[] = [];
  const count = Math.ceil(stops.length / LEG);
  for (let i = 0; i < count; i++) {
    const from = i === 0 ? start : stops[i * LEG - 1]!;
    const slice = stops.slice(i * LEG, (i + 1) * LEG);
    parts.push({ label: count > 1 ? `Part ${i + 1} of ${count}: stops ${i * LEG + 1}–${i * LEG + slice.length}` : "Open in Google Maps", url: dirLink([from, ...slice]) });
  }
  const whole = stops.length + 1 <= WHOLE_MAX && count > 1 ? dirLink([start, ...stops]) : null;
  return { parts, whole };
}
