"use client";

import { ActivityIcon } from "@/components/activity-icon";
import { VISIT_ACTIVITIES, isOfficialActivity, normalizeActivity, sameActivity } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Quick-tap chips for what happened on a visit. */
export function VisitActivityPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (activities: string[]) => void;
}) {
  const selected = uniqueActivities(value);

  function toggle(label: string) {
    const on = selected.some((item) => sameActivity(item, label));
    onChange(on ? selected.filter((item) => !sameActivity(item, label)) : [...selected, normalizeActivity(label)]);
  }

  return (
    <fieldset className="grid gap-2">
      <legend className="text-[11px] font-medium tracking-wide text-mutedink uppercase">What happened</legend>
      <div className="flex flex-wrap gap-1.5">
        {VISIT_ACTIVITIES.map((label) => {
          const on = selected.some((item) => sameActivity(item, label));
          return (
            <button
              key={label}
              type="button"
              aria-pressed={on}
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium ring-1",
                on ? "bg-primary text-primary-foreground ring-primary" : "bg-card text-foreground ring-border hover:bg-muted",
              )}
              onClick={() => toggle(label)}
            >
              <ActivityIcon label={label} className="size-3.5" />
              {label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function VisitActivityBadges({ activities }: { activities: string[] }) {
  const shown = uniqueActivities(activities);
  if (!shown.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {shown.map((label) => (
        <li
          key={label}
          className="inline-flex min-h-8 items-center gap-1 rounded-full bg-muted px-2.5 text-xs font-medium text-foreground"
        >
          <ActivityIcon label={label} className="size-3.5" />
          {label}
        </li>
      ))}
    </ul>
  );
}

/** Official activity chips only, de-duplicated and in canonical wording. */
export function uniqueActivities(values: string[] | null | undefined) {
  const found: string[] = [];
  for (const raw of values ?? []) {
    const label = normalizeActivity(raw);
    if (!label || !isOfficialActivity(label) || found.some((item) => sameActivity(item, label))) continue;
    found.push(label);
  }
  return found;
}
