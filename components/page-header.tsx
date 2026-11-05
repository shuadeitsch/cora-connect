import type { ReactNode } from "react";

/** One warm line under each page title. */
export const PAGE_DESCRIPTIONS: Record<string, string> = {
  Contacts: "All your contacts in one place. Use the filters to narrow them down.",
  Map: "See all your contacts from a bird's-eye view.",
  "Saved routes": "Plan your routes here. There are lots of ways to build one, so try them out! Once a route is saved, add it to your Daily planner.",
  Routes: "Plan your routes here. There are lots of ways to build one, so try them out! Once a route is saved, add it to your Daily planner.",
  "Daily planner": "Give each saved route a day, so your bochurim have a full day planned.",
  Dashboard: "Your stats and the visits reported lately, at a glance.",
  Settings: "Your account and your Chabad House settings.",
  Reports: "Every visit that was logged, with filters and a download.",
  "My team": "The shluchim and bochurim you work with, and who's on which team.",
  Users: "Everyone with a login: approve new people and set their access.",
};

export function PageDescription({ children }: { children: ReactNode }) {
  return <p className="mt-0.5 max-w-2xl text-sm leading-snug text-muted-foreground">{children}</p>;
}

export function PageHeader({
  title,
  crumb,
  action,
  description,
}: {
  title: string;
  crumb: string;
  action?: ReactNode;
  /** Defaults to the line for this page title; pass "" for none. */
  description?: string;
}) {
  const line = description ?? PAGE_DESCRIPTIONS[title] ?? PAGE_DESCRIPTIONS[crumb] ?? "";
  return (
    <div className="mb-4">
      <p className="mb-1 hidden text-xs text-muted-foreground xl:block">
        Dashboard <span className="px-1">›</span> {crumb}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-[26px] font-semibold tracking-tight text-foreground">{title}</h1>
        {action}
      </div>
      {line ? <PageDescription>{line}</PageDescription> : null}
    </div>
  );
}

export function Notice({ tone = "error", children }: { tone?: "error" | "ok"; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          : "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
      }
    >
      {children}
    </div>
  );
}
