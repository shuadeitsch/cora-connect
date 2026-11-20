/** Admin-editable on/off switches per role. No saved row means "allowed", so today's behavior is the default. */
export type PermissionRole = "shliach" | "bochur";
export type PermissionDef = { key: string; label: string; help: string };

export const ROLE_PERMISSION_DEFS: Record<PermissionRole, PermissionDef[]> = {
  shliach: [
    { key: "edit_contacts", label: "Edit contacts", help: "Add and edit contacts in his territory." },
    { key: "log_visits", label: "Log visits", help: "Log and edit visits." },
    { key: "edit_routes", label: "Create and edit routes", help: "Build, save and change routes." },
    { key: "edit_planner", label: "Edit the Daily planner", help: "Add days and items to the planner." },
    { key: "preplanner", label: "Use the Pre-planner", help: "Open the Pre-planner (outreach and tasks). Hidden when off." },
    { key: "export", label: "Export contacts", help: "Download contacts as a file." },
    { key: "delete_contacts", label: "Remove contacts", help: "Hide or remove contacts from his list." },
    { key: "share_with_bochurim", label: "Share contacts with his bochurim", help: "Share contacts and turn on sharing for new ones." },
  ],
  bochur: [
    { key: "log_visits", label: "Log visits", help: "Log visits on contacts shared with him." },
    { key: "edit_routes", label: "Create and edit routes", help: "Build and change routes." },
    { key: "see_planner", label: "See the Daily planner", help: "Open the planner (his shliach still picks which days)." },
    { key: "edit_planner", label: "Edit the Daily planner", help: "Change the planner when his shliach also allows it." },
    { key: "preplanner", label: "Use the Pre-planner", help: "Open the Pre-planner (outreach and tasks). Hidden when off." },
    { key: "view_history", label: "See visit history and notes", help: "Past visits and notes on contacts." },
    { key: "view_contact", label: "See phone and email", help: "Phone numbers and email on contacts." },
  ],
};

export type RolePerms = Partial<Record<PermissionRole, Record<string, boolean>>>;

export function roleAllows(perms: RolePerms | undefined | null, role: string, key: string): boolean {
  if (role !== "shliach" && role !== "bochur") return true;
  return perms?.[role]?.[key] !== false;
}
