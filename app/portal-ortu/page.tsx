import { redirect } from 'next/navigation'
import { getAppSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { SummonResponseForm } from './components/summon-response-form'

export const dynamic = 'force-dynamic'

function rupiah(v: number) {
  return new Intl.NumberFormat('id-ID').format(v || 0)
}

type SlotJam = { id: number; mulai: string; selesai: string }
type PolaJam = { hari: number[]; slots: SlotJam[] }

const DAY_LABEL: Record<number, string> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
}

async function ensureParentCommunicationTables(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS parent_notifications (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      siswa_id TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      source_ref TEXT,
      level TEXT NOT NULL DEFAULT 'info',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(siswa_id, type, source_ref)
    )
  `).run()

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS parent_summons (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      siswa_id TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
      source_ref TEXT,
      reason TEXT NOT NULL,
      event_date TEXT,
      event_time TEXT,
      location TEXT,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'terkirim',
      parent_response TEXT,
      parent_response_note TEXT,
      parent_responded_at TEXT,
      created_by TEXT REFERENCES "user"(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(siswa_id, source_ref)
    )
  `).run()

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS parent_thread_notes (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      siswa_id TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
      actor_type TEXT NOT NULL,
      actor_id TEXT,
      note_type TEXT NOT NULL DEFAULT 'tindak_lanjut',
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run()
}

async function seedParentCommunication(db: D1Database, siswaId: string) {
  const [disiplin, sanksiRows, bkRows] = await Promise.all([
    db.prepare(`
      SELECT COALESCE(SUM(mp.poin), 0) AS total_poin
      FROM siswa_pelanggaran sp
      JOIN master_pelanggaran mp ON mp.id = sp.master_pelanggaran_id
      WHERE sp.siswa_id = ?
    `).bind(siswaId).first<{ total_poin: number }>(),
    db.prepare(`SELECT nama, deskripsi, poin_minimal FROM sanksi_config ORDER BY poin_minimal DESC`).all<any>(),
    db.prepare(`
      SELECT r.id, r.tindak_lanjut, r.catatan_tindak_lanjut, r.updated_at, u.nama_lengkap as guru_bk_nama
      FROM bk_rekaman r
      LEFT JOIN "user" u ON u.id = r.guru_bk_id
      WHERE r.siswa_id = ?
      ORDER BY r.updated_at DESC
      LIMIT 50
    `).bind(siswaId).all<any>(),
  ])

  const totalPoin = Number(disiplin?.total_poin || 0)
  const sanksi = (sanksiRows.results || []).find((s: any) => totalPoin >= Number(s.poin_minimal || 0))

  if (sanksi) {
    await db.prepare(`
      INSERT OR IGNORE INTO parent_notifications (siswa_id, type, title, message, source_ref, level)
      VALUES (?, 'sanksi', ?, ?, ?, 'warning')
    `).bind(
      siswaId,
      `Anak mencapai level ${sanksi.nama}`,
      `Akumulasi poin saat ini ${totalPoin}. Mohon koordinasi dengan wali kelas untuk tindak lanjut.`,
      `sanksi:${sanksi.nama}`,
    ).run()
  }

  for (const row of (bkRows.results || [])) {
    const tindak = String(row.tindak_lanjut || '').toLowerCase()
    const isSummon = tindak.includes('pemanggilan orang tua')
    const isCollab = tindak.includes('kolaborasi dengan orang tua')
    if (!isSummon && !isCollab) continue

    const type = isSummon ? 'pemanggilan' : 'kolaborasi'
    const title = isSummon ? 'Pemanggilan orang tua' : 'Kolaborasi dengan orang tua'
    const message = row.catatan_tindak_lanjut
      ? String(row.catatan_tindak_lanjut)
      : `Tindak lanjut BK: ${row.tindak_lanjut}`

    await db.prepare(`
      INSERT OR IGNORE INTO parent_notifications (siswa_id, type, title, message, source_ref, level)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      siswaId,
      type,
      title,
      message,
      `bk:${row.id}`,
      isSummon ? 'critical' : 'info',
    ).run()

    if (isSummon) {
      await db.prepare(`
        INSERT OR IGNORE INTO parent_summons
        (siswa_id, source_ref, reason, note, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, NULL, datetime('now'), datetime('now'))
      `).bind(
        siswaId,
        `bk:${row.id}`,
        'Pemanggilan orang tua oleh BK/wali kelas',
        message,
      ).run()
    }
  }
}

function parseJamPelajaran(raw: string | null | undefined): Map<number, Map<number, SlotJam>> {
  const byDay = new Map<number, Map<number, SlotJam>>()
  if (!raw) return byDay
  try {
    const patterns = JSON.parse(raw) as PolaJam[]
    for (const p of patterns || []) {
      for (const d of p.hari || []) {
        if (!byDay.has(d)) byDay.set(d, new Map<number, SlotJam>())
        const dayMap = byDay.get(d)!
        for (const s of p.slots || []) dayMap.set(Number(s.id), s)
      }
    }
  } catch {}
  return byDay
}

export default async function PortalOrtuPage() {
  const session = await getAppSession()
  if (!session) redirect('/portal-ortu/login')
  if (session.kind === 'staff') redirect('/dashboard')

  const siswaId = session.user.siswa_id
  const db = await getDB()
  await ensureParentCommunicationTables(db)
  await seedParentCommunication(db, siswaId)

  const [
    profil,
    absensiRekap,
    absensiTerbaru,
    nilaiRekap,
    disiplinRekap,
    disiplinRiwayat,
    dspt,
    sppSaldoAwal,
    sppSummary,
    transaksiTerbaru,
    waliKelasRow,
    notifications,
    summons,
    notes,
    taAktif,
  ] = await Promise.all([
    db.prepare(`
      SELECT s.id, s.nisn, s.nama_lengkap, s.status, s.kelas_id, k.tingkat, k.nomor_kelas, k.kelompok, k.wali_kelas_id
      FROM siswa s
      LEFT JOIN kelas k ON k.id = s.kelas_id
      WHERE s.id = ?
    `).bind(siswaId).first<any>(),
    db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'HADIR' THEN 1 ELSE 0 END) AS hadir,
        SUM(CASE WHEN status = 'SAKIT' THEN 1 ELSE 0 END) AS sakit,
        SUM(CASE WHEN status = 'IZIN' THEN 1 ELSE 0 END) AS izin,
        SUM(CASE WHEN status = 'ALFA' THEN 1 ELSE 0 END) AS alfa
      FROM absensi_siswa
      WHERE siswa_id = ?
    `).bind(siswaId).first<any>(),
    db.prepare(`
      SELECT tanggal, status, catatan
      FROM absensi_siswa
      WHERE siswa_id = ?
      ORDER BY tanggal DESC
      LIMIT 10
    `).bind(siswaId).all<any>(),
    db.prepare(`
      SELECT nilai_smt1, nilai_smt2, nilai_smt3, nilai_smt4, nilai_smt5, nilai_smt6
      FROM rekap_nilai_akademik
      WHERE siswa_id = ?
      LIMIT 1
    `).bind(siswaId).first<any>(),
    db.prepare(`
      SELECT COUNT(sp.id) AS total_kasus, COALESCE(SUM(mp.poin), 0) AS total_poin
      FROM siswa_pelanggaran sp
      JOIN master_pelanggaran mp ON mp.id = sp.master_pelanggaran_id
      WHERE sp.siswa_id = ?
    `).bind(siswaId).first<any>(),
    db.prepare(`
      SELECT sp.tanggal, mp.nama_pelanggaran, mp.kategori, mp.poin, sp.keterangan
      FROM siswa_pelanggaran sp
      JOIN master_pelanggaran mp ON mp.id = sp.master_pelanggaran_id
      WHERE sp.siswa_id = ?
      ORDER BY sp.tanggal DESC
      LIMIT 8
    `).bind(siswaId).all<any>(),
    db.prepare(`
      SELECT nominal_target, total_dibayar, total_diskon, status
      FROM fin_dspt
      WHERE siswa_id = ?
      LIMIT 1
    `).bind(siswaId).first<any>(),
    db.prepare(`
      SELECT jumlah, total_dibayar, status
      FROM fin_spp_saldo_awal
      WHERE siswa_id = ?
      LIMIT 1
    `).bind(siswaId).first<any>(),
    db.prepare(`
      SELECT
        COALESCE(SUM(nominal), 0) AS total_nominal,
        COALESCE(SUM(total_dibayar), 0) AS total_dibayar
      FROM fin_spp_tagihan
      WHERE siswa_id = ?
    `).bind(siswaId).first<any>(),
    db.prepare(`
      SELECT nomor_kuitansi, kategori, metode_bayar, jumlah_total, created_at
      FROM fin_transaksi
      WHERE siswa_id = ? AND is_void = 0
      ORDER BY created_at DESC
      LIMIT 6
    `).bind(siswaId).all<any>(),
    db.prepare(`
      SELECT u.id, u.nama_lengkap,
             COALESCE(u.nomor_whatsapp, s.no_hp_wali, s.nomor_whatsapp) AS nomor_kontak
      FROM siswa s
      LEFT JOIN kelas k ON k.id = s.kelas_id
      LEFT JOIN "user" u ON u.id = k.wali_kelas_id
      WHERE s.id = ?
      LIMIT 1
    `).bind(siswaId).first<any>().catch(async () => {
      return db.prepare(`
        SELECT u.id, u.nama_lengkap, NULL AS nomor_kontak
        FROM siswa s
        LEFT JOIN kelas k ON k.id = s.kelas_id
        LEFT JOIN "user" u ON u.id = k.wali_kelas_id
        WHERE s.id = ?
        LIMIT 1
      `).bind(siswaId).first<any>()
    }),
    db.prepare(`
      SELECT id, type, title, message, level, is_read, created_at
      FROM parent_notifications
      WHERE siswa_id = ?
      ORDER BY created_at DESC
      LIMIT 12
    `).bind(siswaId).all<any>(),
    db.prepare(`
      SELECT id, reason, event_date, event_time, location, note, status, parent_response, parent_response_note, parent_responded_at, created_at
      FROM parent_summons
      WHERE siswa_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).bind(siswaId).all<any>(),
    db.prepare(`
      SELECT actor_type, note_type, content, created_at
      FROM parent_thread_notes
      WHERE siswa_id = ?
      ORDER BY created_at DESC
      LIMIT 12
    `).bind(siswaId).all<any>(),
    db.prepare('SELECT id, jam_pelajaran FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<any>(),
  ])

  if (!profil) redirect('/portal-ortu/login')

  const kelasLabel = profil.tingkat ? `${profil.tingkat}-${profil.nomor_kelas}${profil.kelompok ? ` ${profil.kelompok}` : ''}` : '-'
  const dsptTarget = Number(dspt?.nominal_target || 0)
  const dsptBayar = Number(dspt?.total_dibayar || 0)
  const dsptDiskon = Number(dspt?.total_diskon || 0)
  const dsptSisa = Math.max(0, dsptTarget - dsptBayar - dsptDiskon)
  const sppNominal = Number(sppSummary?.total_nominal || 0) + Number(sppSaldoAwal?.jumlah || 0)
  const sppBayar = Number(sppSummary?.total_dibayar || 0) + Number(sppSaldoAwal?.total_dibayar || 0)
  const sppSisa = Math.max(0, sppNominal - sppBayar)

  const avgSemester = (raw: string | null | undefined) => {
    if (!raw) return null
    try {
      const obj = JSON.parse(raw)
      const nums = Object.values(obj || {}).map((x: any) => Number(x)).filter((x: number) => !Number.isNaN(x))
      if (!nums.length) return null
      return (nums.reduce((a: number, b: number) => a + b, 0) / nums.length).toFixed(2)
    } catch {
      return null
    }
  }

  const semesters = [
    { label: 'Semester 1', value: avgSemester(nilaiRekap?.nilai_smt1) },
    { label: 'Semester 2', value: avgSemester(nilaiRekap?.nilai_smt2) },
    { label: 'Semester 3', value: avgSemester(nilaiRekap?.nilai_smt3) },
    { label: 'Semester 4', value: avgSemester(nilaiRekap?.nilai_smt4) },
    { label: 'Semester 5', value: avgSemester(nilaiRekap?.nilai_smt5) },
    { label: 'Semester 6', value: avgSemester(nilaiRekap?.nilai_smt6) },
  ]

  const jamMap = parseJamPelajaran(taAktif?.jam_pelajaran)
  const jadwalRows = profil.kelas_id
    ? await db.prepare(`
      SELECT jm.hari, jm.jam_ke, mp.nama_mapel, u.nama_lengkap AS guru_nama
      FROM jadwal_mengajar jm
      JOIN penugasan_mengajar pm ON pm.id = jm.penugasan_id
      JOIN mata_pelajaran mp ON mp.id = pm.mapel_id
      LEFT JOIN "user" u ON u.id = pm.guru_id
      WHERE pm.kelas_id = ? AND pm.tahun_ajaran_id = ?
      ORDER BY jm.hari ASC, jm.jam_ke ASC
    `).bind(profil.kelas_id, taAktif?.id || '').all<any>()
    : { results: [] as any[] }

  const jadwalByDay = new Map<number, any[]>()
  for (const row of (jadwalRows.results || [])) {
    const hari = Number(row.hari)
    if (!jadwalByDay.has(hari)) jadwalByDay.set(hari, [])
    const slot = jamMap.get(hari)?.get(Number(row.jam_ke))
    jadwalByDay.get(hari)!.push({
      jam_ke: row.jam_ke,
      waktu: slot ? `${slot.mulai} - ${slot.selesai}` : '-',
      mapel: row.nama_mapel,
      guru: row.guru_nama || '-',
    })
  }

  const waliPhone = String(waliKelasRow?.nomor_kontak || '').replace(/\D/g, '')
  const waUrl = waliPhone ? `https://wa.me/${waliPhone}` : null

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8 space-y-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-emerald-700">Portal Orang Tua</p>
            <h1 className="text-lg font-bold text-slate-900">{profil.nama_lengkap}</h1>
            <p className="text-sm text-slate-600">NISN {profil.nisn} · Kelas {kelasLabel} · Status {profil.status}</p>
          </div>
          <form action="/api/auth/sign-out" method="post">
            <button className="h-9 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100">Keluar</button>
          </form>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <h2 className="text-sm font-bold text-emerald-800">Kontak Wali Kelas</h2>
          <p className="text-xs text-emerald-700 mt-1">PIC utama komunikasi akademik dan kedisiplinan anak adalah wali kelas.</p>
          <p className="text-sm font-semibold text-emerald-900 mt-2">{waliKelasRow?.nama_lengkap || 'Belum ditetapkan'}</p>
          <div className="mt-2">
            {waUrl ? (
              <a href={waUrl} target="_blank" className="inline-flex h-8 items-center rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white">
                Hubungi via WhatsApp
              </a>
            ) : (
              <p className="text-xs text-emerald-700">Nomor kontak wali kelas belum tersedia.</p>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Hadir</p>
            <p className="text-xl font-bold text-slate-900">{absensiRekap?.hadir || 0}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Sakit / Izin</p>
            <p className="text-xl font-bold text-slate-900">{(absensiRekap?.sakit || 0) + (absensiRekap?.izin || 0)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Alfa</p>
            <p className="text-xl font-bold text-rose-700">{absensiRekap?.alfa || 0}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Poin Kedisiplinan</p>
            <p className="text-xl font-bold text-slate-900">{disiplinRekap?.total_poin || 0}</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">Notifikasi Orang Tua</h2>
            <div className="mt-3 space-y-2">
              {(notifications.results || []).length === 0 ? (
                <p className="text-xs text-slate-500">Belum ada notifikasi.</p>
              ) : (notifications.results || []).map((n: any) => (
                <div key={n.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="text-xs font-semibold text-slate-700">{n.title}</p>
                  <p className="text-xs text-slate-500">{n.message}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{n.created_at}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">Pemanggilan Orang Tua</h2>
            <div className="mt-3 space-y-2">
              {(summons.results || []).length === 0 ? (
                <p className="text-xs text-slate-500">Belum ada data pemanggilan.</p>
              ) : (summons.results || []).map((s: any) => (
                <div key={s.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="text-xs font-semibold text-slate-700">{s.reason}</p>
                  <p className="text-xs text-slate-500">
                    {s.event_date || '-'} {s.event_time || ''} {s.location ? `· ${s.location}` : ''} · Status: {s.status}
                  </p>
                  {s.note ? <p className="text-xs text-slate-600 mt-1">{s.note}</p> : null}
                  <SummonResponseForm summonId={s.id} status={s.status} />
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-bold text-slate-900">Jadwal Pelajaran Mingguan</h2>
          <p className="text-xs text-slate-500 mt-1">Berikut jadwal harian anak beserta guru pengampu.</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((d) => (
              <div key={d} className="rounded-md border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-700">{DAY_LABEL[d]}</p>
                <div className="mt-2 space-y-1.5">
                  {(jadwalByDay.get(d) || []).length === 0 ? (
                    <p className="text-xs text-slate-400">Tidak ada jadwal.</p>
                  ) : (jadwalByDay.get(d) || []).map((j: any, idx: number) => (
                    <div key={`${d}-${idx}`} className="rounded border border-slate-100 bg-white px-2 py-1.5">
                      <p className="text-[11px] font-semibold text-slate-700">Jam {j.jam_ke} · {j.waktu}</p>
                      <p className="text-[11px] text-slate-600">{j.mapel}</p>
                      <p className="text-[10px] text-slate-500">{j.guru}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">Riwayat Absensi Terbaru</h2>
            <div className="mt-3 space-y-2">
              {(absensiTerbaru.results || []).length === 0 ? (
                <p className="text-xs text-slate-500">Belum ada data absensi.</p>
              ) : (absensiTerbaru.results || []).map((r: any, i: number) => (
                <div key={`${r.tanggal}-${i}`} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="text-xs font-semibold text-slate-700">{r.tanggal} · {r.status}</p>
                  {r.catatan ? <p className="text-xs text-slate-500">{r.catatan}</p> : null}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">Ringkasan Nilai</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {semesters.map((s) => (
                <div key={s.label} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">{s.label}</p>
                  <p className="text-sm font-semibold text-slate-900">{s.value ?? '-'}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">Riwayat Kedisiplinan</h2>
            <p className="text-xs text-slate-500 mt-1">Total kasus: {disiplinRekap?.total_kasus || 0}</p>
            <div className="mt-3 space-y-2">
              {(disiplinRiwayat.results || []).length === 0 ? (
                <p className="text-xs text-slate-500">Belum ada catatan pelanggaran.</p>
              ) : (disiplinRiwayat.results || []).map((r: any, i: number) => (
                <div key={`${r.tanggal}-${i}`} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="text-xs font-semibold text-slate-700">{r.tanggal} · {r.nama_pelanggaran} ({r.poin} poin)</p>
                  <p className="text-xs text-slate-500">{r.kategori}{r.keterangan ? ` · ${r.keterangan}` : ''}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">Ringkasan Keuangan</h2>
            <div className="mt-3 grid gap-2">
              <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">DSPT</p>
                <p className="text-xs text-slate-700">Target Rp {rupiah(dsptTarget)} · Terbayar Rp {rupiah(dsptBayar + dsptDiskon)} · Sisa Rp {rupiah(dsptSisa)}</p>
              </div>
              <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">SPP</p>
                <p className="text-xs text-slate-700">Tagihan Rp {rupiah(sppNominal)} · Terbayar Rp {rupiah(sppBayar)} · Sisa Rp {rupiah(sppSisa)}</p>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {(transaksiTerbaru.results || []).length === 0 ? (
                <p className="text-xs text-slate-500">Belum ada transaksi.</p>
              ) : (transaksiTerbaru.results || []).map((t: any, i: number) => (
                <div key={`${t.nomor_kuitansi}-${i}`} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="text-xs font-semibold text-slate-700">{t.nomor_kuitansi || '-'} · Rp {rupiah(Number(t.jumlah_total || 0))}</p>
                  <p className="text-xs text-slate-500">{t.kategori} · {t.metode_bayar} · {t.created_at}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-bold text-slate-900">Catatan Tindak Lanjut</h2>
          <div className="mt-3 space-y-2">
            {(notes.results || []).length === 0 ? (
              <p className="text-xs text-slate-500">Belum ada catatan.</p>
            ) : (notes.results || []).map((n: any, i: number) => (
              <div key={`${n.created_at}-${i}`} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold text-slate-700">{n.actor_type} · {n.note_type}</p>
                <p className="text-xs text-slate-600">{n.content}</p>
                <p className="text-[10px] text-slate-400 mt-1">{n.created_at}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

