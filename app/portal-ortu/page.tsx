import { summarizeParentAttendanceDays } from '@/lib/parent-attendance-presentation'
import { redirect } from 'next/navigation'
import { getAppSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { PortalOrtuClient } from './components/portal-ortu-client'
import { getFinalAttendanceForStudent } from '@/lib/wali-kelas-attendance'
import { ensureSchemaOnce } from '@/lib/schema-guard'
import { touchParentLastSeen } from '@/lib/parent-login-tracking'
import { ensureParentPortalEnhancementSchema } from '@/lib/parent-portal-schema'
import {
  fingerprintParentTkaSelection,
  getParentTkaSelection,
  isParentTkaSelectionComplete,
} from '@/lib/parent-tka'
import { ensureParentDisciplineSchema, getParentDisciplineSettings } from '@/lib/parent-discipline'
import {
  computeFinanceSummaryFields,
  ensureParentCommunicationTables,
  ensurePaymentSubmissionTable,
  getTodayWeekContextWIB,
  loadParentDokumentasiTabData,
  loadParentJadwalTabData,
  loadParentKedisiplinanTabData,
  loadParentKehadiranTabData,
  loadParentKeuanganTabData,
  loadParentNilaiTabData,
  loadParentPsikotesTabData,
  loadParentSaranTabData,
} from '@/lib/portal-ortu-loaders'

export const dynamic = 'force-dynamic'

const ALWAYS_READY_TABS = ['beranda', 'biodata', 'notifications', 'account'] as const
const ALLOWED_PORTAL_TABS = new Set([
  'beranda',
  'biodata',
  'notifications',
  'jadwal',
  'kehadiran',
  'nilai',
  'psikotes',
  'keuangan',
  'saran',
  'dokumentasi',
  'account',
])

async function seedParentCommunication(db: D1Database, siswaId: string) {
  const bkRows = await db.prepare(`
      SELECT r.id, r.tindak_lanjut, r.catatan_tindak_lanjut, r.updated_at, u.nama_lengkap as guru_bk_nama
      FROM bk_rekaman r
      LEFT JOIN "user" u ON u.id = r.guru_bk_id
      WHERE r.siswa_id = ?
      ORDER BY r.updated_at DESC
      LIMIT 50
    `).bind(siswaId).all<any>()

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

export default async function PortalOrtuPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const requestedTab = (await searchParams).tab
  const session = await getAppSession()
  if (!session) redirect(requestedTab === 'keuangan' ? '/portal-ortu/login?next=keuangan' : '/portal-ortu/login')
  if (session.kind === 'staff') redirect('/dashboard')

  const siswaId = session.user.siswa_id
  const db = await getDB()
  await touchParentLastSeen(db, siswaId).catch(() => undefined)
  await ensureSchemaOnce('parent-communication', () => ensureParentCommunicationTables(db))
  await ensureParentPortalEnhancementSchema(db)
  await ensurePaymentSubmissionTable(db)
  await ensureSchemaOnce('parent-announcements', async () => {
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
  })

  const disciplineSettings = await getParentDisciplineSettings()
  if (disciplineSettings.enabled) {
    await ensureParentDisciplineSchema(db)
  }
  await seedParentCommunication(db, siswaId)

  const initialPortalTab = requestedTab === 'kedisiplinan'
    ? (disciplineSettings.enabled ? 'kedisiplinan' : 'beranda')
    : (requestedTab && ALLOWED_PORTAL_TABS.has(requestedTab) ? requestedTab : 'beranda')

  const profil = await db.prepare(`
    SELECT
      s.id, s.nisn, s.nis_lokal, s.nama_lengkap, s.jenis_kelamin, s.status, s.foto_url,
      s.kelas_id, s.tahun_masuk, s.minat_jurusan, s.nik, s.tempat_lahir, s.tanggal_lahir,
      s.agama, s.jumlah_saudara, s.anak_ke, s.status_anak, s.asal_sekolah,
      s.tempat_tinggal, s.asrama, s.kamar, s.alamat_lengkap, s.rt, s.rw,
      s.desa_kelurahan, s.kecamatan, s.kabupaten_kota, s.provinsi, s.kode_pos,
      s.nomor_whatsapp, s.nomor_kk,
      s.nama_ayah, s.nik_ayah, s.tempat_lahir_ayah, s.tanggal_lahir_ayah,
      s.status_ayah, s.pendidikan_ayah, s.pekerjaan_ayah, s.penghasilan_ayah,
      s.nama_ibu, s.nik_ibu, s.tempat_lahir_ibu, s.tanggal_lahir_ibu,
      s.status_ibu, s.pendidikan_ibu, s.pekerjaan_ibu, s.penghasilan_ibu,
      k.tingkat, k.nomor_kelas, k.kelompok, k.wali_kelas_id
    FROM siswa s
    LEFT JOIN kelas k ON k.id = s.kelas_id
    WHERE s.id = ?
  `).bind(siswaId).first<any>()
  if (!profil) redirect('/portal-ortu/login')

  const { todayRaw, weekStart, weekEnd } = getTodayWeekContextWIB()

  const [
    pengumumanRows,
    waliKelasRow,
    notifications,
    summons,
    notes,
    taAktif,
    dspt,
    sppSaldoAwal,
    disiplinRekap,
    disiplinTerakhir,
    sanksiConfig,
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
      FROM parent_notifications pn
      WHERE pn.siswa_id = ?
        AND pn.archived_at IS NULL
        AND pn.type <> 'izin_keluar'
        AND (? = 1 OR pn.type NOT IN ('kedisiplinan', 'sanksi', 'klarifikasi_kedisiplinan'))
        AND NOT (pn.type = 'absensi' AND COALESCE(pn.source_ref, '') LIKE '%:IZIN')
        AND NOT (
          pn.type = 'absensi'
          AND COALESCE(pn.source_ref, '') LIKE '%:ALFA'
          AND NOT EXISTS (
              SELECT 1
              FROM absensi_siswa ab
              WHERE ab.siswa_id = pn.siswa_id
                AND ab.status = 'ALFA'
                AND pn.source_ref = ab.penugasan_id || ':' || ab.tanggal || ':ALFA'
          )
        )
      ORDER BY pn.created_at DESC
      LIMIT 100
    `).bind(siswaId, disciplineSettings.enabled ? 1 : 0).all<any>(),
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
    disciplineSettings.enabled
      ? db.prepare(`
          SELECT COUNT(sp.id) AS total_kasus, COALESCE(SUM(COALESCE(sp.poin_snapshot, mp.poin, 0)), 0) AS total_poin
          FROM siswa_pelanggaran sp
          LEFT JOIN master_pelanggaran mp ON mp.id = sp.master_pelanggaran_id
          WHERE sp.siswa_id = ? AND sp.publication_status = 'published'
        `).bind(siswaId).first<any>()
      : Promise.resolve({ total_kasus: 0, total_poin: 0 }),
    disciplineSettings.enabled
      ? db.prepare(`
          SELECT MAX(sp.tanggal) AS tanggal_terakhir
          FROM siswa_pelanggaran sp
          WHERE sp.siswa_id = ? AND sp.publication_status = 'published'
        `).bind(siswaId).all<any>()
      : Promise.resolve({ results: [] as any[] }),
    disciplineSettings.enabled
      ? db.prepare(`SELECT nama, poin_minimal FROM sanksi_config ORDER BY poin_minimal DESC`).all<any>()
      : Promise.resolve({ results: [] as any[] }),
  ])

  const financeSummary = computeFinanceSummaryFields(profil.tahun_masuk, dspt, sppSaldoAwal)
  const hasRemainingBill = (financeSummary.dsptIsInput && financeSummary.dsptSisa > 0) || financeSummary.sppSisa > 0

  const [
    weeklyAttendanceResult,
    pendingConfirmationRow,
    tkaSummary,
    kehadiranTabData,
    kedisiplinanTabData,
    nilaiTabData,
    psikotesTabData,
    keuanganTabData,
    saranTabData,
    dokumentasiTabData,
  ] = await Promise.all([
    getFinalAttendanceForStudent(
      db,
      siswaId,
      weekStart,
      todayRaw < weekEnd ? todayRaw : weekEnd,
      { tahunAjaranId: taAktif?.id },
    ),
    hasRemainingBill && initialPortalTab !== 'keuangan'
      ? db.prepare(`
          SELECT COALESCE(SUM(jumlah), 0) AS total
          FROM fin_payment_submissions
          WHERE siswa_id = ? AND kategori = 'dspt' AND status = 'menunggu_konfirmasi'
        `).bind(siswaId).first<{ total: number | null }>()
      : Promise.resolve(null),
    Number(profil.tingkat) === 12 && taAktif?.id
      ? (async () => {
          const current = await getParentTkaSelection(db, siswaId, taAktif.id)
          const selection = current.selection
          const fingerprint = selection ? await fingerprintParentTkaSelection(selection) : null
          const [latestApproval, bkRows] = await Promise.all([
            db.prepare(`
              SELECT selection_fingerprint, approved_at
              FROM parent_tka_approvals
              WHERE siswa_id = ? AND tahun_ajaran_id = ?
              ORDER BY datetime(approved_at) DESC
              LIMIT 1
            `).bind(siswaId, taAktif.id).first<{ selection_fingerprint: string; approved_at: string }>(),
            profil.kelas_id
              ? db.prepare(`
                  SELECT DISTINCT u.id, u.nama_lengkap, u.nomor_whatsapp
                  FROM kelas_binaan_bk kb
                  JOIN "user" u ON u.id = kb.guru_bk_id
                  WHERE kb.kelas_id = ? AND kb.tahun_ajaran_id = ?
                  ORDER BY u.nama_lengkap COLLATE NOCASE
                `).bind(profil.kelas_id, taAktif.id).all<any>()
              : Promise.resolve({ results: [] as any[] }),
          ])
          return {
            hasData: current.hasData,
            selection,
            isComplete: Boolean(selection && isParentTkaSelectionComplete(selection)),
            approval: {
              isApproved: Boolean(fingerprint && latestApproval?.selection_fingerprint === fingerprint),
              approvedAt: fingerprint && latestApproval?.selection_fingerprint === fingerprint ? latestApproval.approved_at : null,
              needsReapproval: Boolean(latestApproval && fingerprint && latestApproval.selection_fingerprint !== fingerprint),
            },
            bkContacts: bkRows.results || [],
          }
        })()
      : Promise.resolve(null),
    initialPortalTab === 'kehadiran' ? loadParentKehadiranTabData(db, siswaId) : Promise.resolve(null),
    initialPortalTab === 'kedisiplinan' ? loadParentKedisiplinanTabData(db, siswaId, taAktif?.id) : Promise.resolve(null),
    initialPortalTab === 'nilai' ? loadParentNilaiTabData(db, siswaId) : Promise.resolve(null),
    initialPortalTab === 'psikotes' ? loadParentPsikotesTabData(db, siswaId) : Promise.resolve(null),
    initialPortalTab === 'keuangan'
      ? loadParentKeuanganTabData(db, siswaId, { tingkat: profil.tingkat, tahunMasuk: profil.tahun_masuk })
      : Promise.resolve(null),
    initialPortalTab === 'saran' ? loadParentSaranTabData(db, siswaId) : Promise.resolve(null),
    initialPortalTab === 'dokumentasi' ? loadParentDokumentasiTabData(db) : Promise.resolve(null),
  ])

  const weeklyAttendanceSummary = summarizeParentAttendanceDays(weeklyAttendanceResult?.statuses || []).summary
  const todayAttendance = weeklyAttendanceResult?.statuses.find(day => day.tanggal === todayRaw) || null

  const jadwalTabData = initialPortalTab === 'jadwal'
    ? await loadParentJadwalTabData(db, siswaId, {
        kelasId: profil.kelas_id,
        tingkat: profil.tingkat,
        tahunAjaranId: taAktif?.id,
        jamPelajaran: taAktif?.jam_pelajaran,
        todayAttendance,
      })
    : null

  const disciplineInitial = kedisiplinanTabData?.disciplineInitial || null
  const totalDisiplinPoin = Number(disciplineInitial?.lifetimeSummary.totalPoin ?? disiplinRekap?.total_poin ?? 0)
  const totalDisiplinKasus = Number(disciplineInitial?.lifetimeSummary.totalKasus ?? disiplinRekap?.total_kasus ?? 0)
  const activeSanksi = totalDisiplinPoin > 0
    ? (sanksiConfig.results || []).find((s: any) => totalDisiplinPoin >= Math.max(1, Number(s.poin_minimal || 0)))
    : null
  const disciplineSummary = {
    totalPoin: totalDisiplinPoin,
    totalKasus: totalDisiplinKasus,
    levelLabel: disciplineInitial?.lifetimeSummary.levelLabel || activeSanksi?.nama || (totalDisiplinKasus > 0 ? 'Perlu dipantau' : 'Baik'),
    lastDate: disciplineInitial?.lifetimeSummary.lastDate || disiplinTerakhir.results?.[0]?.tanggal_terakhir || null,
    needsFollowUp: Boolean(activeSanksi) || totalDisiplinKasus > 0,
  }

  const kelasLabel = profil.tingkat
    ? `${profil.tingkat}-${profil.nomor_kelas}${String(profil.tingkat) !== '10' && profil.kelompok ? ` ${profil.kelompok}` : ''}`
    : '-'
  const waliPhone = String(waliKelasRow?.nomor_kontak || '').replace(/\D/g, '')
  const waUrl = waliPhone ? `https://wa.me/${waliPhone}` : null
  const loadedTabs = Array.from(new Set([...ALWAYS_READY_TABS, initialPortalTab]))

  const data = {
    initialPortalTab,
    loadedTabs,
    profil,
    kelasLabel,
    waliKelasRow,
    waUrl,
    pengumumanRows,
    weeklyAttendanceSummary,
    todayAttendance,
    weekRange: { start: weekStart, end: weekEnd },
    attendanceYears: kehadiranTabData?.attendanceYears || kedisiplinanTabData?.attendanceYears || [],
    attendanceInitial: kehadiranTabData?.attendanceInitial || null,
    disciplineSummary,
    disciplineSettings,
    disciplineInitial,
    semesters: nilaiTabData?.semesters || [],
    semesterAvg: nilaiTabData?.semesterAvg ?? null,
    ...financeSummary,
    pendingConfirmationTotal:
      keuanganTabData?.pendingConfirmationTotal ?? Number(pendingConfirmationRow?.total || 0),
    paymentSubmissions: keuanganTabData?.paymentSubmissions || { results: [] },
    komitePaymentSettings: keuanganTabData?.komitePaymentSettings || null,
    transaksiTerbaru: keuanganTabData?.transaksiTerbaru || { results: [] },
    parentSuggestions: saranTabData?.parentSuggestions || { results: [] },
    notifications,
    summons,
    notes,
    jadwalObject: jadwalTabData?.jadwalObject || {},
    documentationArticles: dokumentasiTabData?.documentationArticles || [],
    tkaSummary,
    psikotesData: psikotesTabData?.psikotesData ?? null,
  }

  return <PortalOrtuClient data={data} />
}
