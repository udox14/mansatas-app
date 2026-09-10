import { LayoutGrid } from 'lucide-react'
import { FeatureShortcuts } from './shared/FeatureShortcuts'

export function GeneralDashboard({ userId, dashboardVisibility }: { userId: string; dashboardVisibility?: Record<string, boolean> }) {
  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <LayoutGrid className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Beranda kerja</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Gunakan fitur yang tersedia sesuai kewenangan akun Anda.</p>
          </div>
        </div>
      </section>
      {dashboardVisibility?.feature_shortcuts !== false && <FeatureShortcuts userId={userId} />}
    </div>
  )
}
