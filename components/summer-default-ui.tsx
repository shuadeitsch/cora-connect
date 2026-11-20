"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setProjectSummerDefaultAction } from "@/lib/project-summer-actions";
import { stateLabel } from "@/lib/constants";
import { summerDefaultText, summerSettingFor, summerStateCode } from "@/lib/summer-default";
import type { AppData } from "@/lib/types";

/** Small text near the summer control: what this project does with summer homes in this state. */
export function SummerDefaultNote({ data, projectId, state }: { data: AppData; projectId: string; state: string }) {
  const setting = summerSettingFor(data.projectSummerSettings, projectId, state);
  const text = summerDefaultText(data.projects.find((project) => project.id === projectId)?.name ?? "", setting);
  return text ? <p className="text-xs text-muted-foreground">{text}</p> : null;
}

/** Asked once, to admins: a project used in a state that has no summer-home default yet. */
export function SummerDefaultPrompt({ data, projectId, state }: { data: AppData; projectId: string; state: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [later, setLater] = useState(true);
  const [error, setError] = useState("");
  const code = summerStateCode(state);
  const key = `cora_summer_ask:${projectId}|${code}`;
  useEffect(() => {
    try { setLater(window.sessionStorage.getItem(key) === "1"); } catch { setLater(false); }
  }, [key]);
  const project = data.projects.find((item) => item.id === projectId);
  if (data.viewer.role !== "admin" || data.viewer.preview || !project || !code || summerSettingFor(data.projectSummerSettings, projectId, state) || later) return null;
  const save = (value: "include" | "exclude") => {
    setError("");
    start(async () => {
      const result = await setProjectSummerDefaultAction({ projectId, state: code, value });
      if (!result.ok) { setError(result.error); return; }
      router.refresh();
    });
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-amber-500/10 px-3 py-2 text-sm">
      <span className="text-foreground">Summer homes for {project.name} in {stateLabel(code)}?</span>
      <Button type="button" className="h-9 rounded-full" disabled={pending} onClick={() => save("include")}>Include summer homes</Button>
      <Button type="button" variant="outline" className="h-9 rounded-full" disabled={pending} onClick={() => save("exclude")}>Exclude summer homes</Button>
      <button type="button" className="min-h-9 px-2 text-xs text-muted-foreground underline" onClick={() => { try { window.sessionStorage.setItem(key, "1"); } catch {} setLater(true); }}>Ask later</button>
      {error ? <span role="alert" className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}

/** Settings card (admins): change any project's summer-home default per state. */
export function ProjectSummerSettings({ data }: { data: AppData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  if (data.viewer.role !== "admin" || data.viewer.preview || !data.projects.length) return null;
  const states = [...new Set([
    ...data.households.map((household) => summerStateCode(household.state)),
    ...(data.projectSummerSettings ?? []).map((item) => item.state),
  ].filter(Boolean))].sort();
  if (!states.length) return null;
  const change = (projectId: string, state: string, value: string) => {
    setError("");
    start(async () => {
      const result = await setProjectSummerDefaultAction({ projectId, state, value: value as "include" | "exclude" | "clear" });
      if (!result.ok) { setError(result.error); return; }
      router.refresh();
    });
  };
  return (
    <section className="panel grid gap-3 rounded-3xl p-4">
      <div>
        <h2 className="font-heading text-lg font-semibold">Summer homes by project and state</h2>
        <p className="text-xs text-muted-foreground">Sets the starting &quot;Exclude summer homes&quot; choice when a project is used in a state. &quot;Not set&quot; shows everyone. Anyone can still flip it on a screen.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1 pr-2 font-medium">Project</th>{states.map((state) => <th key={state} className="py-1 pr-2 font-medium">{stateLabel(state)}</th>)}</tr></thead>
          <tbody>
            {data.projects.map((project) => (
              <tr key={project.id} className="border-t border-border/60">
                <td className="py-1.5 pr-2 font-medium text-foreground">{project.name}</td>
                {states.map((state) => {
                  const setting = summerSettingFor(data.projectSummerSettings, project.id, state);
                  return (
                    <td key={state} className="py-1.5 pr-2">
                      <select className="h-9 rounded-full border bg-card px-2 text-sm" disabled={pending} aria-label={`${project.name} in ${stateLabel(state)}`} value={setting ? (setting.includeSummer ? "include" : "exclude") : "clear"} onChange={(event) => change(project.id, state, event.target.value)}>
                        <option value="clear">Not set</option>
                        <option value="include">Include summer homes</option>
                        <option value="exclude">Exclude summer homes</option>
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
