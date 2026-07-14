import Link from 'next/link'
import { getDB } from '@/utils/db'
import { todayWIB } from '@/lib/time'
import { formatNamaKelas } from '@/lib/utils'
import { getFinalAttendanceForClass } from '@/lib/wali-kelas-attendance'
import { getKalenderDateStatus } from '@/lib/kalender-pendidikan'
import { ParentCommActions } from './ParentCommActions'
import { KeputusanAbsensiHariIni, type KeputusanAbsensiRow } from './KeputusanAbsensiHariIni'
import { AvatarSiswa } from '@/components/ui/avatar-siswa'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { JadwalMengajarToday } from './shared/JadwalMengajarToday'
import { KehadiranPribadiCard } from './shared/KehadiranPribadiCard'
import { PenugasanMasukCard } from './shared/PenugasanMasukCard'
import { QuickEditSiswa } from '@/app/dashboard/kelas-binaan/components/quick-edit-siswa'
import {
  Warning as AlertTriangle,
  ArrowRight,
  BookOpen,
  Calendar as CalendarCheck,
  Clipboard as ClipboardList,
  Books as Library,
  Notebook as NotebookPen,
  ShieldWarning as ShieldAlert,
  UserCheck,
  Users,
} from '@phosphor-icons/react/dist/ssr'

type Props = {
  userId: string
  nama: string
  namaDepan: string
  avatarUrl: string | null
  roleLabel: string
  roleColor: string
  sapaan: string
  taAktif: { id?: string; nama: string; semester: number } | null
  isGuruPiket?: boolean
  kelasIdOverride?: string | null
  riskFilter?: string
  view?: KelasBinaanView
  showWelcome?: boolean
  showTopCards?: boolean
  showFeatureShortcuts?: boolean
  dashboardVisibility?: Record<string, boolean>
  quickEdit?: boolean
}

export type KelasBinaanView = 'home' | 'keputusan' | 'siswa' | 'rekap' | 'perhatian' | 'agenda'

function badgeClass(status: string) {
  if (status === 'LIBUR') return 'bg-slate-100 text-slate-600 border-slate-200'
  if (status === 'HADIR') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  if (status === 'SAKIT') return 'bg-amber-100 text-amber-700 border-amber-200'
  if (status === 'IZIN') return 'bg-blue-100 text-blue-700 border-blue-200'
  if (status === 'ALFA') return 'bg-rose-100 text-rose-700 border-rose-200'
  if (status === 'PARSIAL') return 'bg-violet-100 text-violet-700 border-violet-200'
  if (status === 'PERLU_KONFIRMASI_WALI') return 'bg-purple-100 text-purple-700 border-purple-200'
  return 'bg-slate-100 text-slate-600 border-slate-200'
}

function attendanceStatusLabel(status: string | null | undefined) {
  if (status === 'LIBUR') return 'Libur'
  if (!status || status === 'BELUM_ADA_DATA') return 'Belum Lengkap'
  if (status === 'BELUM_ADA_INPUT') return 'Belum Ada Input'
  if (status === 'PARSIAL') return 'Bolos'
  if (status === 'PERLU_KONFIRMASI_WALI') return 'Perlu Keputusan Wali'
  return status
}

function sourceLabel(source: string) {
  if (source === 'kalender') return 'Kalender Pendidikan'
  if (source === 'perizinan') return 'Perizinan'
  if (source === 'wali_kelas') return 'Wali Kelas'
  if (source === 'koreksi_wali_kelas') return 'Koreksi Wali'
  if (source === 'guru') return 'Guru'
  if (source === 'perlu_konfirmasi_wali') return 'Perlu Keputusan Wali'
  if (source === 'belum_ada_input') return 'Belum Ada Input'
  return 'Belum Lengkap'
}

function summonStatusLabel(status: string | null) {
  if (!status) return 'Belum ada'
  if (status === 'terkirim') return 'Terkirim'
  if (status === 'dikonfirmasi') return 'Dikonfirmasi'
  if (status === 'reschedule_diminta') return 'Minta jadwal ulang'
  if (status === 'selesai') return 'Selesai'
  return status
}

function attentionPriority(status: string | null | undefined) {
  if (status === 'PERLU_KONFIRMASI_WALI') return 0
  if (status === 'PARSIAL') return 1
  if (status === 'BELUM_ADA_INPUT') return 2
  if (status === 'BELUM_ADA_DATA') return 3
  if (status === 'ALFA') return 4
  return 5
}

function quickEditDomisiliLabel(tempatTinggal: string | null, desaKelurahan: string | null) {
  if (tempatTinggal?.startsWith('Pesantren ')) return tempatTinggal
  if (tempatTinggal === 'Non-Pesantren') {
    const desa = String(desaKelurahan || '').trim().toLowerCase()
    if (desa.includes('sukarapih')) return 'Warga Desa Sukarapih'
    if (desa.includes('wargakerta')) return 'Warga Desa Wargakerta'
    return 'KELUAR DARI PESANTREN'
  }
  return tempatTinggal
}

export async function KelasBinaanDashboard({
  userId,
  nama,
  namaDepan,
  avatarUrl,
  roleLabel,
  roleColor,
  sapaan,
  taAktif,
  isGuruPiket,
  kelasIdOverride = null,
  riskFilter = 'all',
  view = 'home',
  showWelcome = true,
  showTopCards = true,
  dashboardVisibility,
  quickEdit = false,
}: Props) {
  const show = (id: string) => dashboardVisibility?.[id] !== false
  const db = await getDB()
  const today = todayWIB()
  const startOfMonth = new Date(today + 'T00:00:00')
  startOfMonth.setDate(1)
  const startOfMonthStr = startOfMonth.toISOString().split('T')[0]

  const kelas = kelasIdOverride
    ? await db.prepare(`
        SELECT k.id, k.tingkat, k.nomor_kelas, k.kelompok, k.wali_kelas_id, u.nama_lengkap as wali_kelas_nama
        FROM kelas k
        LEFT JOIN "user" u ON k.wali_kelas_id = u.id
        WHERE k.id = ?
      `).bind(kelasIdOverride).first<any>()
    : await db.prepare(`
        SELECT k.id, k.tingkat, k.nomor_kelas, k.kelompok, k.wali_kelas_id, u.nama_lengkap as wali_kelas_nama
        FROM kelas k
        LEFT JOIN "user" u ON k.wali_kelas_id = u.id
        WHERE k.wali_kelas_id = ?
        ORDER BY k.tingkat, k.kelompok, CAST(k.nomor_kelas AS INTEGER)
        LIMIT 1
      `).bind(userId).first<any>()

  if (!kelas) {
    return (
      <div className="space-y-3 animate-in fade-in duration-500 pb-12">
        {showWelcome && null}
        <div className="rounded-xl border border-surface bg-surface shadow-sm p-8 flex flex-col items-center gap-3 text-center">
          <Library className="h-10 w-10 text-slate-300 dark:text-slate-700" />
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Belum ada kelas yang diasuh</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Hubungi admin untuk penugasan kelas wali.</p>
          </div>
        </div>
        <KehadiranPribadiCard userId={userId} />

        {/* Penugasan Masuk (jika dia guru piket) */}
        {isGuruPiket && <PenugasanMasukCard userId={userId} />}
      </div>
    )
  }

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

  const [todayCalendarStatus, snapshotMonth, topPelanggaran, agendaTerbaru, izinPembelajaranHariIni, komunikasiStatusRaw, komunikasiTimelineRaw] = await Promise.all([
    getKalenderDateStatus(db, today),
    getFinalAttendanceForClass(db, kelas.id, startOfMonthStr, today),
    db.prepare(`
      SELECT sp.siswa_id, s.nama_lengkap, s.nisn, SUM(mp.poin) as total_poin, COUNT(*) as jumlah_kasus
      FROM siswa_pelanggaran sp
      JOIN siswa s ON sp.siswa_id = s.id
      JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
      WHERE s.kelas_id = ?
      GROUP BY sp.siswa_id
      ORDER BY total_poin DESC, jumlah_kasus DESC, s.nama_lengkap ASC
    `).bind(kelas.id).all<any>().then(result => result.results || []),
    db.prepare(`
      SELECT ag.tanggal, mp.nama_mapel, ag.materi
      FROM agenda_guru ag
      JOIN penugasan_mengajar pm ON ag.penugasan_id = pm.id
      JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
      WHERE pm.kelas_id = ?
      ORDER BY ag.created_at DESC
      LIMIT 4
    `).bind(kelas.id).all<any>().then(result => result.results || []),
    db.prepare(`
      SELECT itk.id, s.id AS siswa_id, s.nama_lengkap, s.foto_url, itk.alasan, itk.keterangan, itk.jam_pelajaran
      FROM izin_tidak_masuk_kelas itk
      JOIN siswa s ON itk.siswa_id = s.id
      WHERE s.kelas_id = ? AND itk.tanggal = ?
      ORDER BY s.nama_lengkap ASC
    `).bind(kelas.id, today).all<any>().then(result => result.results || []),
    db.prepare(`
      SELECT s.id AS siswa_id,
             COALESCE(pn.unread_count, 0) AS unread_count,
             ps.status AS summon_status
      FROM siswa s
      LEFT JOIN (
        SELECT siswa_id, COUNT(*) AS unread_count
        FROM parent_notifications
        WHERE is_read = 0
        GROUP BY siswa_id
      ) pn ON pn.siswa_id = s.id
      LEFT JOIN (
        SELECT p1.siswa_id, p1.status
        FROM parent_summons p1
        JOIN (
          SELECT siswa_id, MAX(created_at) AS max_created
          FROM parent_summons
          GROUP BY siswa_id
        ) p2 ON p2.siswa_id = p1.siswa_id AND p2.max_created = p1.created_at
      ) ps ON ps.siswa_id = s.id
      WHERE s.kelas_id = ? AND s.status = 'aktif'
    `).bind(kelas.id).all<any>().then(res => res.results || []),
    db.prepare(`
      SELECT ptn.siswa_id, ptn.note_type, ptn.content, ptn.created_at
      FROM parent_thread_notes ptn
      JOIN siswa s ON s.id = ptn.siswa_id
      WHERE s.kelas_id = ? AND s.status = 'aktif'
      ORDER BY ptn.created_at DESC
    `).bind(kelas.id).all<any>().then(res => res.results || []),
  ])

  const contactRows = await db.prepare(`
    SELECT s.id AS siswa_id, s.nomor_whatsapp AS phone, s.tempat_tinggal, s.desa_kelurahan
    FROM siswa s
    WHERE s.kelas_id = ? AND s.status = 'aktif'
  `).bind(kelas.id).all<any>()
  const studentContacts: Record<string, { phone: string | null; tempatTinggal: string | null }> = Object.fromEntries(
    (contactRows.results || []).map((r: any) => [r.siswa_id, {
      phone: r.phone || null,
      tempatTinggal: quickEditDomisiliLabel(r.tempat_tinggal || null, r.desa_kelurahan || null),
    }])
  )

  const jumlahSiswa = snapshotMonth?.siswa.length ?? 0
  const isTodayEffective = todayCalendarStatus.isEffective
  const todayHolidayReason = todayCalendarStatus.reason || 'Tidak efektif pembelajaran'
  const todayRows = snapshotMonth?.siswa.map(siswa => snapshotMonth.statusByStudent.get(siswa.id)?.find(row => row.tanggal === today)).filter(Boolean) ?? []

  const todaySummary = {
    hadir: 0,
    sakit: 0,
    izin: 0,
    alfa: 0,
    parsial: 0,
    perluKonfirmasiWali: 0,
    belumAdaInput: 0,
    belumAdaData: 0,
  }

  const komunikasiMap = new Map<string, { unread: number; summonStatus: string | null }>()
  for (const row of komunikasiStatusRaw || []) {
    komunikasiMap.set(row.siswa_id, {
      unread: Number(row.unread_count || 0),
      summonStatus: row.summon_status || null,
    })
  }

  const timelineMap = new Map<string, { note_type: string; content: string; created_at: string }>()
  for (const row of komunikasiTimelineRaw || []) {
    if (!timelineMap.has(row.siswa_id)) {
      timelineMap.set(row.siswa_id, {
        note_type: row.note_type,
        content: row.content,
        created_at: row.created_at,
      })
    }
  }

  const studentRows = snapshotMonth?.siswa.map(siswa => {
    const statuses = snapshotMonth.statusByStudent.get(siswa.id) || []
    const todayStatus = statuses.find(item => item.tanggal === today) || null
    const monthly = { sakit: 0, izin: 0, alfa: 0, parsial: 0, perluKonfirmasiWali: 0 }
    for (const status of statuses) {
      if (status.status_akhir === 'SAKIT') monthly.sakit++
      else if (status.status_akhir === 'IZIN') monthly.izin++
      else if (status.status_akhir === 'ALFA') monthly.alfa++
      else if (status.status_akhir === 'PARSIAL') monthly.parsial++
      else if (status.status_akhir === 'PERLU_KONFIRMASI_WALI') monthly.perluKonfirmasiWali++
    }
    const pelanggaran = topPelanggaran.find(item => item.siswa_id === siswa.id)
    return {
      siswa_id: siswa.id,
      nama_lengkap: siswa.nama_lengkap,
      nisn: siswa.nisn,
      foto_url: siswa.foto_url ?? null,
      todayStatus,
      monthly,
      totalPoin: pelanggaran?.total_poin ?? 0,
      jumlahKasus: pelanggaran?.jumlah_kasus ?? 0,
      komunikasi: komunikasiMap.get(siswa.id) || { unread: 0, summonStatus: null },
      timeline: timelineMap.get(siswa.id) || null,
      phone: studentContacts[siswa.id]?.phone || null,
      tempatTinggal: studentContacts[siswa.id]?.tempatTinggal || null,
    }
  }) || []

  const filteredStudentRows = studentRows.filter(row => {
    if (riskFilter === 'all') return true
    if (riskFilter === 'high') return row.monthly.alfa >= 2 || row.totalPoin >= 25 || row.komunikasi.summonStatus === 'terkirim' || row.tempatTinggal === 'KELUAR DARI PESANTREN'
    if (riskFilter === 'pending_comm') return row.komunikasi.unread > 0 || row.komunikasi.summonStatus === 'terkirim' || row.komunikasi.summonStatus === 'reschedule_diminta'
    if (riskFilter === 'alfa') return row.monthly.alfa >= 1 || (row.todayStatus && row.todayStatus.status_akhir === 'ALFA')
    if (riskFilter === 'point') return row.totalPoin >= 25
    return true
  })

  for (const row of todayRows) {
    if (row?.status_akhir === 'SAKIT') todaySummary.sakit++
    else if (row?.status_akhir === 'IZIN') todaySummary.izin++
    else if (row?.status_akhir === 'ALFA') todaySummary.alfa++
    else if (row?.status_akhir === 'PARSIAL') todaySummary.parsial++
    else if (row?.status_akhir === 'PERLU_KONFIRMASI_WALI') todaySummary.perluKonfirmasiWali++
    else if (row?.status_akhir === 'BELUM_ADA_INPUT') todaySummary.belumAdaInput++
    else if (row?.status_akhir === 'BELUM_ADA_DATA') todaySummary.belumAdaData++
    else todaySummary.hadir++
  }

  const summaryByDate = (snapshotMonth?.dates || []).map(tanggal => {
    const rows = snapshotMonth?.siswa
      .map(siswa => snapshotMonth.statusByStudent.get(siswa.id)?.find(item => item.tanggal === tanggal))
      .filter(Boolean) as NonNullable<(typeof todayRows)[number]>[]

    const summary = { tanggal, tidakHadir: 0, perhatian: 0 }
    for (const row of rows) {
      if (['SAKIT', 'IZIN', 'ALFA', 'PARSIAL', 'PERLU_KONFIRMASI_WALI', 'BELUM_ADA_INPUT', 'BELUM_ADA_DATA'].includes(row.status_akhir)) summary.tidakHadir++
      if (['ALFA', 'BELUM_ADA_INPUT', 'BELUM_ADA_DATA'].includes(row.status_akhir) || row.sumber_status === 'koreksi_wali_kelas') summary.perhatian++
    }
    return summary
  }).slice(-7)

  const maxTidakHadir = Math.max(1, ...summaryByDate.map(item => item.tidakHadir))
  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

  const tidakMasukHariIni = studentRows
    .filter(row => isTodayEffective && row.todayStatus && ['SAKIT', 'IZIN', 'ALFA', 'PARSIAL', 'PERLU_KONFIRMASI_WALI', 'BELUM_ADA_INPUT', 'BELUM_ADA_DATA'].includes(row.todayStatus.status_akhir))
    .sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap))

  const perluPerhatian = studentRows
    .filter(row =>
      (isTodayEffective && row.todayStatus && ['ALFA', 'PARSIAL', 'PERLU_KONFIRMASI_WALI', 'BELUM_ADA_INPUT', 'BELUM_ADA_DATA'].includes(row.todayStatus.status_akhir)) ||
      row.monthly.alfa >= 2 ||
      row.totalPoin >= 25
    )
    .sort((a, b) => (
      b.monthly.alfa - a.monthly.alfa ||
      b.totalPoin - a.totalPoin ||
      a.nama_lengkap.localeCompare(b.nama_lengkap)
    ))
    .slice(0, 6)

  const namaKelas = formatNamaKelas(kelas.tingkat, kelas.nomor_kelas, kelas.kelompok)
  const keputusanAbsensiRows = (todayRows as KeputusanAbsensiRow[])
  const baseParams = kelasIdOverride ? `kelas=${encodeURIComponent(kelas.id)}` : ''
  const viewHref = (targetView: KelasBinaanView, extra?: Record<string, string>) => {
    const params = new URLSearchParams(baseParams)
    params.set('view', targetView)
    if (extra) {
      for (const [key, value] of Object.entries(extra)) params.set(key, value)
    }
    if (quickEdit && targetView === 'siswa' && extra?.edit === undefined) params.set('edit', '1')
    return `/dashboard/kelas-binaan?${params.toString()}`
  }
  const returnToKelasBinaan = encodeURIComponent(viewHref(view))
  const pendingDecisionRows = studentRows
    .filter(row => isTodayEffective && row.todayStatus && ['PERLU_KONFIRMASI_WALI', 'PARSIAL', 'BELUM_ADA_INPUT', 'BELUM_ADA_DATA', 'ALFA'].includes(row.todayStatus.status_akhir))
    .sort((a, b) => (
      attentionPriority(a.todayStatus?.status_akhir) - attentionPriority(b.todayStatus?.status_akhir) ||
      a.nama_lengkap.localeCompare(b.nama_lengkap)
    ))
  const todaySummaryItems = [
    { label: 'Hadir', value: todaySummary.hadir, tone: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Sakit', value: todaySummary.sakit, tone: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Izin', value: todaySummary.izin, tone: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Alfa', value: todaySummary.alfa, tone: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Bolos', value: todaySummary.parsial, tone: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Keputusan Wali', value: todaySummary.perluKonfirmasiWali, tone: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Belum Input', value: todaySummary.belumAdaInput, tone: 'text-slate-600', bg: 'bg-slate-100' },
    { label: 'Belum Lengkap', value: todaySummary.belumAdaData, tone: 'text-slate-600', bg: 'bg-slate-100' },
  ]
  const menuItems: Array<{ view: KelasBinaanView; title: string; desc: string; count: number | string; icon: any; tone: string }> = [
    { view: 'keputusan', title: 'Keputusan Absensi', desc: 'Tetapkan status harian siswa', count: pendingDecisionRows.length, icon: ClipboardList, tone: 'text-purple-600 bg-purple-50 border-purple-100' },
    { view: 'siswa', title: 'Daftar Siswa', desc: 'Data, komunikasi, dan tindak lanjut', count: jumlahSiswa, icon: Users, tone: 'text-slate-600 bg-slate-50 border-slate-200' },
    { view: 'rekap', title: 'Rekap Absensi', desc: 'Ringkasan dan tren 7 hari', count: tidakMasukHariIni.length, icon: CalendarCheck, tone: 'text-blue-600 bg-blue-50 border-blue-100' },
    { view: 'perhatian', title: 'Perlu Perhatian', desc: 'Alfa, bolos, belum lengkap, poin', count: perluPerhatian.length, icon: ShieldAlert, tone: 'text-amber-600 bg-amber-50 border-amber-100' },
    { view: 'agenda', title: 'Agenda & Izin', desc: 'Materi terbaru dan izin pelajaran', count: agendaTerbaru.length + izinPembelajaranHariIni.length, icon: BookOpen, tone: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
  ]

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      {showWelcome && null}

      {showTopCards && show('top_cards') && (
        <>
          <KehadiranPribadiCard userId={userId} />
          {/* Penugasan Masuk (jika dia guru piket) */}
          {isGuruPiket && <PenugasanMasukCard userId={userId} />}
          <JadwalMengajarToday userId={userId} taAktif={taAktif} />
        </>
      )}

      <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 via-amber-50/70 to-white px-4 py-4 shadow-sm dark:border-amber-800 dark:from-amber-900/20 dark:to-transparent sm:px-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500 shadow-sm sm:h-14 sm:w-14">
              <Library className="h-7 w-7 text-white" />
            </div>
            <div className="min-w-0 pt-0.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-600 dark:text-amber-400">Kelas Binaan</p>
              <p className="mt-0.5 break-words text-xl font-bold leading-tight text-slate-800 dark:text-slate-100">Kelas {namaKelas}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1 whitespace-nowrap"><Users className="h-3.5 w-3.5" /> {jumlahSiswa} siswa aktif</span>
                {kelas.wali_kelas_nama && <span className="inline-flex items-center gap-1 break-words"><UserCheck className="h-3.5 w-3.5 shrink-0" /> Wali: {kelas.wali_kelas_nama}</span>}
              </div>
            </div>
          </div>
          <Link href="/dashboard/keterangan-absensi" className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 sm:w-auto sm:px-3 sm:py-2">
            <NotebookPen className="h-3.5 w-3.5" /> Keterangan Absensi
          </Link>
        </div>
      </div>

      {view === 'home' && (
        <>
          {show('menu_navigasi') && (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
            {menuItems.map(item => {
              const Icon = item.icon
              return (
                <Link
                  key={item.view}
                  href={viewHref(item.view)}
                  className="group rounded-xl border border-surface bg-surface p-3 shadow-sm transition-colors hover:border-amber-200 hover:bg-amber-50/40"
                >
                  <div className="flex items-start gap-3">
                    <div className={`rounded-lg border p-2 ${item.tone}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{item.title}</p>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-amber-500" />
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{item.desc}</p>
                      <p className="mt-2 text-[11px] font-semibold text-slate-500">{item.count} item</p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
          )}

        </>
      )}

      {view === 'keputusan' && (
        <KeputusanAbsensiHariIni
        kelasId={kelas.id}
        tanggal={today}
        rows={keputusanAbsensiRows}
        isEffective={isTodayEffective}
        holidayReason={todayHolidayReason}
      />
      )}

      {view === 'rekap' && (
      <div className="grid grid-cols-1 gap-4">
        <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden xl:col-span-2">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
            <div className="p-1.5 rounded-md bg-blue-50 border border-blue-100">
              <ClipboardList className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Ketidakhadiran 7 Hari</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Status akhir setelah ringkasan guru dan koreksi wali kelas</p>
            </div>
            <Link href="/dashboard/rekap-absensi" className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1">
              Rekap <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="p-4">
            <div className="flex items-end gap-2 h-24">
              {summaryByDate.map(item => {
                const dateObj = new Date(item.tanggal + 'T00:00:00')
                const pct = Math.round((item.tidakHadir / maxTidakHadir) * 100)
                return (
                  <div key={item.tanggal} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold text-rose-500">{item.tidakHadir}</span>
                    <div className="w-full flex items-end h-14">
                      <div className="w-full rounded-t bg-rose-400 min-h-[6px]" style={{ height: `${Math.max(8, pct)}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-400">{dayNames[dateObj.getDay()]}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      )}

      {(view === 'perhatian' || view === 'agenda') && (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {view === 'perhatian' && (
        <>
        <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
            <div className="p-1.5 rounded-md bg-rose-50 border border-rose-100">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Tidak Masuk Hari Ini</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Siswa dengan status akhir non-hadir</p>
            </div>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {tidakMasukHariIni.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-400">Belum ada siswa tidak masuk sekolah hari ini.</div>
            ) : (
              tidakMasukHariIni.slice(0, 6).map(row => (
                <Link key={row.siswa_id} href={`/dashboard/siswa/${row.siswa_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <AvatarSiswa fotoUrl={row.foto_url} nama={row.nama_lengkap} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{row.nama_lengkap}</p>
                    <p className="text-[10px] text-slate-400">{sourceLabel(row.todayStatus?.sumber_status || 'belum_ada_data')}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeClass(row.todayStatus?.status_akhir || 'BELUM_ADA_DATA')}`}>
                    {attendanceStatusLabel(row.todayStatus?.status_akhir)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
            <div className="p-1.5 rounded-md bg-amber-50 border border-amber-100">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Perlu Perhatian</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Alfa berulang, bolos, belum lengkap, atau poin tinggi</p>
            </div>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {perluPerhatian.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-400">Belum ada siswa yang perlu perhatian khusus.</div>
            ) : (
              perluPerhatian.map(row => (
                <Link key={row.siswa_id} href={`/dashboard/siswa/${row.siswa_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <AvatarSiswa fotoUrl={row.foto_url} nama={row.nama_lengkap} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{row.nama_lengkap}</p>
                    <p className="text-[10px] text-slate-400">Alfa bulan ini: {row.monthly.alfa} • Poin: {row.totalPoin}</p>
                  </div>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </Link>
              ))
            )}
          </div>
        </div>
        </>
        )}

        {view === 'agenda' && (
        <>
        <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
            <div className="p-1.5 rounded-md bg-indigo-50 border border-indigo-100">
              <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Izin Tidak Ikut Pelajaran</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Siswa hadir di sekolah, tetapi izin dari pembelajaran</p>
            </div>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {izinPembelajaranHariIni.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-400">Belum ada siswa yang izin tidak ikut pelajaran hari ini.</div>
            ) : (
              izinPembelajaranHariIni.map((izin: any) => (
                <div key={izin.id} className="flex items-start gap-3 px-4 py-3">
                  <AvatarSiswa fotoUrl={izin.foto_url} nama={izin.nama_lengkap} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{izin.nama_lengkap}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">{izin.alasan}</p>
                    {izin.keterangan ? <p className="mt-0.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">{izin.keterangan}</p> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
            <div className="p-1.5 rounded-md bg-emerald-50 border border-emerald-100">
              <BookOpen className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Agenda Kelas Terbaru</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Materi mengajar terakhir yang tercatat</p>
            </div>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {agendaTerbaru.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-400">Belum ada agenda guru yang masuk untuk kelas ini.</div>
            ) : (
              agendaTerbaru.map((agenda: any, index: number) => (
                <div key={`${agenda.tanggal}-${index}`} className="px-4 py-3">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{agenda.nama_mapel}</p>
                  <p className="text-[10px] text-slate-400 truncate">{agenda.materi || 'Tanpa catatan materi'}</p>
                </div>
              ))
            )}
          </div>
        </div>
        </>
        )}
      </div>
      )}

      {view === 'siswa' && (
      <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
          <div className="p-1.5 rounded-md bg-slate-100 border border-slate-200">
            <Users className="h-3.5 w-3.5 text-slate-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Daftar Siswa Binaan</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">Status harian, komunikasi orang tua, rekap bulan ini, poin, dan aksi tindak lanjut</p>
          </div>
          <Link
            href={viewHref('siswa', { ...(riskFilter !== 'all' ? { risiko: riskFilter } : {}), edit: quickEdit ? '0' : '1' })}
            className={`flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${quickEdit ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50' : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
          >
            {quickEdit ? 'Selesai Edit' : 'EDIT DATA SISWA'}
          </Link>
        </div>

        <div className="px-4 py-2 border-b border-surface-2 flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'Semua' },
            { key: 'high', label: 'Risiko Tinggi' },
            { key: 'pending_comm', label: 'Komunikasi Pending' },
            { key: 'alfa', label: 'Fokus Alfa' },
            { key: 'point', label: 'Fokus Poin' },
          ].map(item => {
            const href = viewHref('siswa', { risiko: item.key })
            const active = riskFilter === item.key
            return (
              <Link
                key={item.key}
                href={href}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                  active
                    ? 'border-amber-300 bg-amber-50 text-amber-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:text-slate-800'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
          <span className="ml-auto text-[10px] text-slate-400 self-center">{filteredStudentRows.length} siswa</span>
        </div>

        <div className="md:hidden p-3 space-y-2">
          {filteredStudentRows.map(row => {
            const detailHref = `/dashboard/siswa/${row.siswa_id}?tab=absensi&returnTo=${returnToKelasBinaan}`
            const statusHariIni = isTodayEffective ? (row.todayStatus?.status_akhir || 'BELUM_ADA_DATA') : 'LIBUR'
            const sumberHariIni = isTodayEffective ? sourceLabel(row.todayStatus?.sumber_status || 'belum_ada_data') : 'Kalender Pendidikan'
            const monthlyItems = [
              { label: 'Sakit', value: row.monthly.sakit },
              { label: 'Izin', value: row.monthly.izin },
              { label: 'Alfa', value: row.monthly.alfa },
              { label: 'Bolos', value: row.monthly.parsial },
            ]
            const monthlyWithValue = monthlyItems.filter(item => item.value > 0)
            return (
              <Card key={row.siswa_id} className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-800">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={detailHref} className="group flex min-w-0 flex-1 items-center gap-3">
                      <AvatarSiswa fotoUrl={row.foto_url} nama={row.nama_lengkap} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <p className="truncate text-sm font-bold text-slate-900 group-hover:text-blue-700 dark:text-slate-100 dark:group-hover:text-blue-400">{row.nama_lengkap}</p>
                          <ArrowRight className="h-3 w-3 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500" />
                        </div>
                        <p className="mt-0.5 text-[11px] font-medium tracking-wide text-slate-400">{row.nisn}</p>
                      </div>
                    </Link>
                    <Badge variant="outline" className={`shrink-0 px-2.5 py-1 text-[10px] ${badgeClass(statusHariIni)}`}>
                      {attendanceStatusLabel(statusHariIni)}
                    </Badge>
                  </div>

                  {sumberHariIni !== 'Kalender Pendidikan' && (
                    <div className="mt-3 border-l-2 border-muted-foreground/20 pl-2.5 text-[10px]">
                      <span className="text-slate-400">Sumber status: </span>
                      <span className="font-semibold text-slate-600 dark:text-slate-300">{sumberHariIni}</span>
                      {row.todayStatus?.keterangan_wali_kelas ? (
                        <p className="mt-0.5 line-clamp-2 text-slate-500 dark:text-slate-400">{row.todayStatus.keterangan_wali_kelas}</p>
                      ) : null}
                    </div>
                  )}

                  <div className="mt-4 grid grid-cols-3 gap-4 border-y py-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Poin</p>
                      <p className="mt-0.5 text-sm font-semibold">{row.totalPoin}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Komunikasi</p>
                      <p className="mt-0.5 truncate text-[11px] font-medium">
                        {row.komunikasi.unread > 0 ? `${row.komunikasi.unread} belum dibaca` : 'Terbaca'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Pemanggilan</p>
                      <p className="mt-0.5 truncate text-[11px] font-medium">{summonStatusLabel(row.komunikasi.summonStatus)}</p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <p className="text-[10px] text-muted-foreground">Bulan Ini</p>
                    {monthlyWithValue.length === 0 ? (
                      <p className="mt-1 text-xs font-medium text-foreground">Tidak ada catatan absensi.</p>
                    ) : (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {monthlyWithValue.map(item => (
                          <Badge key={item.label} variant="secondary" className="gap-1 rounded-md font-normal">
                            {item.label} <span className="font-semibold">{item.value}</span>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {row.timeline ? (
                    <div className="mt-3 border-l-2 border-slate-200 pl-2.5 dark:border-slate-700">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Timeline Terakhir</p>
                      <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-slate-600 dark:text-slate-300">{row.timeline.content}</p>
                    </div>
                  ) : null}

                  {quickEdit ? (
                    <QuickEditSiswa
                      siswaId={row.siswa_id}
                      initialTempatTinggal={row.tempatTinggal}
                      initialPhone={row.phone}
                      className="mt-3"
                    />
                  ) : row.tempatTinggal === 'KELUAR DARI PESANTREN' ? (
                    <p className="mt-3 flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-2 text-[10px] font-semibold text-rose-700">
                      <AlertTriangle className="h-3.5 w-3.5" /> Keluar dari pesantren
                    </p>
                  ) : null}
                </div>

                <div className="border-t p-3">
                  <ParentCommActions
                    siswaId={row.siswa_id}
                    kelasId={kelas.id}
                    namaKelas={namaKelas}
                    namaSiswa={row.nama_lengkap}
                    summonStatus={row.komunikasi.summonStatus}
                    phone={row.phone}
                  />
                </div>
              </Card>
            )
          })}
        </div>

        <div className="hidden md:block">
          <div className="grid grid-cols-[minmax(0,1.8fr)_minmax(140px,1fr)_minmax(170px,1fr)_minmax(160px,1fr)_80px_minmax(220px,1.4fr)] gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/40 border-t border-surface-2 text-[11px] font-semibold text-slate-500">
            <div>Siswa</div>
            <div>Status Hari Ini</div>
            <div>Komunikasi Ortu</div>
            <div>Bulan Ini</div>
            <div>Poin</div>
            <div>Aksi Wali Kelas</div>
          </div>
          <div className="divide-y divide-surface-2">
            {filteredStudentRows.map(row => {
              const detailHref = `/dashboard/siswa/${row.siswa_id}?tab=absensi&returnTo=${returnToKelasBinaan}`
              const statusHariIni = isTodayEffective ? (row.todayStatus?.status_akhir || 'BELUM_ADA_DATA') : 'LIBUR'
              return (
                <div key={row.siswa_id} className="grid grid-cols-[minmax(0,1.8fr)_minmax(140px,1fr)_minmax(170px,1fr)_minmax(160px,1fr)_80px_minmax(220px,1.4fr)] gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <div className="min-w-0 flex items-center gap-2.5">
                    <AvatarSiswa fotoUrl={row.foto_url} nama={row.nama_lengkap} size="sm" />
                    <div className="min-w-0">
                      <Link href={detailHref} className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate block hover:underline">{row.nama_lengkap}</Link>
                      <p className="text-[11px] text-slate-400 truncate">{row.nisn}</p>
                      {row.timeline ? <p className="text-[10px] text-slate-500 truncate mt-0.5">{row.timeline.content}</p> : null}
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${badgeClass(statusHariIni)}`}>
                        {attendanceStatusLabel(statusHariIni)}
                      </span>
                      {row.todayStatus?.keterangan_wali_kelas ? (
                        <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2">{row.todayStatus.keterangan_wali_kelas}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-col justify-center text-[11px] text-slate-500">
                    <span>{row.komunikasi.unread > 0 ? `${row.komunikasi.unread} belum dibaca` : 'Terbaca'}</span>
                    <span className="text-[10px] text-slate-400">Pemanggilan: {summonStatusLabel(row.komunikasi.summonStatus)}</span>
                  </div>
                  <div className="flex items-center text-[11px] text-slate-500">Sakit {row.monthly.sakit} • Izin {row.monthly.izin} • Alfa {row.monthly.alfa} • Bolos {row.monthly.parsial}</div>
                  <div className="flex items-center text-[11px] font-semibold text-slate-700 dark:text-slate-200">{row.totalPoin}</div>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <ParentCommActions
                      siswaId={row.siswa_id}
                      kelasId={kelas.id}
                      namaKelas={namaKelas}
                      namaSiswa={row.nama_lengkap}
                      summonStatus={row.komunikasi.summonStatus}
                      phone={row.phone}
                      compact
                    />
                  </div>
                  {quickEdit ? (
                    <QuickEditSiswa
                      siswaId={row.siswa_id}
                      initialTempatTinggal={row.tempatTinggal}
                      initialPhone={row.phone}
                      className="col-span-full mt-1"
                    />
                  ) : row.tempatTinggal === 'KELUAR DARI PESANTREN' ? (
                    <p className="col-span-full flex items-center gap-1.5 text-[10px] font-semibold text-rose-700 dark:text-rose-400">
                      <AlertTriangle className="h-3.5 w-3.5" /> Keluar dari pesantren
                    </p>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      )}

      {(view === 'home' || view === 'rekap') && show('today_summary') && (!isTodayEffective ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-white p-2 text-slate-500 shadow-sm dark:bg-slate-800">
              <CalendarCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Hari ini tidak efektif pembelajaran</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {todayHolidayReason}. Absensi harian siswa tidak dihitung untuk tanggal ini.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
          {todaySummaryItems.map(item => (
            <div key={item.label} className="rounded-lg border border-surface bg-surface px-3 py-2.5 shadow-sm">
              <div className="flex items-center gap-2">
                <div className={`inline-flex rounded-md p-1.5 ${item.bg}`}>
                  <CalendarCheck className={`h-3.5 w-3.5 ${item.tone}`} />
                </div>
                <p className={`text-xl font-bold leading-none ${item.tone}`}>{item.value}</p>
              </div>
              <p className="mt-1 text-[11px] leading-tight text-slate-500 dark:text-slate-400">{item.label} hari ini</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
