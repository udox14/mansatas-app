// Widget katalog: ringkasan saran yang dikirim orang tua melalui portal.
import Link from 'next/link'
import { ArrowRight, ChatCenteredText } from '@phosphor-icons/react/dist/ssr'
import { ensureParentSuggestionTable } from '@/lib/parent-suggestions'
import { formatDateTimeWIB } from '@/lib/time'
import { getDB } from '@/utils/db'
import type { WidgetProps } from '@/lib/dashboard-widgets-meta'

type SuggestionSummary = {
  total: number
  baru: number
  dibaca: number
  diproses: number
  selesai: number
}

type RecentSuggestion = {
  id: string
  category: string
  title: string
  status: 'baru' | 'dibaca' | 'diproses'
  is_anonymous: number
  created_at: string
  siswa_nama: string | null
}

const statusMeta = {
  baru: { label: 'Baru', dot: 'bg-rose-500', text: 'text-rose-600' },
  dibaca: { label: 'Dibaca', dot: 'bg-sky-500', text: 'text-sky-600' },
  diproses: { label: 'Diproses', dot: 'bg-amber-500', text: 'text-amber-600' },
} as const

export async function SaranOrangTuaWidget(_props: WidgetProps) {
  const db = await getDB()
  await ensureParentSuggestionTable(db)

  const [summaryRow, recentRows] = await Promise.all([
    db.prepare(`
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN status = 'baru' THEN 1 ELSE 0 END), 0) AS baru,
        COALESCE(SUM(CASE WHEN status = 'dibaca' THEN 1 ELSE 0 END), 0) AS dibaca,
        COALESCE(SUM(CASE WHEN status = 'diproses' THEN 1 ELSE 0 END), 0) AS diproses,
        COALESCE(SUM(CASE WHEN status = 'selesai' THEN 1 ELSE 0 END), 0) AS selesai
      FROM parent_suggestions
    `).first<SuggestionSummary>(),
    db.prepare(`
      SELECT ps.id, ps.category, ps.title, ps.status, ps.is_anonymous,
             ps.created_at, s.nama_lengkap AS siswa_nama
      FROM parent_suggestions ps
      LEFT JOIN siswa s ON s.id = ps.siswa_id
      WHERE ps.status != 'selesai'
      ORDER BY datetime(ps.created_at) DESC
      LIMIT 4
    `).all<RecentSuggestion>().then(result => result.results ?? []),
  ])

  const summary = {
    total: Number(summaryRow?.total ?? 0),
    baru: Number(summaryRow?.baru ?? 0),
    dibaca: Number(summaryRow?.dibaca ?? 0),
    diproses: Number(summaryRow?.diproses ?? 0),
    selesai: Number(summaryRow?.selesai ?? 0),
  }
  const perluTindakLanjut = summary.baru + summary.dibaca + summary.diproses

  return (
    <div className="overflow-hidden rounded-xl border border-surface bg-surface shadow-sm">
      <div className="flex items-center gap-2 border-b border-surface-2 px-4 py-3">
        <div className="rounded-md border border-violet-100 bg-violet-50 p-1.5 dark:border-violet-900/50 dark:bg-violet-900/20">
          <ChatCenteredText className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Saran Orang Tua</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            {perluTindakLanjut} perlu tindak lanjut · {summary.total} saran masuk
          </p>
        </div>
        <Link
          href="/dashboard/kotak-saran-ortu"
          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          Detail <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-lg bg-rose-50 px-2 py-2.5 text-center dark:bg-rose-900/20">
            <p className="text-lg font-bold tabular-nums text-rose-600 dark:text-rose-400">{summary.baru}</p>
            <p className="text-[9px] font-medium text-rose-700 dark:text-rose-400">Baru</p>
          </div>
          <div className="rounded-lg bg-sky-50 px-2 py-2.5 text-center dark:bg-sky-900/20">
            <p className="text-lg font-bold tabular-nums text-sky-600 dark:text-sky-400">{summary.dibaca}</p>
            <p className="text-[9px] font-medium text-sky-700 dark:text-sky-400">Dibaca</p>
          </div>
          <div className="rounded-lg bg-amber-50 px-2 py-2.5 text-center dark:bg-amber-900/20">
            <p className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">{summary.diproses}</p>
            <p className="text-[9px] font-medium text-amber-700 dark:text-amber-400">Diproses</p>
          </div>
          <div className="rounded-lg bg-emerald-50 px-2 py-2.5 text-center dark:bg-emerald-900/20">
            <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{summary.selesai}</p>
            <p className="text-[9px] font-medium text-emerald-700 dark:text-emerald-400">Selesai</p>
          </div>
        </div>

        {recentRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 py-5 text-slate-400 dark:text-slate-500">
            <ChatCenteredText className="h-5 w-5 text-emerald-400" />
            <p className="text-xs">Tidak ada saran yang perlu ditindaklanjuti</p>
          </div>
        ) : (
          <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800/70">
            {recentRows.map(item => {
              const meta = statusMeta[item.status]
              const sender = Number(item.is_anonymous) === 1 ? 'Anonim' : item.siswa_nama || 'Orang tua siswa'
              const createdAt = formatDateTimeWIB(item.created_at, {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })

              return (
                <Link
                  key={item.id}
                  href={`/dashboard/kotak-saran-ortu?status=${item.status}`}
                  className="flex min-w-0 items-start gap-2 py-2 first:pt-0 last:pb-0"
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-slate-700 dark:text-slate-200">{item.title}</span>
                    <span className="block truncate text-[10px] text-slate-400 dark:text-slate-500">
                      {item.category} · {sender} · {createdAt}
                    </span>
                  </span>
                  <span className={`shrink-0 text-[9px] font-semibold ${meta.text}`}>{meta.label}</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
