import type { TeamMember } from "@/lib/types";

/** True when an admin can (re)send the invite email: open invite, or a login that has never signed in. */
export function canResendInvite(member: Pick<TeamMember, "kind" | "status" | "hasSignedIn">) {
  if (member.kind === "invite" || member.status === "invited") return true;
  return member.hasSignedIn === false;
}
