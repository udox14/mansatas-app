// components/dashboard/shared/FeatureShortcuts.tsx
import { getDB } from '@/utils/db'
import { getAllowedMenuItems } from '@/lib/features'
import { QuickLink } from './QuickLink'
import { LayoutGrid } from 'lucide-react'

const SHORTCUT_META: Record<string, { desc: string; bg: string; color: string }> = {
  siswa: { desc: 'Kelola data siswa', bg: 'bg-blue-50 dark:bg-blue-900/30', color: 'text-blue-600 dark:text-blue-400' },
  kelas: { desc: 'Kelola data rombel', bg: 'bg-amber-50 dark:bg-amber-900/30', color: 'text-amber-600 dark:text-amber-400' },
  plotting: { desc: 'Kenaikan kelas', bg: 'bg-purple-50 dark:bg-purple-900/30', color: 'text-purple-600 dark:text-purple-400' },
  akademik: { desc: 'Pusat akademik', bg: 'bg-cyan-50 dark:bg-cyan-900/30', color: 'text-cyan-600 dark:text-cyan-400' },
  'akademik-nilai': { desc: 'Rekap capaian siswa', bg: 'bg-emerald-50 dark:bg-emerald-900/30', color: 'text-emerald-600 dark:text-emerald-400' },
  guru: { desc: 'Data guru & pegawai', bg: 'bg-emerald-50 dark:bg-emerald-900/30', color: 'text-emerald-600 dark:text-emerald-400' },
  kehadiran: { desc: 'Input absensi kelas', bg: 'bg-blue-50 dark:bg-blue-900/30', color: 'text-blue-600 dark:text-blue-400' },
  'rekap-absensi': { desc: 'Laporan kehadiran', bg: 'bg-emerald-50 dark:bg-emerald-900/30', color: 'text-emerald-600 dark:text-emerald-400' },
  agenda: { desc: 'Input jurnal mengajar', bg: 'bg-emerald-50 dark:bg-emerald-900/30', color: 'text-emerald-600 dark:text-emerald-400' },
  penugasan: { desc: 'Delegasi kelas', bg: 'bg-purple-50 dark:bg-purple-900/30', color: 'text-purple-600 dark:text-purple-400' },
  'monitoring-agenda': { desc: 'Pantau jurnal harian', bg: 'bg-blue-50 dark:bg-blue-900/30', color: 'text-blue-600 dark:text-blue-400' },
  izin: { desc: 'Perizinan siswa', bg: 'bg-rose-50 dark:bg-rose-900/30', color: 'text-rose-600 dark:text-rose-400' },
  kedisiplinan: { desc: 'Catatan poin siswa', bg: 'bg-rose-50 dark:bg-rose-900/30', color: 'text-rose-600 dark:text-rose-400' },
  bk: { desc: 'Bimbingan konseling', bg: 'bg-cyan-50 dark:bg-cyan-900/30', color: 'text-cyan-600 dark:text-cyan-400' },
  psikotes: { desc: 'Data tes & minat', bg: 'bg-purple-50 dark:bg-purple-900/30', color: 'text-purple-600 dark:text-purple-400' },
  sarpras: { desc: 'Inventaris & aset', bg: 'bg-rose-50 dark:bg-rose-900/30', color: 'text-rose-600 dark:text-rose-400' },
  settings: { desc: 'Konfigurasi aplikasi', bg: 'bg-slate-100 dark:bg-slate-800', color: 'text-slate-600 dark:text-slate-400' },
}

const DEFAULT_META = { desc: 'Akses menu fitur', bg: 'bg-slate-100 dark:bg-slate-800', color: 'text-slate-600 dark:text-slate-400' }

export async function FeatureShortcuts({ userId }: { userId: string }) {
  const db = await getDB()
  const allowed = await getAllowedMenuItems(db, userId)
  const shortcuts = allowed.filter(m => m.id !== 'dashboard')

  if (shortcuts.length === 0) return null

  return (
    <div className="rounded-xl border border-surface bg-surface shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
        <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <LayoutGrid className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Jalan Pintas Akses</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">Fitur yang bisa Anda akses</p>
        </div>
      </div>
      <div className="p-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-0.5">
        {shortcuts.map(s => {
          const meta = SHORTCUT_META[s.id] || DEFAULT_META
          const Icon = s.icon as any
          return (
            <QuickLink
              key={s.id}
              href={s.href}
              icon={<Icon className="h-4 w-4" />}
              title={s.title}
              desc={meta.desc}
              iconBg={meta.bg}
              iconColor={meta.color}
            />
          )
        })}
      </div>
    </div>
  )
}
