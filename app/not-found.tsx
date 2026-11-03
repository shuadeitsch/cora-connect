import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="font-heading text-3xl font-semibold text-foreground">That page isn&apos;t here</h1>
      <p className="mt-2 text-sm text-mutedink">The link may be old, or the record was deleted.</p>
      <Link href="/dashboard" className="mt-4 inline-block text-sm font-medium text-link">
        Back to the dashboard
      </Link>
    </div>
  );
}
