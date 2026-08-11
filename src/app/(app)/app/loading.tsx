export default function Loading() {
  return (
    <div
      className="mx-auto max-w-5xl space-y-6 p-5 sm:p-8"
      role="status"
      aria-label="Loading page"
    >
      <div className="skeleton h-8 w-52" />
      <div className="skeleton h-4 w-80 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="skeleton h-32" />
        <div className="skeleton h-32" />
      </div>
      <div className="skeleton h-64" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
