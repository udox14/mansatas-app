// components/shared/PageSkeleton.tsx

export function PageSkeleton() {
  return (
    <div className="space-y-4 animate-pulse pb-12">
      {/* PageHeader skeleton */}
      <div className="space-y-2 pt-1 pb-2">
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="h-4 w-72 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
      </div>

      {/* Stats / card row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50" />
        ))}
      </div>

      {/* Main content block */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900 overflow-hidden">
        {/* Table header */}
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="ml-auto h-8 w-24 bg-slate-100 dark:bg-slate-800 rounded-lg" />
        </div>
        {/* Table rows */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-slate-50 dark:border-slate-800/60 last:border-0">
            <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded w-3/5" />
              <div className="h-3 bg-slate-50 dark:bg-slate-800/60 rounded w-2/5" />
            </div>
            <div className="h-6 w-16 rounded-full bg-slate-100 dark:bg-slate-800 shrink-0" />
          </div>
        ))}
      </div>

      {/* Second block */}
      <div className="h-32 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50" />
    </div>
  )
}
