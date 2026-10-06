import Link from 'next/link'
import { getDB } from '@/utils/db-server'
import { todayWIB } from '@/lib/time'
import { formatNamaKelas } from '@/lib/utils'
import { isDailyNonAttendance, summarizeKelasBinaanAttendance } from '@/lib/kelas-binaan-attendance'
import { getFinalAttendanceForClass } from '@/lib/wali-kelas-attendance'
import { getKalenderDateStatus } from '@/lib/kalender-pendidikan'
import { ParentCommActions } from './ParentCommActions'
import { KeputusanAbsensiHariIni, type KeputusanAbsensiRow } from './KeputusanAbsensiHariIni'
import { KelasBinaanRekapView } from './KelasBinaanRekapView'
import { AvatarSiswa } from '@/components/ui/avatar-siswa'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { JadwalMengajarToday } from './shared/JadwalMengajarToday'
import { KehadiranPribadiCard } from './shared/KehadiranPribadiCard'
import { PenugasanMasukCard } from './shared/PenugasanMasukCard'
import { QuickEditSiswa } from '@/app/dashboard/kelas-binaan/components/quick-edit-siswa'
import { KelasBinaanCatatanSiswaView } from '@/app/dashboard/kelas-binaan/components/catatan-siswa-view'
import { getStudentNotes, getUnreadStudentNoteCountForWali } from '@/lib/student-notes'
import { studentNoteCollator, type StudentNoteStudent } from '@/lib/student-note-shared'
import { ensureSchemaOnce } from '@/lib/schema-guard'
import {
  attendanceSourceLabel as sharedSourceLabel,
  attendanceStatusLabel as sharedAttendanceStatusLabel,
} from '@/lib/attendance-status'
import {
  Warning as AlertTriangle,
  ArrowRight,
  Calendar as CalendarCheck,
  Clipboard as ClipboardList,
  Books as Library,
  Notebook as NotebookPen,
  ShieldWarning as ShieldAlert,
  SquaresFour as LayoutDashboard,
  UserCheck,
  Users,
} from '@phosphor-icons/react/dist/ssr'

type Props = {
  userId: string
  unreadNotifications?: number
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
  decisionDate?: string | null
  showWelcome?: boolean
  showTopCards?: boolean
  showFeatureShortcuts?: boolean
  dashboardVisibility?: Record<string, boolean>
  quickEdit?: boolean
  noteStudentId?: string | null
}

export type KelasBinaanView = 'home' | 'keputusan' | 'siswa' | 'rekap' | 'perhatian' | 'catatan'

function badgeClass(status: string) {
  if (status === 'LIBUR') return 'bg-slate-100 text-slate-600 border-slate-200'
  if (status === 'HADIR') return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
  if (status === 'SAKIT') return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
  if (status === 'IZIN') return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
  if (status === 'ALFA') return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
  if (status === 'PARSIAL') return 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800'
  if (status === 'PERLU_KONFIRMASI_WALI') return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
  return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
}

function attendanceStatusLabel(status: string | null | undefined) {
  if (status === 'LIBUR') return 'Libur'
  return sharedAttendanceStatusLabel(status)
}

function sourceLabel(source: string) {
  if (source === 'kalender') return 'Kalender Pendidikan'
  if (source === 'perizinan') return 'Perizinan'
  return sharedSourceLabel(source)
}

function summonStatusLabel(status: string | null) {
  if (!status) return 'Belum ada'
  if (status === 'terkirim') return 'Terkirim'
  if (status === 'dikonfirmasi') return 'Dikonfirmasi'
  if (status === 'reschedule_diminta') return 'Minta jadwal ulang'
  if (status === 'selesai') return 'Selesai'
  return status
}

function isValidDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1) return false
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return day <= daysInMonth
}

function quickEditDomisiliLabel(tempatTinggal: string | null | undefined, desaKelurahan: string | null | undefined) {
  const raw = String(tempatTinggal || '').trim()
  if (!raw) return null
  if (raw === 'KELUAR DARI PESANTREN') return 'KELUAR DARI PESANTREN'
  if (raw === 'Pondok Pesantren') return 'PP Miftahul Huda III'
  if (raw === 'Rumah Orang Tua') {
    const desa = String(desaKelurahan || '').trim()
    return desa ? `Non-Asrama (${desa})` : 'Non-Asrama'
  }
  return raw
}

function resolveDecisionDate(value: string | null | undefined, today: string, minDate: string) {
  if (!value || !isValidDateOnly(value) || value > today) return today
  return value < minDate ? minDate : value
}

function resolveSemesterStartDate(
  ta: { nama: string; semester: number } | null,
  today: string,
  fallback: string,
) {
  const match = String(ta?.nama || '').match(/(\d{4})\D+(\d{4})/)
  if (!match) return fallback

  const firstYear = Number(match[1])
  const secondYear = Number(match[2])
  const startDate = Number(ta?.semester) === 1
    ? `${firstYear}-07-01`
    : `${secondYear}-01-01`

  return startDate <= today ? startDate : fallback
}

export async function KelasBinaanDashboard({
  unreadNotifications = 0,
  userId,
  taAktif,
  isGuruPiket = false,
  kelasIdOverride = null,
  riskFilter = 'all',
  view = 'home',
  decisionDate = null,
  showWelcome = true,
  showTopCards = true,
  dashboardVisibility = {},
  quickEdit = false,
  noteStudentId = null,
}: Props) {
  const show = (section: string) => dashboardVisibility[section] !== false
  const db = await getDB()
  const today = todayWIB()
  const startOfMonthStr = `${today.slice(0, 7)}-01`
  const semesterStartDate = resolveSemesterStartDate(taAktif, today, startOfMonthStr)
  const selectedDecisionDate = resolveDecisionDate(decisionDate, today, semesterStartDate)

  const kelas = kelasIdOverride
    ? await db.prepare(`
        SELECT k.id, k.tingkat, k.nomor_kelas, k.kelompok, k.wali_kelas_id, u.nama_lengkap as wali_kelas_nama
        FROM kelas k
        LEFT JOIN "user" u ON k.wali_kelas_id = u.id
        WHERE k.id = ?
        LIMIT 1
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
      <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
        Anda tidak terdaftar sebagai wali kelas aktif, atau kelas binaan tidak ditemukan.
      </div>
    )
  }

  await ensureSchemaOnce('kelas_binaan:parent_comm_v1', async () => {
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
  })

  const attendanceSnapshotPromise = getFinalAttendanceForClass(
    db,
    kelas.id,
    semesterStartDate,
    today,
    { tahunAjaranId: taAktif?.id },
  )

  // Efisiensi: query agendaTerbaru dan izinPembelajaranHariIni dihapus sesuai permintaan
  const [
    todayCalendarStatus,
    decisionCalendarStatus,
    attendanceSnapshot,
    topPelanggaran,
    komunikasiStatusRaw,
    komunikasiTimelineRaw,
  ] = await Promise.all([
    getKalenderDateStatus(db, today),
    getKalenderDateStatus(db, selectedDecisionDate),
    attendanceSnapshotPromise,
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
      SELECT s.id AS siswa_id,
             (
               SELECT COUNT(*)
               FROM parent_notifications pn
               WHERE pn.siswa_id = s.id AND pn.is_read = 0
             ) AS unread_count,
             (
               SELECT ps.status
               FROM parent_summons ps
               WHERE ps.siswa_id = s.id
               ORDER BY ps.created_at DESC
               LIMIT 1
             ) AS summon_status
      FROM siswa s
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

  const jumlahSiswa = attendanceSnapshot?.siswa.length ?? 0
  const isTodayEffective = todayCalendarStatus.isEffective
  const todayRows = attendanceSnapshot?.siswa.map(siswa => attendanceSnapshot.statusByStudent.get(siswa.id)?.find(row => row.tanggal === today)).filter(Boolean) ?? []
  const isDecisionDateEffective = decisionCalendarStatus.isEffective
  const decisionHolidayReason = decisionCalendarStatus.reason || 'Tidak efektif pembelajaran'
  
  // Format baris keputusan dengan foto siswa
  const decisionRows = attendanceSnapshot?.siswa
    .map(siswa => {
      const row = attendanceSnapshot.statusByStudent.get(siswa.id)?.find(r => r.tanggal === selectedDecisionDate)
      if (!row) return null
      return {
        ...row,
        foto_url: siswa.foto_url ?? null,
      }
    })
    .filter(Boolean) ?? []

  const todaySummary = summarizeKelasBinaanAttendance(todayRows)

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

  const studentRows = attendanceSnapshot?.siswa.map(siswa => {
    const statuses = attendanceSnapshot.statusByStudent.get(siswa.id) || []
    const todayStatus = statuses.find(item => item.tanggal === today) || null
    const monthly = { sakit: 0, izin: 0, alfa: 0 }
    for (const status of statuses) {
      if (status.tanggal < startOfMonthStr || status.tanggal > today || !status.is_daily_final) continue
      if (status.status_akhir === 'SAKIT') monthly.sakit++
      else if (status.status_akhir === 'IZIN') monthly.izin++
      else if (status.status_akhir === 'ALFA') monthly.alfa++
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

  const noteStudents: StudentNoteStudent[] = studentRows.map(row => ({
    id: row.siswa_id,
    nama_lengkap: row.nama_lengkap,
    nisn: row.nisn || null,
    foto_url: row.foto_url || null,
    kelas_id: kelas.id,
  })).sort((a, b) => studentNoteCollator.compare(a.nama_lengkap, b.nama_lengkap))
  const selectedNoteStudent = noteStudents.find(student => student.id === noteStudentId) || noteStudents[0] || null
  const [studentNotes, unreadStudentNotes] = await Promise.all([
    selectedNoteStudent ? getStudentNotes(db, userId, selectedNoteStudent.id) : Promise.resolve([]),
    getUnreadStudentNoteCountForWali(db, userId, kelas.id).catch(() => 0),
  ])

  const filteredStudentRows = studentRows.filter(row => {
    if (riskFilter === 'all') return true
    if (riskFilter === 'high') return row.monthly.alfa >= 2 || row.totalPoin >= 25 || row.komunikasi.summonStatus === 'terkirim' || row.tempatTinggal === 'KELUAR DARI PESANTREN'
    if (riskFilter === 'pending_comm') return row.komunikasi.unread > 0 || row.komunikasi.summonStatus === 'terkirim' || row.komunikasi.summonStatus === 'reschedule_diminta'
    if (riskFilter === 'alfa') return row.monthly.alfa >= 1 || (row.todayStatus?.is_daily_final && row.todayStatus.status_akhir === 'ALFA')
    if (riskFilter === 'point') return row.totalPoin >= 25
    return true
  })

  const tidakMasukHariIni = studentRows
    .filter(row => isTodayEffective && row.todayStatus && isDailyNonAttendance(row.todayStatus))
    .sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap))

  const perluPerhatian = studentRows
    .filter(row =>
      (isTodayEffective && row.todayStatus && row.todayStatus.is_daily_final && row.todayStatus.status_akhir === 'ALFA') ||
      row.monthly.alfa >= 2 ||
      row.totalPoin >= 25 ||
      row.komunikasi.summonStatus === 'terkirim' ||
      row.komunikasi.summonStatus === 'reschedule_diminta' ||
      row.tempatTinggal === 'KELUAR DARI PESANTREN'
    )
    .sort((a, b) => (
      b.monthly.alfa - a.monthly.alfa ||
      b.totalPoin - a.totalPoin ||
      a.nama_lengkap.localeCompare(b.nama_lengkap)
    ))

  const namaKelas = formatNamaKelas(kelas.tingkat, kelas.nomor_kelas, kelas.kelompok)
  const keputusanAbsensiRows = decisionRows as KeputusanAbsensiRow[]
  const baseParams = new URLSearchParams()
  if (kelasIdOverride) baseParams.set('kelas', kelas.id)
  if (decisionDate) baseParams.set('tanggal', selectedDecisionDate)
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

  // Data serialisasi untuk Rekap Absensi in-place
  const rekapStatusesByStudent: Record<string, any[]> = {}
  if (attendanceSnapshot?.statusByStudent) {
    for (const [siswaId, list] of attendanceSnapshot.statusByStudent.entries()) {
      rekapStatusesByStudent[siswaId] = list
    }
  }

  const rekapSiswaList = (attendanceSnapshot?.siswa || []).map(s => ({
    id: s.id,
    nama_lengkap: s.nama_lengkap,
    nisn: s.nisn,
    foto_url: s.foto_url ?? null,
  }))

  const menuItems: Array<{ view: KelasBinaanView; title: string; desc: string; count: number | string; icon: any; tone: string }> = [
    { view: 'keputusan', title: 'Kehadiran Harian', desc: 'Pantau kehadiran dan koreksi jika diperlukan', count: jumlahSiswa, icon: ClipboardList, tone: 'text-purple-600 bg-purple-50 border-purple-100' },
    { view: 'rekap', title: 'Rekap Absensi', desc: 'Rekap harian per blok, bulanan, dan rentang tanggal', count: jumlahSiswa, icon: CalendarCheck, tone: 'text-blue-600 bg-blue-50 border-blue-100' },
    { view: 'siswa', title: 'Daftar Siswa', desc: 'Data siswa, notifikasi ortu, dan tindak lanjut', count: jumlahSiswa, icon: Users, tone: 'text-slate-600 bg-slate-50 border-slate-200' },
    { view: 'perhatian', title: 'Perlu Perhatian', desc: 'Siswa alfa berulang, poin tinggi, atau panggilan pending', count: perluPerhatian.length, icon: ShieldAlert, tone: 'text-amber-600 bg-amber-50 border-amber-100' },
    { view: 'catatan', title: 'Catatan Siswa', desc: 'Riwayat catatan dari guru pengajar', count: unreadStudentNotes, icon: NotebookPen, tone: 'text-cyan-600 bg-cyan-50 border-cyan-100' },
  ]

  const totalAbsenHariIni = todaySummary.alfa + todaySummary.sakit + todaySummary.izin

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

      {/* Banner Utama Kelas Binaan */}
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
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:shrink-0">
            <Link href="/dashboard/keterangan-absensi" className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50">
              <NotebookPen className="h-3.5 w-3.5 shrink-0" /><span>Riwayat & Koreksi</span>
            </Link>
            <Link href="/dashboard/kelas-binaan/notifikasi" className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-50">
              <span>Notifikasi Masuk</span>{unreadNotifications > 0 && <span aria-label={`${unreadNotifications} belum dibaca`} className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5">{unreadNotifications}</span>}
            </Link>
          </div>
        </div>
      </div>

      {/* Tab Navigasi Kelas Binaan (Responsif & Mobile First) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {[
          { view: 'home' as const, label: 'Ringkasan', icon: LayoutDashboard },
          {
            view: 'keputusan' as const,
            label: 'Kehadiran Harian',
            icon: ClipboardList,
            badge: totalAbsenHariIni > 0 ? `${totalAbsenHariIni} absen` : undefined,
          },
          { view: 'rekap' as const, label: 'Rekap Absensi', icon: CalendarCheck },
          { view: 'siswa' as const, label: 'Daftar Siswa', icon: Users, count: jumlahSiswa },
          {
            view: 'perhatian' as const,
            label: 'Perlu Perhatian',
            icon: ShieldAlert,
            count: perluPerhatian.length > 0 ? perluPerhatian.length : undefined,
            alert: perluPerhatian.length > 0,
          },
          {
            view: 'catatan' as const,
            label: 'Catatan Siswa',
            icon: NotebookPen,
            count: unreadStudentNotes > 0 ? unreadStudentNotes : undefined,
            alert: unreadStudentNotes > 0,
          },
        ].map(tab => {
          const Icon = tab.icon
          const isActive = view === tab.view
          return (
            <Link
              key={tab.view}
              href={viewHref(tab.view)}
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-all shrink-0 ${
                isActive
                  ? 'border border-amber-300 bg-amber-50 text-amber-900 shadow-xs dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 font-bold'
                  : 'border border-surface bg-surface text-slate-600 hover:border-amber-200 hover:bg-amber-50/40 dark:text-slate-400 dark:hover:bg-slate-800/40'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="rounded-full bg-rose-100 px-1.5 py-0.2 text-[10px] font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                  {tab.badge}
                </span>
              )}
              {tab.count !== undefined && (
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  tab.alert
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      {/* ===================== VIEW: HOME (RINGKASAN MENU) ===================== */}
      {view === 'home' && (
        <>
          {show('menu_navigasi') && (
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
              {menuItems.map(item => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.view}
                    href={viewHref(item.view)}
                    className="group rounded-xl border border-surface bg-surface p-3.5 shadow-sm transition-all hover:border-amber-200 hover:bg-amber-50/40"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`rounded-lg border p-2.5 ${item.tone}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{item.title}</p>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-amber-500" />
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-500 dark:text-slate-400">{item.desc}</p>
                        <p className="mt-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                          {item.count} {item.view === 'keputusan' || item.view === 'siswa' || item.view === 'rekap' ? 'siswa' : 'item'}
                        </p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ===================== VIEW: KEHADIRAN HARIAN ===================== */}
      {view === 'keputusan' && (
        <KeputusanAbsensiHariIni
          userId={userId}
          kelasId={kelas.id}
          tanggal={selectedDecisionDate}
          today={today}
          minDate={semesterStartDate}
          rows={keputusanAbsensiRows}
          isEffective={isDecisionDateEffective}
          holidayReason={decisionHolidayReason}
        />
      )}

      {/* ===================== VIEW: REKAP ABSENSI LENGKAP (IN-PLACE) ===================== */}
      {view === 'rekap' && (
        <KelasBinaanRekapView
          kelasId={kelas.id}
          namaKelas={namaKelas}
          today={today}
          semesterStartDate={semesterStartDate}
          siswa={rekapSiswaList}
          dates={attendanceSnapshot?.dates || []}
          statusesByStudent={rekapStatusesByStudent}
        />
      )}

      {/* ===================== VIEW: CATATAN SISWA ===================== */}
      {view === 'catatan' && (
        <KelasBinaanCatatanSiswaView
          kelasId={kelas.id}
          students={noteStudents}
          selectedStudent={selectedNoteStudent}
          notes={studentNotes}
          markAsRead={kelas.wali_kelas_id === userId}
        />
      )}

      {/* ===================== VIEW: PERLU PERHATIAN (BERSIH DARI DUPLIKASI) ===================== */}
      {view === 'perhatian' && (
        <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-surface-2 bg-amber-50/30 dark:bg-amber-950/10">
            <div className="p-2 rounded-lg bg-amber-100 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800">
              <ShieldAlert className="h-4 w-4 text-amber-700 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Siswa Perlu Perhatian Khusus</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Fokus pembinaan siswa: Alfa berulang (≥2x), akumulasi poin pelanggaran (≥25), atau panggilan wali santri
              </p>
            </div>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              {perluPerhatian.length} siswa
            </span>
          </div>

          <div className="divide-y divide-surface-2">
            {perluPerhatian.length === 0 ? (
              <div className="px-4 py-12 text-center text-xs text-slate-400">
                Alhamdulillah, saat ini tidak ada siswa binaan yang membutuhkan perhatian khusus.
              </div>
            ) : (
              perluPerhatian.map(row => (
                <div key={row.siswa_id} className="p-3.5 sm:p-4 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <AvatarSiswa fotoUrl={row.foto_url} nama={row.nama_lengkap} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link
                            href={`/dashboard/siswa/${row.siswa_id}?tab=absensi&returnTo=${returnToKelasBinaan}`}
                            className="text-sm font-bold text-slate-800 hover:text-blue-700 dark:text-slate-100 dark:hover:text-blue-400 truncate"
                          >
                            {row.nama_lengkap}
                          </Link>
                          <span className="text-[11px] text-slate-400">({row.nisn})</span>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                          {row.monthly.alfa > 0 && (
                            <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700 font-semibold text-[10px]">
                              {row.monthly.alfa}x Alfa Bulan Ini
                            </Badge>
                          )}
                          {row.totalPoin > 0 && (
                            <Badge variant="outline" className={`font-semibold text-[10px] ${row.totalPoin >= 25 ? 'border-rose-300 bg-rose-100 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                              {row.totalPoin} Poin Pelanggaran ({row.jumlahKasus} kasus)
                            </Badge>
                          )}
                          {row.komunikasi.summonStatus && (
                            <Badge variant="secondary" className="text-[10px]">
                              Panggilan: {summonStatusLabel(row.komunikasi.summonStatus)}
                            </Badge>
                          )}
                          {row.tempatTinggal === 'KELUAR DARI PESANTREN' && (
                            <Badge variant="destructive" className="text-[10px]">
                              Keluar Dari Pesantren
                            </Badge>
                          )}
                        </div>

                        {row.timeline && (
                          <p className="mt-1.5 text-[11px] text-slate-500 line-clamp-1 italic">
                            Timeline: &ldquo;{row.timeline.content}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
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
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ===================== VIEW: DAFTAR SISWA (NOTIFIKASI) ===================== */}
      {view === 'siswa' && (
        <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
            <div className="p-1.5 rounded-md bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
              <Users className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Daftar Siswa Binaan</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                Status harian, notifikasi orang tua, rekap bulan ini, poin, dan aksi tindak lanjut
              </p>
            </div>
            <Link
              href={viewHref('siswa', { ...(riskFilter !== 'all' ? { risiko: riskFilter } : {}), edit: quickEdit ? '0' : '1' })}
              className={`flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                quickEdit
                  ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
            >
              {quickEdit ? 'Selesai Edit' : 'EDIT DATA SISWA'}
            </Link>
          </div>

          <div className="px-4 py-2 border-b border-surface-2 flex flex-wrap gap-2">
            {[
              { key: 'all', label: 'Semua' },
              { key: 'high', label: 'Risiko Tinggi' },
              { key: 'pending_comm', label: 'Notifikasi Pending' },
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

          {/* Versi Mobile Card */}
          <div className="lg:hidden p-3 space-y-2">
            {filteredStudentRows.map(row => {
              const detailHref = `/dashboard/siswa/${row.siswa_id}?tab=absensi&returnTo=${returnToKelasBinaan}`
              const statusHariIni = isTodayEffective ? (row.todayStatus?.status_akhir || 'BELUM_ADA_DATA') : 'LIBUR'
              const sumberHariIni = isTodayEffective ? sourceLabel(row.todayStatus?.sumber_status || 'belum_ada_data') : 'Kalender Pendidikan'
              const monthlyItems = [
                { label: 'Sakit', value: row.monthly.sakit },
                { label: 'Izin', value: row.monthly.izin },
                { label: 'Alfa', value: row.monthly.alfa },
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
                            <p className="min-w-0 flex-1 break-words text-sm font-bold leading-snug text-slate-900 group-hover:text-blue-700 dark:text-slate-100 dark:group-hover:text-blue-400">{row.nama_lengkap}</p>
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
                        <p className="text-[10px] text-muted-foreground">Notifikasi</p>
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

          {/* Versi Desktop Tabel */}
          <div className="hidden lg:block">
            <div className="grid grid-cols-[minmax(0,1.8fr)_minmax(140px,1fr)_minmax(170px,1fr)_minmax(160px,1fr)_80px_minmax(220px,1.4fr)] gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/40 border-t border-surface-2 text-[11px] font-semibold text-slate-500">
              <div>Siswa</div>
              <div>Status Hari Ini</div>
              <div>Notifikasi Ortu</div>
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
                    <div className="flex items-center text-[11px] text-slate-500">Sakit {row.monthly.sakit} • Izin {row.monthly.izin} • Alfa {row.monthly.alfa}</div>
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
    </div>
  )
}
