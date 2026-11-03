import { officialTags, taggedAlongRoute, type RouteStopPlace } from "@/lib/contact-tags";

export function TaggedRouteNotice({
  households,
  stops,
}: {
  households: { id: string; name: string; city: string; state: string; tags: string[] }[];
  stops: RouteStopPlace[];
}) {
  const nearby = taggedAlongRoute(households, stops);
  if (!nearby.length) return null;
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
      <p className="font-medium">Skip these tagged contacts</p>
      <p className="mt-1 text-xs">They are on this route, or in the same town as a stop.</p>
      <ul className="mt-2 space-y-1">
        {nearby.map((household) => (
          <li key={household.id}>
            <span className="font-medium">{household.name}</span>
            <span className="text-xs"> · {officialTags(household.tags).join(", ")}{household.city ? ` · ${household.city}` : ""}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
