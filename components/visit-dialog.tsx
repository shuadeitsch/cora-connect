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
import { VISIT_REACTIONS } from "@/lib/constants";
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
  const [form, setForm] = useState<VisitInput>(initial ?? emptyVisit(households[0]?.id ?? ""));

  useEffect(() => {
    if (!open) return;
    setError("");
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
  };
}

export function visitInputFrom(visit: {
  id: string;
  householdId: string;
  visitDate: string;
  status: string | null;
  reaction: string | null;
  details: string;
}): VisitInput {
  return {
    id: visit.id,
    householdId: visit.householdId,
    visitDate: visit.visitDate,
    status: visit.status ?? "",
    reaction: visit.reaction ?? "",
    details: visit.details,
    visited: "",
  };
}
