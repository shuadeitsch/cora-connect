"use client";

import { useState, useTransition } from "react";
import { usePractice } from "@/components/practice-provider";
import { Notice } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUndoToast } from "@/components/undo-toast";
import { deleteOutreachTemplateAction, saveOutreachTemplateAction } from "@/lib/actions";
import type { OutreachTemplate } from "@/lib/outreach";

const emptyForm = { id: "", name: "", subject: "", email: "", sms: "" };

export function EmailTemplatesCard({ templates, canManage }: { templates: OutreachTemplate[]; canManage: boolean }) {
  const announce = useUndoToast();
  const practice = usePractice();
  const catalog = templates;
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState("");

  if (!canManage) return null;

  function startNew() {
    setForm(emptyForm);
    setEditing(true);
    setError("");
    setConfirming("");
  }

  function startEdit(item: OutreachTemplate) {
    setForm({ id: item.id, name: item.name, subject: item.subject, email: item.email, sms: item.sms });
    setEditing(true);
    setError("");
    setConfirming("");
  }

  function cancel() {
    setEditing(false);
    setForm(emptyForm);
    setError("");
  }

  return (
    <section className="grid max-w-2xl gap-3 panel rounded-3xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-heading text-lg font-semibold text-foreground">Email templates</h2>
          <p className="text-sm text-muted-foreground">
            These drafts appear when someone emails or texts contacts. Use {"{first name}"} and {"{state}"} if you want those filled in for each message. Changing a template here does not change a message someone already started.
          </p>
        </div>
        {!editing ? (
          <Button type="button" className="min-h-11 rounded-full" onClick={startNew}>
            Add template
          </Button>
        ) : null}
      </div>

      {editing ? (
        <form
          className="grid gap-3 rounded-2xl border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            start(async () => {
              if (practice.active) {
                announce({ ok: true }, form.id ? "Template updated" : "Template added");
                cancel();
                return;
              }
              const result = await saveOutreachTemplateAction({
                id: form.id || undefined,
                name: form.name,
                subject: form.subject,
                email: form.email,
                sms: form.sms,
              });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              announce(result, form.id ? "Template updated" : "Template added");
              cancel();
            });
          }}
        >
          <label className="grid gap-1 text-sm">
            <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Name</span>
            <Input className="min-h-11" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Email subject</span>
            <Input className="min-h-11" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Email message</span>
            <Textarea className="min-h-28" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Text / WhatsApp message</span>
            <Textarea className="min-h-24" value={form.sms} onChange={(event) => setForm({ ...form, sms: event.target.value })} />
          </label>
          {error ? <Notice>{error}</Notice> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="min-h-11 rounded-full" disabled={pending}>
              {pending ? "Saving…" : "Save template"}
            </Button>
            <Button type="button" variant="outline" className="min-h-11 rounded-full" onClick={cancel}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {!catalog.length && !editing ? (
        <p className="text-sm text-muted-foreground">No templates yet. Add one to start, or the built-in drafts will be used until you save your own.</p>
      ) : null}
      <ul className="grid gap-2">
        {catalog.map((item) => (
          <li key={item.id} className="rounded-2xl border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{item.name}</p>
                {item.subject ? <p className="truncate text-sm text-muted-foreground">{item.subject}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="min-h-11 rounded-full" onClick={() => startEdit(item)}>
                  Edit
                </Button>
                {confirming === item.id ? (
                  <>
                    <Button type="button" variant="outline" className="min-h-11 rounded-full" onClick={() => setConfirming("")}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="min-h-11 rounded-full"
                      disabled={pending}
                      onClick={() => start(async () => {
                        if (practice.active) {
                          announce({ ok: true }, "Template deleted");
                          setConfirming("");
                          return;
                        }
                        const result = await deleteOutreachTemplateAction(item.id);
                        if (!result.ok) {
                          setError(result.error);
                          return;
                        }
                        announce(result, "Template deleted");
                        setConfirming("");
                      })}
                    >
                      {pending ? "Deleting…" : "Delete"}
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="outline" className="min-h-11 rounded-full" onClick={() => setConfirming(item.id)}>
                    Delete
                  </Button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
