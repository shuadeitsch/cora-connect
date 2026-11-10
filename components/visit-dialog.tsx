"use client";

import { useEffect, useState, useTransition } from "react";
import { Notice } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUndoToast } from "@/components/undo-toast";
import { VisitedPicker } from "@/components/visited-picker";
import { deleteVisitAction, saveVisitAction } from "@/lib/actions";
import { VISIT_ACTIVITIES, VISIT_REACTIONS, normalizeActivity } from "@/lib/constants";
import { ActivityIcon } from "@/components/activity-icon";
import type { VisitInput } from "@/lib/types";

const field = "h-9 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40";

export function VisitDialog({
  open,
  onOpenChange,
  households,
  initial,
  canDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  households: { id: string; name: string }[];
  initial?: VisitInput;
  canDelete?: boolean;
}) {
  const announce = useUndoToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [writeIn, setWriteIn] = useState("");
  const [form, setForm] = useState<VisitInput>(initial ?? emptyVisit(households[0]?.id ?? ""));

  useEffect(() => {
    if (!open) return;
    setError("");
    setWriteIn("");
    setForm(initial ?? emptyVisit(households[0]?.id ?? ""));
    // Reset only when the dialog opens or the edited visit changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id, initial?.householdId]);

  function set<K extends keyof VisitInput>(key: K, value: VisitInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-foreground">{form.id ? "Edit visit" : "Log a visit"}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            start(async () => {
              const result = await saveVisitAction(form);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              onOpenChange(false);
              announce(result, form.id ? "Visit updated" : "Visit logged");
            });
          }}
        >
          <label className="grid gap-1 text-sm">
            <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Contact</span>
            <select className={field} value={form.householdId} onChange={(event) => set("householdId", event.target.value)} required>
              {households.map((household) => (
                <option key={household.id} value={household.id}>
                  {household.name}
                </option>
              ))}
            </select>
          </label>
          <VisitedPicker value={form.visited ?? ""} onChange={(visited) => set("visited", visited)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Visit date</span>
              <Input type="date" value={form.visitDate} onChange={(event) => set("visitDate", event.target.value)} />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Status</span>
              <select className={field} value={form.status} onChange={(event) => set("status", event.target.value)}>
                <option value="">Blank</option>
                <option value="completed">Completed</option>
                <option value="deferred">Deferred</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Reaction</span>
              <select className={field} value={form.reaction} onChange={(event) => set("reaction", event.target.value)}>
                <option value="">None</option>
                {VISIT_REACTIONS.map((reaction) => (
                  <option key={reaction.id} value={reaction.id}>
                    {reaction.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <fieldset className="grid gap-2">
            <legend className="text-[11px] font-medium tracking-wide text-mutedink uppercase">What was done</legend>
            <div className="flex flex-wrap gap-1.5">
              {VISIT_ACTIVITIES.map((label) => {
                const on = (form.activities ?? []).includes(label);
                return (
                  <button
                    key={label}
                    type="button"
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${on ? "bg-primary text-primary-foreground ring-primary" : "bg-card text-foreground ring-border hover:bg-muted"}`}
                    onClick={() => {
                      const current = form.activities ?? [];
                      set("activities", on ? current.filter((item) => item !== label) : [...current, label]);
                    }}
                  >
                    <span className="inline-flex items-center gap-1">
                      <ActivityIcon label={label} className="size-3.5" />
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(form.activities ?? []).filter((item) => !(VISIT_ACTIVITIES as readonly string[]).includes(item)).map((label) => (
                <button
                  key={label}
                  type="button"
                  className="rounded-full bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary ring-1 ring-primary/30"
                  onClick={() => set("activities", (form.activities ?? []).filter((item) => item !== label))}
                  title="Remove"
                >
                  {label} ×
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Write in another activity"
                value={writeIn}
                onChange={(event) => setWriteIn(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  const label = normalizeActivity(writeIn);
                  if (!label) return;
                  const current = form.activities ?? [];
                  if (!current.includes(label)) set("activities", [...current, label]);
                  setWriteIn("");
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  const label = normalizeActivity(writeIn);
                  if (!label) return;
                  const current = form.activities ?? [];
                  if (!current.includes(label)) set("activities", [...current, label]);
                  setWriteIn("");
                }}
              >
                Add
              </Button>
            </div>
          </fieldset>
          <label className="grid gap-1 text-sm">
            <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Visited by</span>
            <Input
              value={form.visitedBy ?? ""}
              onChange={(event) => set("visitedBy", event.target.value)}
              placeholder="Auto-fills from assigned bochurim if left blank"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Details</span>
            <Textarea value={form.details} onChange={(event) => set("details", event.target.value)} rows={4} placeholder="What happened at the door?" />
          </label>
          {error ? <Notice>{error}</Notice> : null}
          <div className="flex flex-wrap justify-between gap-2">
            {canDelete && form.id ? (
              <Button
                type="button"
                variant="destructive"
                disabled={pending}
                onClick={() => {
                  if (!form.id) return;
                  start(async () => {
                    const result = await deleteVisitAction(form.id!);
                    if (!result.ok) {
                      setError(result.error);
                      return;
                    }
                    onOpenChange(false);
                    announce(result, "Visit removed");
                  });
                }}
              >
                Delete
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={pending} className="rounded-full">
              {pending ? "Saving…" : "Save visit"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function emptyVisit(householdId: string): VisitInput {
  return {
    householdId,
    visitDate: "",
    status: "",
    reaction: "",
    details: "",
    visited: "",
    visitedBy: "",
    activities: [],
  };
}

export function visitInputFrom(visit: {
  id: string;
  householdId: string;
  visitDate: string;
  status: string | null;
  reaction: string | null;
  details: string;
  visitedBy?: string | null;
  activities?: string[];
}): VisitInput {
  return {
    id: visit.id,
    householdId: visit.householdId,
    visitDate: visit.visitDate,
    status: visit.status ?? "",
    reaction: visit.reaction ?? "",
    details: visit.details,
    visited: "",
    visitedBy: visit.visitedBy ?? "",
    activities: visit.activities ?? [],
  };
}
