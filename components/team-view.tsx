"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Search } from "lucide-react";
import { Notice, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { deleteMemberAction, saveMemberAction } from "@/lib/actions";
import { ACCOUNT_STATUS_LABEL, ROLE_LABEL } from "@/lib/constants";
import { formatMedium } from "@/lib/format";
import type { AppData, MemberInput, Role, TeamMember } from "@/lib/types";

const field = "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm";

function blankMember(): MemberInput {
  return {
    name: "",
    email: "",
    role: "visitor",
    expiresAt: "",
    canViewHistory: true,
    canViewContact: true,
    canEdit: false,
    assignedRouteIds: [],
  };
}

function fromMember(member: TeamMember): MemberInput {
  return {
    id: member.id,
    kind: member.kind,
    name: member.name,
    email: member.email,
    role: member.role,
    expiresAt: member.expiresAt?.slice(0, 10) ?? "",
    canViewHistory: member.canViewHistory,
    canViewContact: member.canViewContact,
    canEdit: member.canEdit,
    assignedRouteIds: member.assignedRouteIds,
  };
}

function accessLabel(expiresAt: string | null) {
  if (!expiresAt) return { label: "Valid", tone: "ok" as const };
  const today = new Date().toISOString().slice(0, 10);
  return expiresAt.slice(0, 10) < today
    ? { label: "Expired", tone: "bad" as const }
    : { label: "Valid", tone: "ok" as const };
}

export function TeamView({ data, startInvite }: { data: AppData; startInvite: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [open, setOpen] = useState(startInvite);
  const [form, setForm] = useState<MemberInput>(blankMember);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const rows = useMemo(
    () => data.members.filter((member) => `${member.name} ${member.email}`.toLowerCase().includes(query.trim().toLowerCase())),
    [data.members, query],
  );
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safe = Math.min(page, pages);
  const slice = rows.slice((safe - 1) * pageSize, safe * pageSize);
  const volunteers = data.members.filter((member) => member.role !== "admin");

  function edit(member: TeamMember) {
    setForm(fromMember(member));
    setError("");
    setOpen(true);
  }

  function save() {
    setError("");
    start(async () => {
      const result = await saveMemberAction(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setForm(blankMember());
      router.refresh();
    });
  }

  function remove(member: TeamMember) {
    if (member.id === data.viewer.id) return;
    if (!confirm(`Remove ${member.name} from the team?`)) return;
    start(async () => {
      const result = await deleteMemberAction(member.id, member.kind);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="My team"
        crumb="My team"
        action={
          data.viewer.canManage ? (
            <Button
              className="rounded-full"
              onClick={() => {
                setForm(blankMember());
                setError("");
                setOpen(true);
              }}
            >
              Share access to this account
            </Button>
          ) : null
        }
      />
      {error && !open ? <div className="mb-3"><Notice>{error}</Notice></div> : null}
      <section className="mb-4 panel rounded-3xl p-4">
        <h2 className="font-heading text-lg font-semibold text-foreground">Volunteers</h2>
        {volunteers.length ? (
          <p className="text-sm text-mutedink">{volunteers.length} volunteer{volunteers.length === 1 ? "" : "s"} can visit households on this account.</p>
        ) : (
          <p className="text-sm text-mutedink">No one has offered to help yet. Share access to invite a visitor.</p>
        )}
      </section>
      <div className="panel overflow-hidden rounded-3xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
          <div className="relative">
            <Search className="absolute top-2.5 left-2.5 size-4 text-mutedink" />
            <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search name" className="w-56 pl-8" />
          </div>
          <p className="text-xs text-mutedink">
            Showing
            <select className="mx-1 rounded-md border px-1 py-0.5" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
              {[10, 25, 50].map((size) => <option key={size}>{size}</option>)}
            </select>
            of {rows.length} entries
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="text-[11px] tracking-wide text-mutedink uppercase">
              <tr className="border-b">
                {["Visitor name", "Email", "Role", "Status", "Permission status", ""].map((label) => (
                  <th key={label} className="px-3 py-2 font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slice.map((member) => {
                const access = accessLabel(member.expiresAt);
                return (
                  <tr key={member.id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-semibold text-foreground">{member.name}</td>
                    <td className="px-3 py-2 text-mutedink">{member.email}</td>
                    <td className="px-3 py-2">{ROLE_LABEL[member.role] ?? member.role}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] text-orange-700 ring-1 ring-orange-200">
                        {ACCOUNT_STATUS_LABEL[member.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={access.tone === "ok" ? "rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 ring-1 ring-emerald-200" : "rounded-full bg-red-50 px-2 py-0.5 text-[11px] text-red-700 ring-1 ring-red-200"}>
                        {access.label}
                      </span>
                      {member.expiresAt ? <div className="mt-1 text-[11px] text-mutedink">Until {formatMedium(member.expiresAt)}</div> : null}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {data.viewer.canManage ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" aria-label={`Actions for ${member.name}`} className="inline-flex size-8 items-center justify-center rounded-full hover:bg-muted">
                              <MoreHorizontal className="size-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => edit(member)}>Edit access</DropdownMenuItem>
                            {member.id !== data.viewer.id ? <DropdownMenuItem onClick={() => remove(member)}>Remove</DropdownMenuItem> : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!slice.length ? <p className="px-4 py-10 text-center text-sm text-mutedink">No teammates match that search.</p> : null}
        {pages > 1 ? (
          <div className="flex justify-end gap-1 px-3 py-3">
            {Array.from({ length: pages }, (_, index) => index + 1).map((n) => (
              <button key={n} type="button" className={n === safe ? "size-8 rounded-full bg-primary text-sm text-primary-foreground" : "size-8 rounded-full text-sm"} onClick={() => setPage(n)}>{n}</button>
            ))}
          </div>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit access" : "Share access"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Name</span>
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Email</span>
              <Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Role</span>
                <select className={field} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })}>
                  <option value="admin">Admin</option>
                  <option value="visitor">Visitor</option>
                  <option value="limited">Limited</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Access expires</span>
                <Input type="date" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} />
              </label>
            </div>
            <p className="text-xs text-mutedink">Leave the date empty for access that does not expire. Limited visitors only see households on the routes you assign.</p>
            {form.role !== "admin" ? (
              <div className="grid gap-2 rounded-xl bg-background p-3">
                <Toggle label="View visit history and notes" checked={form.canViewHistory} onChange={(checked) => setForm({ ...form, canViewHistory: checked })} />
                <Toggle label="View phone, email, and WhatsApp" checked={form.canViewContact} onChange={(checked) => setForm({ ...form, canViewContact: checked })} />
                <Toggle label="Edit the household database" checked={form.canEdit} onChange={(checked) => setForm({ ...form, canEdit: checked })} />
              </div>
            ) : null}
            {form.role === "limited" ? (
              <div className="grid gap-2">
                <Label>Assigned routes</Label>
                {data.routes.length ? data.routes.map((route) => (
                  <label key={route.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.assignedRouteIds.includes(route.id)}
                      onCheckedChange={(value) => setForm({
                        ...form,
                        assignedRouteIds: value
                          ? [...form.assignedRouteIds, route.id]
                          : form.assignedRouteIds.filter((id) => id !== route.id),
                      })}
                    />
                    {route.name}
                  </label>
                )) : <p className="text-sm text-mutedink">Save a route on the map first, then assign it here.</p>}
              </div>
            ) : null}
            {form.id ? null : <p className="text-xs text-mutedink">They create an account with this email and a password, then wait on the approval screen. Approve them from Users. An admin can also grant the admin role here after they are approved.</p>}
            {error ? <Notice>{error}</Notice> : null}
            <div className="flex justify-end">
              <Button className="rounded-full" disabled={pending || !data.viewer.canManage} onClick={save}>
                {pending ? "Saving…" : form.id ? "Save access" : "Send invite"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm text-foreground">
      {label}
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
