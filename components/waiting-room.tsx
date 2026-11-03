import { Hourglass } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/actions";
import type { MemberStatus } from "@/lib/types";

const COPY: Record<string, { title: string; body: string }> = {
  rejected: {
    title: "Account not approved",
    body: "An admin declined this account. You can sign out. If they approve it later, sign in again.",
  },
  disabled: {
    title: "Account turned off",
    body: "An admin turned this account off. You can sign out. If they approve it again, sign in with the same password.",
  },
  pending: {
    title: "Waiting for approval",
    body: "A Cora admin has to approve this account before you can see contacts.",
  },
};

export function WaitingRoom({ name, email, status }: { name: string; email: string; status: MemberStatus }) {
  const copy = COPY[status] ?? COPY.pending!;
  return (
    <div className="safe-page min-app-frame relative flex items-center justify-center px-4 py-12">
      <div className="absolute top-3 right-3">
        <ThemeToggle />
      </div>
      <div className="page-enter glass w-full max-w-md rounded-3xl p-6 sm:p-8">
        <Logo />
        <div className="mt-6 flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <Hourglass className="size-5" />
        </div>
        <h1 className="mt-4 font-heading text-3xl font-semibold text-foreground">{copy.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{copy.body}</p>
        <p className="mt-4 text-sm font-medium text-foreground">{name}</p>
        <p className="text-sm text-muted-foreground">{email}</p>
        <form action={logoutAction} className="mt-6">
          <Button type="submit" variant="outline" className="h-11 rounded-full px-5">Sign out</Button>
        </form>
      </div>
    </div>
  );
}
