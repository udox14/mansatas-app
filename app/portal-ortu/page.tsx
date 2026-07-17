import { redirect } from 'next/navigation'
import { getAppSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { PortalOrtuClient } from './components/portal-ortu-client'
import { findSlotException, getKalenderDateStatus, getKbmExceptionsForDate } from '@/lib/kalender-pendidikan'
import { ensureParentSuggestionTable } from '@/lib/parent-suggestions'
import { getKomitePaymentSettings } from '@/lib/komite-payment-settings'
import { getDocumentationArticles } from '@/lib/documentation'
import { getFinalAttendanceForStudent } from '@/lib/wali-kelas-attendance'
import { getParentAttendanceByAcademicYear } from './actions'

export const dynamic = 'force-dynamic'

function rupiah(v: number) {
  return new Intl.NumberFormat('id-ID').format(v || 0)
}

function isDsptZeroUninput(
  tahunMasuk: number | string | null | undefined,
  nominal: number | null | undefined,
  totalDibayar: number | null | undefined,
  totalDiskon: number | null | undefined,
) {
  return Number(tahunMasuk || 0) >= 2026
    && Number(nominal || 0) === 0
    && Number(totalDibayar || 0) === 0
    && Number(totalDiskon || 0) === 0
}

function getDsptStatus(
  tahunMasuk: number | string | null | undefined,
  dspt: any,
): 'belum_bayar' | 'nyicil' | 'lunas' | 'tidak_ada' {
  if (!dspt) return 'tidak_ada'
  const target = Number(dspt.nominal_target || 0)
  const bayar = Number(dspt.total_dibayar || 0)
  const diskon = Number(dspt.total_diskon || 0)
  if (isDsptZeroUninput(tahunMasuk, target, bayar, diskon)) return 'tidak_ada'
  if (target - bayar - diskon <= 0) return 'lunas'
  if (bayar > 0) return 'nyicil'
  return 'belum_bayar'
}

type SlotJam = { id: number; mulai: string; selesai: string }
type PolaJam = { hari: number[]; slots: SlotJam[] }
type TodayAbsensiRow = {
  penugasan_id: string
  jam_ke_mulai: number | null
  jam_ke_selesai: number | null
  status: string
  catatan: string | null
}
type TodayIzinRow = {
  jam_pelajaran: string | number | null
  alasan: string
  keterangan: string | null
}
const DAY_LABEL: Record<number, string> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
}

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function parseIzinJam(raw: TodayIzinRow['jam_pelajaran']) {
  if (raw === null || raw === undefined || raw === '') return []
  try {
    const parsed = JSON.parse(String(raw))
    return (Array.isArray(parsed) ? parsed : [parsed])
      .map(Number)
      .filter(value => Number.isInteger(value) && value > 0)
  } catch {
    const value = Number(raw)
    return Number.isInteger(value) && value > 0 ? [value] : []
  }
}

function summarizeAttendanceRows(rows: any[]) {
  const summary = { hadir: 0, sakit: 0, izin: 0, alfa: 0, perluKonfirmasi: 0, belumLengkap: 0, totalHari: rows.length }
  for (const row of rows) {
    const status = String(row.status_akhir || '')
    if (status === 'HADIR') summary.hadir++
    else if (status === 'SAKIT') summary.sakit++
    else if (status === 'IZIN') summary.izin++
    else if (status === 'ALFA') summary.alfa++
    else if (status === 'PARSIAL' || status === 'PERLU_KONFIRMASI_WALI') summary.perluKonfirmasi++
    else summary.belumLengkap++
  }
  return summary
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

async function ensurePaymentSubmissionTable(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS fin_payment_submissions (
      id TEXT PRIMARY KEY,
      siswa_id TEXT NOT NULL REFERENCES siswa(id),
      dspt_id TEXT NOT NULL REFERENCES fin_dspt(id),
      kategori TEXT NOT NULL DEFAULT 'dspt' CHECK(kategori IN ('dspt')),
      metode_bayar TEXT NOT NULL DEFAULT 'transfer' CHECK(metode_bayar IN ('transfer', 'qris')),
      jumlah INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'belum_upload' CHECK(status IN ('belum_upload', 'menunggu_konfirmasi', 'terkonfirmasi', 'ditolak')),
      bukti_url TEXT,
      bukti_uploaded_at TEXT,
      confirmed_by TEXT REFERENCES "user"(id),
      confirmed_at TEXT,
      rejected_by TEXT REFERENCES "user"(id),
      rejected_at TEXT,
      reject_reason TEXT,
      transaksi_id TEXT REFERENCES fin_transaksi(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  await ensurePaymentSubmissionTable(db)
  await ensureParentSuggestionTable(db)
  await seedParentCommunication(db, siswaId)

  const profil = await db.prepare(`
    SELECT s.id, s.nisn, s.nama_lengkap, s.status, s.foto_url, s.kelas_id, s.tahun_masuk, s.nomor_whatsapp, k.tingkat, k.nomor_kelas, k.kelompok, k.wali_kelas_id
    FROM siswa s
    LEFT JOIN kelas k ON k.id = s.kelas_id
    WHERE s.id = ?
  `).bind(siswaId).first<any>()
  if (!profil) redirect('/portal-ortu/login')

  const todayRaw = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
  const todayDayMap = new Date(`${todayRaw}T00:00:00`).getDay()
  const todayDay = todayDayMap === 0 ? 7 : todayDayMap
  const weekStart = shiftDate(todayRaw, 1 - todayDay)
  const weekEnd = shiftDate(weekStart, 5)

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
    attendanceYears,
    nilaiRekap,
    disiplinRekap,
    disiplinTerakhir,
    sanksiConfig,
    dspt,
    sppSaldoAwal,
    sppSummary,
    transaksiTerbaru,
    paymentSubmissions,
    parentSuggestions,
    waliKelasRow,
    notifications,
    summons,
    notes,
    taAktif,
    komitePaymentSettings,
    documentationArticles,
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
      SELECT id, nama, semester, is_active
      FROM tahun_ajaran
      ORDER BY nama DESC, semester DESC
    `).all<any>(),
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
      SELECT MAX(sp.tanggal) AS tanggal_terakhir
      FROM siswa_pelanggaran sp
      WHERE sp.siswa_id = ?
    `).bind(siswaId).all<any>(),
    db.prepare(`SELECT nama, poin_minimal FROM sanksi_config ORDER BY poin_minimal DESC`).all<any>(),
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
      SELECT t.id, t.nomor_kuitansi, t.kategori, t.metode_bayar, t.jumlah_total, t.created_at,
             u.nama_lengkap AS nama_input
      FROM fin_transaksi t
      LEFT JOIN "user" u ON u.id = t.input_oleh
      WHERE t.siswa_id = ? AND t.is_void = 0
      ORDER BY t.created_at DESC
      LIMIT 6
    `).bind(siswaId).all<any>(),
    db.prepare(`
      SELECT id, siswa_id, dspt_id, kategori, metode_bayar, jumlah, status,
             bukti_url, bukti_uploaded_at, reject_reason, transaksi_id, created_at, updated_at
      FROM fin_payment_submissions
      WHERE siswa_id = ? AND kategori = 'dspt'
      ORDER BY datetime(created_at) DESC
      LIMIT 20
    `).bind(siswaId).all<any>(),
    db.prepare(`
      SELECT id, category, title, message, is_anonymous, status, read_at, handled_at, created_at, updated_at
      FROM parent_suggestions
      WHERE siswa_id = ?
      ORDER BY datetime(created_at) DESC
      LIMIT 20
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
      WHERE siswa_id = ? AND actor_type = 'orang_tua'
      ORDER BY created_at DESC
      LIMIT 12
    `).bind(siswaId).all<any>(),
    db.prepare('SELECT id, jam_pelajaran FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<any>(),
    getKomitePaymentSettings(),
    getDocumentationArticles(db, { audience: 'parent' }),
  ])

  const kelasLabel = profil.tingkat
    ? `${profil.tingkat}-${profil.nomor_kelas}${String(profil.tingkat) !== '10' && profil.kelompok ? ` ${profil.kelompok}` : ''}`
    : '-'
  const dsptTarget = Number(dspt?.nominal_target || 0)
  const dsptBayar = Number(dspt?.total_dibayar || 0)
  const dsptDiskon = Number(dspt?.total_diskon || 0)
  const dsptSisa = Math.max(0, dsptTarget - dsptBayar - dsptDiskon)
  const dsptStatus = getDsptStatus(profil.tahun_masuk, dspt)
  const dsptIsInput = dsptStatus !== 'tidak_ada'
  const dsptIsLunas = dsptStatus === 'lunas'
  const dsptNeedsInput = dsptStatus === 'tidak_ada'
  const sppNominal = Number(sppSummary?.total_nominal || 0) + Number(sppSaldoAwal?.jumlah || 0)
  const sppBayar = Number(sppSummary?.total_dibayar || 0) + Number(sppSaldoAwal?.total_dibayar || 0)
  const sppSisa = Math.max(0, sppNominal - sppBayar)
  const totalDisiplinPoin = Number(disiplinRekap?.total_poin || 0)
  const totalDisiplinKasus = Number(disiplinRekap?.total_kasus || 0)
  const activeSanksi = totalDisiplinPoin > 0
    ? (sanksiConfig.results || []).find((s: any) => totalDisiplinPoin >= Math.max(1, Number(s.poin_minimal || 0)))
    : null
  const disciplineSummary = {
    totalPoin: totalDisiplinPoin,
    totalKasus: totalDisiplinKasus,
    levelLabel: activeSanksi?.nama || (totalDisiplinKasus > 0 ? 'Perlu dipantau' : 'Baik'),
    lastDate: disiplinTerakhir.results?.[0]?.tanggal_terakhir || null,
    needsFollowUp: Boolean(activeSanksi) || totalDisiplinKasus > 0,
  }

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

  const weeklyAttendanceResult = await getFinalAttendanceForStudent(
    db,
    siswaId,
    weekStart,
    todayRaw < weekEnd ? todayRaw : weekEnd,
    { tahunAjaranId: taAktif?.id }
  )
  const weeklyAttendanceSummary = summarizeAttendanceRows(weeklyAttendanceResult?.statuses || [])
  const activeAttendanceYear = (attendanceYears.results || []).find((item: any) => Number(item.is_active) === 1)
    || attendanceYears.results?.[0]
  const attendanceInitial = activeAttendanceYear
    ? await getParentAttendanceByAcademicYear(activeAttendanceYear.id)
    : null

  const jamMap = parseJamPelajaran(taAktif?.jam_pelajaran)
  const calendarStatus = await getKalenderDateStatus(db, todayRaw)
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

  const todayPenugasanIds = Array.from(
    new Set(
      (jadwalRows.results || [])
        .filter((row: any) => Number(row.hari) === todayDay)
        .map((row: any) => row.penugasan_id)
        .filter(Boolean)
    )
  )
  const todaySubmittedSet = new Set<string>()
  if (todayPenugasanIds.length > 0) {
    const placeholders = todayPenugasanIds.map(() => '?').join(',')
    const sesiRows = await db.prepare(`
      SELECT penugasan_id
      FROM absensi_sesi_guru
      WHERE tanggal = ? AND penugasan_id IN (${placeholders})
    `).bind(todayRaw, ...todayPenugasanIds).all<{ penugasan_id: string }>()
    for (const row of sesiRows.results || []) {
      todaySubmittedSet.add(row.penugasan_id)
    }
  }

  const todayAbsensiRows = await db.prepare(`
    SELECT penugasan_id, jam_ke_mulai, jam_ke_selesai, status, catatan
    FROM absensi_siswa
    WHERE siswa_id = ? AND tanggal = ?
  `).bind(siswaId, todayRaw).all<TodayAbsensiRow>()

  const todayIzinRows = await db.prepare(`
    SELECT jam_pelajaran, alasan, keterangan
    FROM izin_tidak_masuk_kelas
    WHERE siswa_id = ? AND tanggal = ?
    ORDER BY created_at ASC
  `).bind(siswaId, todayRaw).all<TodayIzinRow>()

  const todayAbsensiMap = new Map<string, { status: string; catatan: string | null }>()
  for (const row of todayAbsensiRows.results || []) {
    const start = Number(row.jam_ke_mulai || 0)
    const end = Number(row.jam_ke_selesai || start)
    if (start > 0 && end >= start) {
      for (let jam = start; jam <= end; jam++) {
        todayAbsensiMap.set(`${row.penugasan_id}__${jam}`, { status: row.status, catatan: row.catatan })
      }
    } else {
      todayAbsensiMap.set(`${row.penugasan_id}__all`, { status: row.status, catatan: row.catatan })
    }
  }

  const todayIzinMap = new Map<number | 'all', string[]>()
  for (const row of todayIzinRows.results || []) {
    const note = [row.alasan || 'Izin', row.keterangan].filter(Boolean).join(': ')
    const jamList = parseIzinJam(row.jam_pelajaran)
    const keys: Array<number | 'all'> = jamList.length > 0 ? jamList : ['all']
    for (const key of keys) {
      if (!todayIzinMap.has(key)) todayIzinMap.set(key, [])
      todayIzinMap.get(key)!.push(note)
    }
  }

  const agendaRows = profil.kelas_id
    ? await db.prepare(`
        SELECT ag.penugasan_id, ag.tanggal, ag.materi, ag.foto_url, ag.status
        FROM agenda_guru ag
        JOIN penugasan_mengajar pm ON pm.id = ag.penugasan_id
        WHERE pm.kelas_id = ? AND ag.tanggal BETWEEN ? AND ?
      `).bind(profil.kelas_id, weekStart, weekEnd).all<any>()
    : { results: [] as any[] }
  const agendaMap = new Map<string, any>()
  for (const agenda of agendaRows.results || []) {
    agendaMap.set(`${agenda.penugasan_id}__${agenda.tanggal}`, agenda)
  }

  const jadwalByDay = new Map<number, any[]>()
  for (const row of (jadwalRows.results || [])) {
    const hari = Number(row.hari)
    if (!jadwalByDay.has(hari)) jadwalByDay.set(hari, [])
    const jamKe = Number(row.jam_ke)
    const slot = jamMap.get(hari)?.get(Number(row.jam_ke))
    let absensi: { status: string; catatan: string | null } | null = null
    if (hari === todayDay) {
      const exception = findSlotException(
        kbmExceptions,
        { id: profil.kelas_id, tingkat: Number(profil.tingkat) },
        jamKe
      )
      const absRecord = todayAbsensiMap.get(`${row.penugasan_id}__${jamKe}`) || todayAbsensiMap.get(`${row.penugasan_id}__all`)
      const izinNotes = [
        ...(todayIzinMap.get('all') || []),
        ...(todayIzinMap.get(jamKe) || []),
      ]
      if (!calendarStatus.isEffective) {
        absensi = { status: 'LIBUR', catatan: calendarStatus.reason || 'Hari libur' }
      } else if (exception) {
        absensi = { status: 'KBM_EXCEPTION', catatan: exception.description || exception.judul }
      } else if (izinNotes.length > 0) {
        absensi = { status: 'IZIN', catatan: Array.from(new Set(izinNotes)).join(' | ') }
      } else if (absRecord) {
        absensi = absRecord
      } else if (todaySubmittedSet.has(row.penugasan_id)) {
        absensi = { status: 'HADIR', catatan: null }
      } else {
        absensi = { status: 'BELUM_ADA_DATA', catatan: 'Absensi jam ini belum diinput oleh guru.' }
      }
    }

    const dayBlocks = jadwalByDay.get(hari)!
    const previous = dayBlocks[dayBlocks.length - 1]
    const canMerge = previous
      && previous.penugasan_id === row.penugasan_id
      && Number(previous.jam_ke_selesai) + 1 === jamKe
    if (canMerge) {
      previous.jam_ke_selesai = jamKe
      previous.waktu_selesai = slot?.selesai || previous.waktu_selesai
      previous.absensiRows.push(absensi)
    } else {
      const agendaDate = shiftDate(weekStart, hari - 1)
      dayBlocks.push({
        penugasan_id: row.penugasan_id,
        jam_ke_mulai: jamKe,
        jam_ke_selesai: jamKe,
        waktu_mulai: slot?.mulai || null,
        waktu_selesai: slot?.selesai || null,
        mapel: row.nama_mapel,
        guru: row.guru_nama || '-',
        absensiRows: [absensi],
        agenda: agendaMap.get(`${row.penugasan_id}__${agendaDate}`) || null,
        agendaDate,
        isToday: hari === todayDay,
      })
    }
  }

  const attendancePriority: Record<string, number> = {
    ALFA: 7,
    SAKIT: 6,
    IZIN: 5,
    KBM_EXCEPTION: 4,
    LIBUR: 3,
    BELUM_ADA_DATA: 2,
    HADIR: 1,
  }
  for (const blocks of jadwalByDay.values()) {
    for (const block of blocks) {
      block.absensi = block.absensiRows
        .filter(Boolean)
        .sort((a: any, b: any) => (attendancePriority[b.status] || 0) - (attendancePriority[a.status] || 0))[0] || null
      delete block.absensiRows
      block.waktu = block.waktu_mulai && block.waktu_selesai
        ? `${block.waktu_mulai} - ${block.waktu_selesai}`
        : '-'
    }
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
    weeklyAttendanceSummary,
    weekRange: { start: weekStart, end: weekEnd },
    attendanceYears: attendanceYears.results || [],
    attendanceInitial,
    disciplineSummary,
    semesters,
    semesterAvg,
    dsptTarget,
    dsptBayar,
    dsptDiskon,
    dsptSisa,
    dsptStatus,
    dsptIsInput,
    dsptIsLunas,
    dsptNeedsInput,
    paymentSubmissions,
    parentSuggestions,
    komitePaymentSettings,
    sppNominal,
    sppBayar,
    sppSisa,
    transaksiTerbaru,
    notifications,
    summons,
    notes,
    jadwalObject,
    documentationArticles,
  }

  return <PortalOrtuClient data={data} />
}
