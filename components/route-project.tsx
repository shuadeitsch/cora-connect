"use client";

import { useRouteProject } from "@/lib/route-overlap";
import type { AppData } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Project for the route being built; contacts already on another route for it get marked. */
export function RouteProjectSelect({ data, className }: { data: AppData; className?: string }) {
  const { projectId, setProjectId } = useRouteProject(data);
  if (!data.projects.length) return null;
  return (
    <select
      className={cn("h-9 rounded-full border bg-card px-3 text-sm", className)}
      value={projectId}
      onChange={(event) => setProjectId(event.target.value)}
      aria-label="Project"
    >
      <option value="">Unsorted</option>
      {data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
    </select>
  );
}

export function OverlapBadge({ text }: { text?: string }) {
  if (!text) return null;
  return <span className="mt-0.5 inline-block max-w-full truncate rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-900 dark:bg-violet-950 dark:text-violet-100">{text}</span>;
}
