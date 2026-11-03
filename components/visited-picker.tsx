"use client";

import { CONTACT_PROJECTS, isListedProject, UNSORTED_PROJECT } from "@/lib/constants";

const field = "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40";

/** Project for a visit: Summer 5786, Chanukah 5787, or Unsorted (no project). Older values show as Unsorted and stay as they are until changed. */
export function VisitedPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const current = CONTACT_PROJECTS.find((name) => name.toLowerCase() === value.trim().toLowerCase()) ?? "";
  const keepOld = value.trim() && !isListedProject(value);
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Project</span>
      <select
        className={field}
        aria-label="Project visited"
        value={current}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{UNSORTED_PROJECT}</option>
        {CONTACT_PROJECTS.map((name) => <option key={name} value={name}>{name}</option>)}
      </select>
      {keepOld ? <span className="sr-only">Currently unsorted.</span> : null}
    </label>
  );
}
