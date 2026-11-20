"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Notice } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/toast";
import { deletePreplannerTaskAction, savePreplannerTaskAction, setPreplannerTaskDoneAction } from "@/lib/preplanner-task-actions";
import { isOverdue, sortTasks, telHref, type PreplannerTask } from "@/lib/preplanner-tasks";
import { sameState } from "@/lib/constants";
import { formatMedium, todayIso } from "@/lib/format";
import { cn } from "@/lib/utils";

type Form = { id?: string; task: string; phone: string; email: string; holding: string; nextFollowUp: string; state: string; done: boolean };

/** Pre-planner "Tasks": a simple follow-up list. Phone and email are tap-to-call / mailto only; nothing is sent from the CRM. */
export function PreplannerTasksPanel({ tasks, activeState, defaultState, stateChoices, isAdmin }: { tasks: PreplannerTask[]; activeState: string; defaultState: string; stateChoices: string[]; isAdmin: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<Form | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PreplannerTask | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const today = todayIso();
  const shown = sortTasks(activeState ? tasks.filter((task) => sameState(task.state, activeState)) : tasks);

  function blank(): Form {
    return { task: "", phone: "", email: "", holding: "", nextFollowUp: "", state: activeState || defaultState, done: false };
  }

  function run(task: () => Promise<{ ok: boolean; error?: string }>, okTitle: string, after?: () => void) {
    setError("");
    start(async () => {
      const result = await task();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        toast({ title: result.error ?? "Something went wrong.", tone: "error" });
        return;
      }
      toast({ title: okTitle, tone: "ok" });
      after?.();
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Write anything you need to follow up on. Sorted by next follow-up.</p>
        <Button type="button" className="min-h-11 rounded-full" onClick={() => { setError(""); setForm(blank()); }}><Plus className="size-4" /> New task</Button>
      </div>
      {error && !form ? <div className="mb-3"><Notice>{error}</Notice></div> : null}
      {!shown.length ? (
        <p className="panel rounded-3xl px-4 py-10 text-center text-sm text-muted-foreground">No tasks yet. Tap “New task” to add one.</p>
      ) : (
        <ul className="grid gap-2">
          {shown.map((task) => {
            const overdue = isOverdue(task, today);
            return (
              <li key={task.id} className={cn("panel flex items-start gap-3 rounded-2xl p-3", overdue && "ring-2 ring-red-500/50 bg-red-500/5", task.done && "opacity-60")}>
                <input
                  type="checkbox"
                  className="mt-1 size-6 shrink-0 accent-primary"
                  checked={task.done}
                  disabled={pending}
                  aria-label={task.done ? "Mark not done" : "Mark done"}
                  onChange={(event) => run(() => setPreplannerTaskDoneAction(task.id, event.target.checked), event.target.checked ? "Marked done" : "Back on the list")}
                />
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    className={cn("block w-full text-left text-sm font-semibold text-foreground [overflow-wrap:anywhere]", task.done && "line-through")}
                    onClick={() => { setError(""); setForm({ id: task.id, task: task.task, phone: task.phone, email: task.email, holding: task.holding, nextFollowUp: task.nextFollowUp ?? "", state: task.state, done: task.done }); }}
                  >
                    {task.task}
                  </button>
                  {task.holding ? <p className="mt-0.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">Holding: {task.holding}</p> : null}
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {task.nextFollowUp ? (
                      <span className={cn("rounded-full px-2 py-0.5 font-medium", overdue ? "bg-red-500/15 text-red-800 dark:text-red-200" : "bg-muted text-foreground")}>
                        {overdue ? "Overdue · " : "Follow up "}{formatMedium(task.nextFollowUp)}
                      </span>
                    ) : null}
                    {task.state ? <span className="text-muted-foreground">{task.state}</span> : null}
                    {task.phone ? <a className="min-h-6 text-link underline" href={telHref(task.phone)}>{task.phone}</a> : null}
                    {task.email ? <a className="min-h-6 text-link underline [overflow-wrap:anywhere]" href={`mailto:${task.email}`}>{task.email}</a> : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={Boolean(form)} onOpenChange={(open) => { if (!open) setForm(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle className="font-heading text-foreground">{form?.id ? "Edit task" : "New task"}</DialogTitle></DialogHeader>
          {form ? (
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                run(() => savePreplannerTaskAction({ id: form.id, state: form.state, task: form.task, phone: form.phone, email: form.email, holding: form.holding, nextFollowUp: form.nextFollowUp || null, done: form.done }), form.id ? "Task saved" : "Task added", () => setForm(null));
              }}
            >
              <label className="grid gap-1 text-sm">
                <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Task (required)</span>
                <Textarea value={form.task} rows={3} required onChange={(event) => setForm({ ...form, task: event.target.value })} placeholder="Write whatever you need to do" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Phone (optional)</span>
                  <Input value={form.phone} inputMode="tel" autoComplete="off" onChange={(event) => setForm({ ...form, phone: event.target.value })} />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Email (optional)</span>
                  <Input value={form.email} type="email" inputMode="email" autoComplete="off" onChange={(event) => setForm({ ...form, email: event.target.value })} />
                </label>
              </div>
              <label className="grid gap-1 text-sm">
                <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Where it&apos;s holding</span>
                <Input value={form.holding} onChange={(event) => setForm({ ...form, holding: event.target.value })} placeholder="e.g. Waiting for a call back" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Next follow-up</span>
                  <Input type="date" value={form.nextFollowUp} onChange={(event) => setForm({ ...form, nextFollowUp: event.target.value })} />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">State</span>
                  {isAdmin ? (
                    <select className="h-10 rounded-lg border border-input bg-card px-3 text-sm" value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })}>
                      <option value="">No state</option>
                      {stateChoices.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                  ) : (
                    <Input value={form.state} readOnly aria-readonly="true" className="bg-muted" />
                  )}
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-5 accent-primary" checked={form.done} onChange={(event) => setForm({ ...form, done: event.target.checked })} /> Done
              </label>
              {error ? <Notice>{error}</Notice> : null}
              <div className="flex flex-wrap items-center justify-between gap-2">
                {form.id ? (
                  <Button type="button" variant="outline" className="min-h-11 rounded-full text-red-700 dark:text-red-300" onClick={() => { const t = tasks.find((item) => item.id === form.id); if (t) setConfirmDelete(t); }}>Delete</Button>
                ) : <span />}
                <Button type="submit" className="min-h-11 rounded-full" disabled={pending}>{pending ? "Saving…" : "Save task"}</Button>
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(confirmDelete)} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="font-heading text-foreground">Delete this task?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{confirmDelete?.task}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" className="min-h-11 rounded-full" onClick={() => setConfirmDelete(null)}>Keep it</Button>
            <Button type="button" className="min-h-11 rounded-full bg-red-700 text-white hover:bg-red-800" disabled={pending} onClick={() => confirmDelete && run(() => deletePreplannerTaskAction(confirmDelete.id), "Task deleted", () => { setConfirmDelete(null); setForm(null); })}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
