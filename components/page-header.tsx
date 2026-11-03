import type { ReactNode } from "react";

export function PageHeader({
  title,
  crumb,
  action,
}: {
  title: string;
  crumb: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4">
      <p className="mb-1 hidden text-xs text-muted-foreground xl:block">
        Dashboard <span className="px-1">›</span> {crumb}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-[26px] font-semibold tracking-tight text-foreground">{title}</h1>
        {action}
      </div>
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
