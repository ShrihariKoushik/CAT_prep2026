// Route-transition feedback: shown instantly while a page's server data loads,
// so navigation never looks like a dead button.
export default function Loading() {
  return (
    <div className="pt-24 flex flex-col items-center gap-3 text-ink-600 dark:text-cream-300">
      <div className="h-8 w-8 rounded-full border-2 border-terra-500 border-t-transparent animate-spin" />
      <p className="text-sm">loading…</p>
    </div>
  );
}
