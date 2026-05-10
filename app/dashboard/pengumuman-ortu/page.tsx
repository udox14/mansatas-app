import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess, getUserRoles } from '@/lib/features'
import { createParentAnnouncement, deleteParentAnnouncement, toggleParentAnnouncement } from './actions'
import { CreatePengumumanModal } from './create-modal'

export const dynamic = 'force-dynamic'

async function ensureTable(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS parent_announcements (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      target_scope TEXT NOT NULL DEFAULT 'all',
      kelas_id TEXT REFERENCES kelas(id) ON DELETE SET NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      publish_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT,
      created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run()

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS parent_announcement_targets (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      announcement_id TEXT NOT NULL REFERENCES parent_announcements(id) ON DELETE CASCADE,
      target_type TEXT NOT NULL,
      kelas_id TEXT REFERENCES kelas(id) ON DELETE CASCADE,
      tingkat INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run()
}

export default async function PengumumanOrtuPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'pengumuman-ortu')
  if (!allowed) redirect('/dashboard')

  const roles = await getUserRoles(db, user.id)
  const isWaliOnly = roles.includes('wali_kelas') && !roles.some(r => ['super_admin', 'admin_tu', 'kepsek', 'wakamad'].includes(r))

  await ensureTable(db)

  const [rows, kelasRows, angkatanRows] = await Promise.all([
    db.prepare(`
      SELECT pa.id, pa.title, pa.body, pa.target_scope, pa.kelas_id, pa.is_active, pa.publish_at, pa.expires_at, pa.created_at,
             k.tingkat, k.nomor_kelas, k.kelompok, u.nama_lengkap AS pengirim,
             (
               SELECT GROUP_CONCAT(k2.tingkat || '-' || k2.nomor_kelas || CASE WHEN k2.kelompok IS NOT NULL AND k2.kelompok <> '' THEN ' ' || k2.kelompok ELSE '' END, ', ')
               FROM parent_announcement_targets pat2
               JOIN kelas k2 ON k2.id = pat2.kelas_id
               WHERE pat2.announcement_id = pa.id AND pat2.target_type = 'kelas'
             ) AS target_kelas_labels,
             (
               SELECT GROUP_CONCAT(DISTINCT pat3.tingkat)
               FROM parent_announcement_targets pat3
               WHERE pat3.announcement_id = pa.id AND pat3.target_type = 'angkatan'
             ) AS target_angkatan_labels
      FROM parent_announcements pa
      LEFT JOIN kelas k ON k.id = pa.kelas_id
      LEFT JOIN "user" u ON u.id = pa.created_by
      ORDER BY pa.created_at DESC
      LIMIT 100
    `).all<any>(),
    db.prepare(`
      SELECT id, tingkat, nomor_kelas, kelompok
      FROM kelas
      ${isWaliOnly ? 'WHERE wali_kelas_id = ?' : ''}
      ORDER BY tingkat, kelompok, CAST(nomor_kelas AS INTEGER)
    `).bind(...(isWaliOnly ? [user.id] : [])).all<any>(),
    db.prepare(`
      SELECT DISTINCT tingkat
      FROM kelas
      ORDER BY tingkat ASC
    `).all<any>(),
  ])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Pengumuman Portal Ortu</h1>
          <p className="text-xs text-slate-500">Kelola pengumuman yang tampil di beranda portal orang tua.</p>
        </div>
        <CreatePengumumanModal 
          isWaliOnly={isWaliOnly} 
          kelasRows={kelasRows.results || []} 
          angkatanRows={angkatanRows.results || []} 
        />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Daftar Pengumuman</h2>
        <div className="mt-4 space-y-3">
          {(rows.results || []).length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Belum ada pengumuman.</p>
          ) : (rows.results || []).map((r: any) => (
            <div key={r.id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:bg-slate-800/50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{r.title}</p>
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${Number(r.is_active) === 1 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                  {Number(r.is_active) === 1 ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600 whitespace-pre-line dark:text-slate-300">{r.body}</p>
              
              <div className="mt-3 flex flex-col gap-1.5 rounded-md bg-slate-100/50 p-2.5 dark:bg-slate-800/30">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Target:</span> {
                    r.target_scope === 'kelas'
                      ? (r.target_kelas_labels || (r.tingkat ? `Kelas ${r.tingkat}-${r.nomor_kelas}${r.kelompok ? ` ${r.kelompok}` : ''}` : '-'))
                      : r.target_scope === 'angkatan'
                        ? `Angkatan Kelas ${r.target_angkatan_labels || '-'}`
                        : 'Semua orang tua'
                  }
                </p>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                  <p><span className="font-medium text-slate-700 dark:text-slate-300">Publish:</span> {r.publish_at}</p>
                  {r.expires_at && <p><span className="font-medium text-slate-700 dark:text-slate-300">Expire:</span> {r.expires_at}</p>}
                  <p><span className="font-medium text-slate-700 dark:text-slate-300">Pengirim:</span> {r.pengirim || '-'}</p>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <form action={toggleParentAnnouncement}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors">
                    {Number(r.is_active) === 1 ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </form>
                <form action={deleteParentAnnouncement}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="h-8 rounded-md border border-rose-200 bg-rose-50 px-3 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400 dark:hover:bg-rose-900/50 transition-colors">
                    Hapus
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
