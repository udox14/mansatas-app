// components/dashboard/shared/PenugasanMasukCard.tsx
import Link from 'next/link'
import { getDB } from '@/utils/db'
import { todayWIB } from '@/lib/time'
import { Tray as Inbox, PaperPlaneTilt as Send, ArrowRight, ClipboardText as ClipboardList } from '@phosphor-icons/react/dist/ssr'

type Props = {
  userId: string
}

export async function PenugasanMasukCard({ userId }: Props) {
  const db = await getDB()
  const today = todayWIB()

  // Ambil hitungan penugasan (delegasi) masuk hari ini
  const result = await db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN absen_selesai = 1 THEN 1 ELSE 0 END) as selesai
    FROM delegasi_tugas_kelas dtk
    JOIN delegasi_tugas dt ON dtk.delegasi_id = dt.id
    WHERE dt.kepada_user_id = ? AND dt.tanggal = ?
  `).bind(userId, today).first<{ total: number; selesai: number }>()

  const total = result?.total ?? 0
  const selesai = result?.selesai ?? 0
  const belum = total - selesai

  if (total === 0) return null

  return (
    <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden mb-3 animate-in fade-in slide-in-from-top-2 duration-500">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2 bg-violet-50/30 dark:bg-violet-900/10">
        <div className="p-1.5 rounded-md bg-violet-50 border border-violet-100 shrink-0">
          <Inbox className="h-3.5 w-3.5 text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Penugasan Masuk</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            {total} kelas didelegasikan · {selesai} selesai
          </p>
        </div>
        <Link 
          href="/dashboard/penugasan" 
          className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-700 dark:text-violet-400 hover:bg-violet-100/50 px-2 py-1 rounded-md transition-colors"
        >
          Lihat <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
              {belum > 0 
                ? `Ada ${belum} kelas yang butuh bantuan Anda hari ini.` 
                : 'Semua penugasan delegasi sudah selesai ditangani.'}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              Ketuk tombol "Lihat" untuk membuka daftar tugas dan melakukan absensi.
            </p>
          </div>
          <div className="shrink-0 flex flex-col items-center justify-center h-12 w-12 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800">
            <ClipboardList className="h-5 w-5" />
          </div>
        </div>
      </div>
      
      {belum > 0 && (
        <div className="px-4 py-2 border-t border-violet-100 bg-violet-50/60 dark:bg-violet-900/10">
          <p className="text-[10px] text-violet-700 dark:text-violet-400">
            ⚠ Anda bertugas sebagai Guru Piket — harap pastikan kelas yang dititipkan terabsen.
          </p>
        </div>
      )}
    </div>
  )
}
