"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Notice } from "@/components/page-header";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/toast";
import { setRolePermissionAction } from "@/lib/role-permission-actions";
import { ROLE_PERMISSION_DEFS, type PermissionRole } from "@/lib/role-permissions";
import type { AppData } from "@/lib/types";

const ROLES: { role: PermissionRole; title: string; info: string[] }[] = [
  {
    role: "shliach",
    title: "Shliach",
    info: [
      "Messaging (email, texts, WhatsApp, calls, Inbox): admins only for now. Not a switch.",
      "Each shliach also chooses, in his own Settings: whether his bochurim see and edit the Daily planner, and whether new contacts are shared with them. The switches here are the limit; his choices work inside it.",
      "Always on: sees and manages only his own state; approves his own bochurim in My Team.",
    ],
  },
  {
    role: "bochur",
    title: "Bochur",
    info: [
      "Messaging: admins only for now. Not a switch.",
      "Always on: sees only contacts his shliach shares with him, and can suggest edits to a contact instead of editing it. No My Team.",
    ],
  },
];

/** Admin-only: one on/off switch for each thing a shliach or bochur can do. Saved in role_permissions; enforced in the app and in the database. */
export function PermissionsSettings({ data }: { data: AppData }) {
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const saved = data.rolePermissions ?? {};
  const valueOf = (role: PermissionRole, key: string) => {
    const id = `${role}:${key}`;
    return id in draft ? draft[id]! : saved[role]?.[key] !== false;
  };

  function change(role: PermissionRole, key: string, enabled: boolean) {
    const id = `${role}:${key}`;
    setError("");
    setDraft((current) => ({ ...current, [id]: enabled }));
    void setRolePermissionAction({ role, permission: key, enabled }).then((result) => {
      if (!result.ok) {
        setDraft((current) => ({ ...current, [id]: !enabled }));
        setError(result.error);
        toast({ title: result.error, tone: "error" });
        return;
      }
      toast({ title: enabled ? "Turned on" : "Turned off", tone: "ok" });
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">One switch for each thing a shliach or a bochur can do. Everything starts on, like today. Turning one off hides it and blocks it on the server too.</p>
      {error ? <Notice>{error}</Notice> : null}
      {ROLES.map(({ role, title, info }) => (
        <section key={role} className="panel rounded-3xl p-4" aria-label={`${title} permissions`}>
          <h2 className="font-heading text-lg font-semibold text-foreground">{title}</h2>
          <ul className="mt-2 divide-y">
            {ROLE_PERMISSION_DEFS[role].map((def) => (
              <li key={def.key} className="flex items-center justify-between gap-3 py-2.5">
                <label htmlFor={`perm-${role}-${def.key}`} className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{def.label}</span>
                  <span className="block text-xs text-muted-foreground">{def.help}</span>
                </label>
                <Switch id={`perm-${role}-${def.key}`} checked={valueOf(role, def.key)} onCheckedChange={(next) => change(role, def.key, next)} aria-label={`${title}: ${def.label}`} />
              </li>
            ))}
          </ul>
          <div className="mt-2 grid gap-1.5 rounded-2xl bg-muted/50 p-3 text-xs text-muted-foreground">
            {info.map((line, index) => (
              <p key={line} className="flex gap-1.5">{index === 0 ? <Lock className="mt-0.5 size-3 shrink-0" aria-hidden="true" /> : null}<span>{line}</span></p>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
