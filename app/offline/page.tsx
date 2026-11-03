import { Logo } from "@/components/logo";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="safe-page min-app-frame flex items-center justify-center px-4 py-12">
      <div className="glass w-full max-w-md rounded-3xl p-6 sm:p-8">
        <Logo />
        <h1 className="mt-6 font-heading text-3xl font-semibold text-foreground">You&apos;re offline</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cora Connect can open, but contacts need a connection. Try again when you&apos;re back online.
        </p>
        <a href="/login" className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground">
          Try again
        </a>
      </div>
    </div>
  );
}
