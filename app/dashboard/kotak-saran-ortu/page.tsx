import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import {
  PARENT_SUGGESTION_CATEGORIES,
  PARENT_SUGGESTION_STATUSES,
  ensureParentSuggestionTable,
  normalizeParentSuggestionCategory,
  normalizeParentSuggestionStatus,
} from '@/lib/parent-suggestions'
import { updateParentSuggestionStatus } from './actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Kotak Saran Orang Tua | MANSATAS' }

const statusLabels: Record<string, string> = {
  baru: 'Baru',
  dibaca: 'Dibaca',
  diproses: 'Diproses',
  selesai: 'Selesai',
}

const statusClass: Record<string, string> = {
  baru: 'bg-rose-50 text-rose-700 border-rose-200',
  dibaca: 'bg-sky-50 text-sky-700 border-sky-200',
  diproses: 'bg-amber-50 text-amber-700 border-amber-200',
  selesai: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

function bindOptional(value: string | null, params: unknown[], clause: string) {
  if (!value) return ''
  params.push(value)
  return clause
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  return value.replace('T', ' ').slice(0, 16)
}

export default async function KotakSaranOrtuPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'kotak-saran-ortu')
  if (!allowed) redirect('/dashboard')
  await ensureParentSuggestionTable(db)

  const paramsObj = (await searchParams) || {}
  const getParam = (key: string) => {
    const value = paramsObj[key]
    return Array.isArray(value) ? value[0] || '' : value || ''
  }

  const category = normalizeParentSuggestionCategory(getParam('category'))
  const status = normalizeParentSuggestionStatus(getParam('status'))
  const startDate = getParam('startDate').trim()
  const endDate = getParam('endDate').trim()
  const q = getParam('q').trim()

  const where: string[] = []
  const bind: unknown[] = []
  const categoryClause = bindOptional(category, bind, 'ps.category = ?')
  if (categoryClause) where.push(categoryClause)
  const statusClause = bindOptional(status, bind, 'ps.status = ?')
  if (statusClause) where.push(statusClause)
  if (startDate) {
    where.push('date(ps.created_at) >= date(?)')
    bind.push(startDate)
  }
  if (endDate) {
    where.push('date(ps.created_at) <= date(?)')
    bind.push(endDate)
  }
  if (q) {
    where.push(`(
      ps.title LIKE ?
      OR ps.message LIKE ?
      OR s.nama_lengkap LIKE ?
      OR s.nisn LIKE ?
      OR ps.parent_user_id LIKE ?
    )`)
    const pattern = `%${q}%`
    bind.push(pattern, pattern, pattern, pattern, pattern)
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const [rows, summary] = await Promise.all([
    db.prepare(`
      SELECT ps.id, ps.parent_user_id, ps.siswa_id, ps.category, ps.title, ps.message,
             ps.is_anonymous, ps.status, ps.read_at, ps.handled_at, ps.created_at, ps.updated_at,
             s.nisn, s.nama_lengkap AS siswa_nama,
             k.tingkat, k.nomor_kelas, k.kelompok,
             u.nama_lengkap AS handled_by_name
      FROM parent_suggestions ps
      LEFT JOIN siswa s ON s.id = ps.siswa_id
      LEFT JOIN kelas k ON k.id = s.kelas_id
      LEFT JOIN "user" u ON u.id = ps.handled_by
      ${whereSql}
      ORDER BY datetime(ps.created_at) DESC
      LIMIT 200
    `).bind(...bind).all<any>(),
    db.prepare(`
      SELECT status, COUNT(*) AS total
      FROM parent_suggestions
      GROUP BY status
    `).all<{ status: string; total: number }>(),
  ])

  const summaryMap = new Map((summary.results || []).map((row) => [row.status, Number(row.total || 0)]))

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Kotak Saran Orang Tua</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Pantau masukan orang tua dan tandai progres tindak lanjutnya.</p>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          {PARENT_SUGGESTION_STATUSES.map((item) => (
            <div key={item} className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-base font-bold text-slate-900 dark:text-slate-100">{summaryMap.get(item) || 0}</p>
              <p className="text-[10px] font-medium text-slate-500">{statusLabels[item]}</p>
            </div>
          ))}
        </div>
      </div>

      <form className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[1.2fr_1fr_1fr_1fr_1fr_auto]">
        <input
          name="q"
          defaultValue={q}
          placeholder="Cari judul, isi, nama siswa, NISN..."
          className="h-9 rounded-md border border-slate-200 bg-transparent px-3 text-xs outline-none focus:border-slate-400 dark:border-slate-700"
        />
        <select name="category" defaultValue={category || ''} className="h-9 rounded-md border border-slate-200 bg-transparent px-3 text-xs outline-none dark:border-slate-700">
          <option value="">Semua kategori</option>
          {PARENT_SUGGESTION_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select name="status" defaultValue={status || ''} className="h-9 rounded-md border border-slate-200 bg-transparent px-3 text-xs outline-none dark:border-slate-700">
          <option value="">Semua status</option>
          {PARENT_SUGGESTION_STATUSES.map((item) => <option key={item} value={item}>{statusLabels[item]}</option>)}
        </select>
        <input name="startDate" type="date" defaultValue={startDate} className="h-9 rounded-md border border-slate-200 bg-transparent px-3 text-xs outline-none dark:border-slate-700" />
        <input name="endDate" type="date" defaultValue={endDate} className="h-9 rounded-md border border-slate-200 bg-transparent px-3 text-xs outline-none dark:border-slate-700" />
        <button className="h-9 rounded-md bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800">Filter</button>
      </form>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {(rows.results || []).length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">Belum ada saran sesuai filter.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {(rows.results || []).map((item: any) => {
              const kelasLabel = item.tingkat ? `${item.tingkat}-${item.nomor_kelas}${item.kelompok ? ` ${item.kelompok}` : ''}` : '-'
              const sender = Number(item.is_anonymous) === 1 ? 'Anonim' : `${item.siswa_nama || '-'} (${item.nisn || '-'})`
              return (
                <article key={item.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_220px]">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{item.category}</span>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusClass[item.status] || statusClass.baru}`}>{statusLabels[item.status] || item.status}</span>
                      <span className="text-[11px] text-slate-400">{formatDate(item.created_at)}</span>
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.title}</h2>
                      <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-600 dark:text-slate-300">{item.message}</p>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                      <span>Pengirim: <b className="font-semibold text-slate-700 dark:text-slate-300">{sender}</b></span>
                      <span>Kelas: <b className="font-semibold text-slate-700 dark:text-slate-300">{kelasLabel}</b></span>
                      {item.handled_by_name && <span>Ditangani: <b className="font-semibold text-slate-700 dark:text-slate-300">{item.handled_by_name}</b></span>}
                    </div>
                  </div>
                  <form action={updateParentSuggestionStatus} className="flex items-end gap-2 lg:flex-col lg:items-stretch lg:justify-center">
                    <input type="hidden" name="id" value={item.id} />
                    <select name="status" defaultValue={item.status} className="h-9 min-w-0 flex-1 rounded-md border border-slate-200 bg-transparent px-3 text-xs outline-none dark:border-slate-700">
                      {PARENT_SUGGESTION_STATUSES.map((nextStatus) => <option key={nextStatus} value={nextStatus}>{statusLabels[nextStatus]}</option>)}
                    </select>
                    <button className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">Update</button>
                  </form>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
