import type { ReactNode } from "react";
import Link from "next/link";

export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="safe-page min-app-frame mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <article className="glass rounded-3xl p-6 sm:p-8">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">Chabad of Maine (CORA)</p>
        <h1 className="mt-2 font-heading text-3xl font-semibold text-foreground">{title}</h1>
        <div className="mt-5 grid gap-4 text-sm leading-relaxed text-foreground sm:text-base">
          {children}
        </div>
        <nav className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <Link className="text-primary underline" href="/privacy">Privacy Policy</Link>
          <Link className="text-primary underline" href="/terms">Terms</Link>
          <a className="text-primary underline" href="mailto:info@chabadora.com">info@chabadora.com</a>
        </nav>
      </article>
    </main>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-heading text-lg font-semibold text-foreground">{heading}</h2>
      <div className="mt-1.5 grid gap-3">{children}</div>
    </section>
  );
}
