import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { createParentAnnouncement, deleteParentAnnouncement, toggleParentAnnouncement } from './actions'

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
}

export default async function PengumumanOrtuPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'pengumuman-ortu')
  if (!allowed) redirect('/dashboard')

  await ensureTable(db)

  const [rows, kelasRows] = await Promise.all([
    db.prepare(`
      SELECT pa.id, pa.title, pa.body, pa.target_scope, pa.kelas_id, pa.is_active, pa.publish_at, pa.expires_at, pa.created_at,
             k.tingkat, k.nomor_kelas, k.kelompok
      FROM parent_announcements pa
      LEFT JOIN kelas k ON k.id = pa.kelas_id
      ORDER BY pa.created_at DESC
      LIMIT 100
    `).all<any>(),
    db.prepare(`
      SELECT id, tingkat, nomor_kelas, kelompok
      FROM kelas
      ORDER BY tingkat, kelompok, CAST(nomor_kelas AS INTEGER)
    `).all<any>(),
  ])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Pengumuman Portal Ortu</h1>
        <p className="text-xs text-slate-500">Kelola pengumuman yang tampil di beranda portal orang tua.</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800">Buat Pengumuman</h2>
        <form action={createParentAnnouncement} className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-xs text-slate-600">Judul</label>
            <input name="title" required className="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-sm" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-slate-600">Isi</label>
            <textarea name="body" required rows={4} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-600">Target</label>
            <select name="target_scope" defaultValue="all" className="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-sm">
              <option value="all">Semua Orang Tua</option>
              <option value="kelas">Kelas Tertentu</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-600">Kelas (jika target kelas)</label>
            <select name="kelas_id" className="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-sm">
              <option value="">Pilih kelas</option>
              {(kelasRows.results || []).map((k: any) => (
                <option key={k.id} value={k.id}>{k.tingkat}-{k.nomor_kelas}{k.kelompok ? ` ${k.kelompok}` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-600">Publish At (opsional)</label>
            <input name="publish_at" placeholder="YYYY-MM-DD HH:MM:SS" className="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-600">Expire At (opsional)</label>
            <input name="expires_at" placeholder="YYYY-MM-DD HH:MM:SS" className="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-sm" />
          </div>
          <div className="md:col-span-2">
            <button className="h-9 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700">
              Simpan Pengumuman
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800">Daftar Pengumuman</h2>
        <div className="mt-3 space-y-2">
          {(rows.results || []).length === 0 ? (
            <p className="text-xs text-slate-500">Belum ada pengumuman.</p>
          ) : (rows.results || []).map((r: any) => (
            <div key={r.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">{r.title}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${Number(r.is_active) === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                  {Number(r.is_active) === 1 ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600 whitespace-pre-line">{r.body}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                Target: {r.target_scope === 'kelas' ? `Kelas ${r.tingkat}-${r.nomor_kelas}${r.kelompok ? ` ${r.kelompok}` : ''}` : 'Semua orang tua'} · Publish: {r.publish_at}{r.expires_at ? ` · Expire: ${r.expires_at}` : ''}
              </p>
              <div className="mt-2 flex gap-2">
                <form action={toggleParentAnnouncement}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700">
                    {Number(r.is_active) === 1 ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </form>
                <form action={deleteParentAnnouncement}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="h-8 rounded-md border border-rose-300 bg-rose-50 px-3 text-xs font-semibold text-rose-700">
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
