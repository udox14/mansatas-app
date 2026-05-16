import { redirect } from 'next/navigation'
import { getAppSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { PortalOrtuClient } from './components/portal-ortu-client'
import { findSlotException, getKbmExceptionsForDate } from '@/lib/kalender-pendidikan'

export const dynamic = 'force-dynamic'

function rupiah(v: number) {
  return new Intl.NumberFormat('id-ID').format(v || 0)
}

type SlotJam = { id: number; mulai: string; selesai: string }
type PolaJam = { hari: number[]; slots: SlotJam[] }
type TodayAbsensiRow = {
  penugasan_id: string
  status: string
  catatan: string | null
}
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

  const profil = await db.prepare(`
    SELECT s.id, s.nisn, s.nama_lengkap, s.status, s.foto_url, s.kelas_id, k.tingkat, k.nomor_kelas, k.kelompok, k.wali_kelas_id
    FROM siswa s
    LEFT JOIN kelas k ON k.id = s.kelas_id
    WHERE s.id = ?
  `).bind(siswaId).first<any>()
  if (!profil) redirect('/portal-ortu/login')

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

  const [
    pengumumanRows,
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
      SELECT pa.id, pa.title, pa.body, pa.publish_at, u.nama_lengkap AS pengirim
      FROM parent_announcements pa
      LEFT JOIN "user" u ON u.id = pa.created_by
      WHERE pa.is_active = 1
        AND datetime(pa.publish_at) <= datetime('now')
        AND (pa.expires_at IS NULL OR datetime(pa.expires_at) >= datetime('now'))
        AND (
          pa.target_scope = 'all'
          OR (pa.target_scope = 'kelas' AND pa.kelas_id = ?)
          OR EXISTS (
            SELECT 1
            FROM parent_announcement_targets pat
            WHERE pat.announcement_id = pa.id
              AND (
                (pat.target_type = 'kelas' AND pat.kelas_id = ?)
                OR (pat.target_type = 'angkatan' AND pat.tingkat = ?)
              )
          )
        )
      ORDER BY publish_at DESC
      LIMIT 5
    `).bind(profil.kelas_id || null, profil.kelas_id || null, Number(profil.tingkat || 0)).all<any>(),
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
             COALESCE(u.nomor_whatsapp, s.nomor_whatsapp) AS nomor_kontak
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
  const semesterNumeric = semesters.map(s => s.value).filter(v => v !== null && v !== undefined && v !== '').map(Number).filter(v => !Number.isNaN(v))
  const semesterAvg = semesterNumeric.length ? Number((semesterNumeric.reduce((a, b) => a + b, 0) / semesterNumeric.length).toFixed(1)) : null

  const todayRaw = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
  const todayDayMap = new Date(todayRaw).getDay()
  const todayDay = todayDayMap === 0 ? 7 : todayDayMap

  const todayAbsensiRows = await db.prepare(`
    SELECT penugasan_id, status, catatan
    FROM absensi_siswa
    WHERE siswa_id = ? AND tanggal = ?
  `).bind(siswaId, todayRaw).all<TodayAbsensiRow>()
  
  const todayAbsensiMap = new Map<string, { status: string; catatan: string | null }>()
  for (const row of todayAbsensiRows.results || []) {
    todayAbsensiMap.set(row.penugasan_id, { status: row.status, catatan: row.catatan })
  }

  const jamMap = parseJamPelajaran(taAktif?.jam_pelajaran)
  const kbmExceptions = profil.kelas_id ? await getKbmExceptionsForDate(db, todayRaw) : []
  const jadwalRows = profil.kelas_id
    ? await db.prepare(`
      SELECT jm.hari, jm.jam_ke, mp.nama_mapel, u.nama_lengkap AS guru_nama, pm.id AS penugasan_id
      FROM jadwal_mengajar jm
      JOIN penugasan_mengajar pm ON pm.id = jm.penugasan_id
      JOIN kelas k ON pm.kelas_id = k.id
      JOIN mata_pelajaran mp ON mp.id = pm.mapel_id
      LEFT JOIN "user" u ON u.id = pm.guru_id
      WHERE pm.kelas_id = ? AND pm.tahun_ajaran_id = ?
        AND (k.kbm_nonaktif_mulai IS NULL OR k.kbm_nonaktif_mulai > ?)
      ORDER BY jm.hari ASC, jm.jam_ke ASC
    `).bind(profil.kelas_id, taAktif?.id || '', todayRaw).all<any>()
    : { results: [] as any[] }

  const jadwalByDay = new Map<number, any[]>()
  for (const row of (jadwalRows.results || [])) {
    const hari = Number(row.hari)
    if (!jadwalByDay.has(hari)) jadwalByDay.set(hari, [])
    const slot = jamMap.get(hari)?.get(Number(row.jam_ke))
    let absensi = null
    if (hari === todayDay) {
      const exception = findSlotException(
        kbmExceptions,
        { id: profil.kelas_id, tingkat: Number(profil.tingkat) },
        Number(row.jam_ke)
      )
      const absRecord = todayAbsensiMap.get(row.penugasan_id)
      if (exception) {
        absensi = { status: 'KBM_EXCEPTION', catatan: exception.description || exception.judul }
      } else if (absRecord) {
        absensi = absRecord
      } else {
        absensi = { status: 'HADIR', catatan: null }
      }
    }

    jadwalByDay.get(hari)!.push({
      jam_ke: row.jam_ke,
      waktu: slot ? `${slot.mulai} - ${slot.selesai}` : '-',
      mapel: row.nama_mapel,
      guru: row.guru_nama || '-',
      absensi,
      isToday: hari === todayDay
    })
  }

  const waliPhone = String(waliKelasRow?.nomor_kontak || '').replace(/\D/g, '')
  const waUrl = waliPhone ? `https://wa.me/${waliPhone}` : null
  const jadwalObject = Object.fromEntries(Array.from(jadwalByDay.entries()))

  const data = {
    profil,
    kelasLabel,
    waliKelasRow,
    waUrl,
    pengumumanRows,
    absensiRekap,
    absensiTerbaru,
    disiplinRekap,
    disiplinRiwayat,
    semesters,
    semesterAvg,
    dsptTarget,
    dsptBayar,
    dsptDiskon,
    dsptSisa,
    sppNominal,
    sppBayar,
    sppSisa,
    transaksiTerbaru,
    notifications,
    summons,
    notes,
    jadwalObject,
  }

  return <PortalOrtuClient data={data} />
}
