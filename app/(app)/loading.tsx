export default function Loading() {
  return (
    <div className="space-y-4 p-4 sm:p-6" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-10 w-56 rounded-2xl" />
      <div className="skeleton h-4 w-40 rounded-full" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="skeleton h-36 rounded-3xl" />
        ))}
      </div>
      <div className="skeleton h-64 rounded-3xl" />
    </div>
  );
}
