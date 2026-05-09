import Link from 'next/link'
import { getDB } from '@/utils/db'
import { todayWIB } from '@/lib/time'
import { formatNamaKelas } from '@/lib/utils'
import { getFinalAttendanceForClass } from '@/lib/wali-kelas-attendance'
import { WelcomeStrip } from './shared/WelcomeStrip'
import { FeatureShortcuts } from './shared/FeatureShortcuts'
import { JadwalMengajarToday } from './shared/JadwalMengajarToday'
import { KehadiranPribadiCard } from './shared/KehadiranPribadiCard'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  Eye,
  Library,
  NotebookPen,
  ShieldAlert,
  UserCheck,
  Users,
} from 'lucide-react'

type Props = {
  userId: string
  nama: string
  namaDepan: string
  avatarUrl: string | null
  roleLabel: string
  roleColor: string
  sapaan: string
  taAktif: { id?: string; nama: string; semester: number } | null
  kelasIdOverride?: string | null
  showWelcome?: boolean
  showFeatureShortcuts?: boolean
}

function badgeClass(status: string) {
  if (status === 'HADIR') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  if (status === 'SAKIT') return 'bg-amber-100 text-amber-700 border-amber-200'
  if (status === 'IZIN') return 'bg-blue-100 text-blue-700 border-blue-200'
  if (status === 'ALFA') return 'bg-rose-100 text-rose-700 border-rose-200'
  if (status === 'PARSIAL') return 'bg-violet-100 text-violet-700 border-violet-200'
  return 'bg-slate-100 text-slate-600 border-slate-200'
}

function sourceLabel(source: string) {
  if (source === 'wali_kelas') return 'Wali Kelas'
  if (source === 'koreksi_wali_kelas') return 'Koreksi Wali'
  if (source === 'guru') return 'Guru'
  return 'Belum Ada Data'
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
  kelasIdOverride = null,
  showWelcome = true,
  showFeatureShortcuts = true,
}: Props) {
  const db = await getDB()
  const today = todayWIB()
  const start30 = new Date(today + 'T00:00:00')
  start30.setDate(start30.getDate() - 29)
  const start30Str = start30.toISOString().split('T')[0]

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
        {showWelcome && (
          <WelcomeStrip
            nama={nama}
            namaDepan={namaDepan}
            avatarUrl={avatarUrl}
            roleLabel={roleLabel}
            roleColor={roleColor}
            taAktif={taAktif}
            sapaan={sapaan}
          />
        )}
        <div className="rounded-xl border border-surface bg-surface shadow-sm p-8 flex flex-col items-center gap-3 text-center">
          <Library className="h-10 w-10 text-slate-300 dark:text-slate-700" />
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Belum ada kelas yang diasuh</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Hubungi admin untuk penugasan kelas wali.</p>
          </div>
        </div>
        <KehadiranPribadiCard userId={userId} />
      </div>
    )
  }

  const [snapshot30, topPelanggaran, agendaTerbaru, izinPembelajaranHariIni] = await Promise.all([
    getFinalAttendanceForClass(db, kelas.id, start30Str, today),
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
      SELECT COUNT(DISTINCT itk.siswa_id) as total
      FROM izin_tidak_masuk_kelas itk
      JOIN siswa s ON itk.siswa_id = s.id
      WHERE s.kelas_id = ? AND itk.tanggal = ?
    `).bind(kelas.id, today).first<{ total: number }>(),
  ])

  const jumlahSiswa = snapshot30?.siswa.length ?? 0
  const todayRows = snapshot30?.siswa.map(siswa => snapshot30.statusByStudent.get(siswa.id)?.find(row => row.tanggal === today)).filter(Boolean) ?? []

  const todaySummary = {
    hadir: 0,
    sakit: 0,
    izin: 0,
    alfa: 0,
    parsial: 0,
    belumAdaData: 0,
  }

  const studentRows = snapshot30?.siswa.map(siswa => {
    const statuses = snapshot30.statusByStudent.get(siswa.id) || []
    const todayStatus = statuses.find(item => item.tanggal === today) || null
    const monthly = { sakit: 0, izin: 0, alfa: 0, parsial: 0 }
    for (const status of statuses) {
      if (status.status_akhir === 'SAKIT') monthly.sakit++
      else if (status.status_akhir === 'IZIN') monthly.izin++
      else if (status.status_akhir === 'ALFA') monthly.alfa++
      else if (status.status_akhir === 'PARSIAL') monthly.parsial++
    }
    const pelanggaran = topPelanggaran.find(item => item.siswa_id === siswa.id)
    return {
      siswa_id: siswa.id,
      nama_lengkap: siswa.nama_lengkap,
      nisn: siswa.nisn,
      todayStatus,
      monthly,
      totalPoin: pelanggaran?.total_poin ?? 0,
      jumlahKasus: pelanggaran?.jumlah_kasus ?? 0,
    }
  }) || []

  for (const row of todayRows) {
    if (row?.status_akhir === 'SAKIT') todaySummary.sakit++
    else if (row?.status_akhir === 'IZIN') todaySummary.izin++
    else if (row?.status_akhir === 'ALFA') todaySummary.alfa++
    else if (row?.status_akhir === 'PARSIAL') todaySummary.parsial++
    else if (row?.status_akhir === 'BELUM_ADA_DATA') todaySummary.belumAdaData++
    else todaySummary.hadir++
  }

  const summaryByDate = (snapshot30?.dates || []).map(tanggal => {
    const rows = snapshot30?.siswa
      .map(siswa => snapshot30.statusByStudent.get(siswa.id)?.find(item => item.tanggal === tanggal))
      .filter(Boolean) as NonNullable<(typeof todayRows)[number]>[]

    const summary = { tanggal, tidakHadir: 0, perhatian: 0 }
    for (const row of rows) {
      if (['SAKIT', 'IZIN', 'ALFA', 'PARSIAL'].includes(row.status_akhir)) summary.tidakHadir++
      if (row.status_akhir === 'ALFA' || row.sumber_status === 'koreksi_wali_kelas') summary.perhatian++
    }
    return summary
  }).slice(-7)

  const maxTidakHadir = Math.max(1, ...summaryByDate.map(item => item.tidakHadir))
  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

  const tidakMasukHariIni = studentRows
    .filter(row => row.todayStatus && ['SAKIT', 'IZIN', 'ALFA', 'PARSIAL'].includes(row.todayStatus.status_akhir))
    .sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap))

  const perluPerhatian = studentRows
    .filter(row =>
      (row.todayStatus && ['ALFA', 'PARSIAL'].includes(row.todayStatus.status_akhir)) ||
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

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      {showWelcome && (
        <WelcomeStrip
          nama={nama}
          namaDepan={namaDepan}
          avatarUrl={avatarUrl}
          roleLabel={roleLabel}
          roleColor={roleColor}
          taAktif={taAktif}
          sapaan={sapaan}
        />
      )}

      <KehadiranPribadiCard userId={userId} />
      <JadwalMengajarToday userId={userId} taAktif={taAktif} />

      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 via-amber-50/70 to-white dark:from-amber-900/20 dark:to-transparent shadow-sm px-5 py-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-4 flex-1">
            <div className="h-14 w-14 shrink-0 rounded-xl bg-amber-500 flex items-center justify-center shadow-sm">
              <Library className="h-7 w-7 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-widest">Kelas Binaan</p>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-100">Kelas {namaKelas}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                <Users className="h-3 w-3" /> {jumlahSiswa} siswa aktif
                {kelas.wali_kelas_nama && <span>• Wali: {kelas.wali_kelas_nama}</span>}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/kelas-binaan" className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50">
              <Eye className="h-3.5 w-3.5" /> Halaman Penuh
            </Link>
            <Link href="/dashboard/keterangan-absensi" className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">
              <NotebookPen className="h-3.5 w-3.5" /> Koreksi Wali
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Hadir', value: todaySummary.hadir, tone: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Sakit', value: todaySummary.sakit, tone: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Izin', value: todaySummary.izin, tone: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Alfa', value: todaySummary.alfa, tone: 'text-rose-600', bg: 'bg-rose-50' },
          { label: 'Parsial', value: todaySummary.parsial, tone: 'text-violet-600', bg: 'bg-violet-50' },
        ].map(item => (
          <div key={item.label} className="rounded-xl border border-surface bg-surface shadow-sm p-4">
            <div className={`inline-flex rounded-lg p-2 ${item.bg}`}>
              <CalendarCheck className={`h-4 w-4 ${item.tone}`} />
            </div>
            <p className={`mt-3 text-2xl font-bold leading-none ${item.tone}`}>{item.value}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.label} hari ini</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
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
          <div className="p-4">
            <p className="text-2xl font-bold text-indigo-600">{izinPembelajaranHariIni?.total ?? 0}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Siswa tercatat hari ini</p>
            <Link href="/dashboard/izin" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
              Buka modul izin <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
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
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{row.nama_lengkap}</p>
                    <p className="text-[10px] text-slate-400">{sourceLabel(row.todayStatus?.sumber_status || 'belum_ada_data')}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeClass(row.todayStatus?.status_akhir || 'BELUM_ADA_DATA')}`}>
                    {row.todayStatus?.status_akhir === 'PARSIAL' ? 'Parsial' : row.todayStatus?.status_akhir}
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
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Alfa berulang, parsial, atau poin tinggi</p>
            </div>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {perluPerhatian.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-400">Belum ada siswa yang perlu perhatian khusus.</div>
            ) : (
              perluPerhatian.map(row => (
                <Link key={row.siswa_id} href={`/dashboard/siswa/${row.siswa_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{row.nama_lengkap}</p>
                    <p className="text-[10px] text-slate-400">Alfa 30 hari: {row.monthly.alfa} • Poin: {row.totalPoin}</p>
                  </div>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </Link>
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
      </div>

      <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
          <div className="p-1.5 rounded-md bg-slate-100 border border-slate-200">
            <Users className="h-3.5 w-3.5 text-slate-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Daftar Siswa Binaan</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">Status harian akhir, sumber data, rekap 30 hari, dan poin kedisiplinan</p>
          </div>
          <Link href="/dashboard/siswa" className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1">
            Data siswa <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="md:hidden p-3 space-y-2">
          {studentRows.map(row => {
            const detailHref = `/dashboard/siswa/${row.siswa_id}?tab=absensi&returnTo=${encodeURIComponent(kelasIdOverride ? `/dashboard/kelas-binaan?kelas=${kelas.id}` : '/dashboard/kelas-binaan')}`
            return (
              <Link key={row.siswa_id} href={detailHref} className="block rounded-xl border border-surface-2 bg-slate-50/80 dark:bg-slate-800/40 p-3 active:scale-[0.99] transition-transform">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{row.nama_lengkap}</p>
                    <p className="text-[11px] text-slate-400 truncate">{row.nisn}</p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${badgeClass(row.todayStatus?.status_akhir || 'BELUM_ADA_DATA')}`}>
                    {row.todayStatus?.status_akhir === 'BELUM_ADA_DATA' ? 'Belum Ada Data' : row.todayStatus?.status_akhir || 'Belum Ada Data'}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                  <div>
                    <p className="text-slate-400">Sumber</p>
                    <p className="font-medium text-slate-600 dark:text-slate-300">{sourceLabel(row.todayStatus?.sumber_status || 'belum_ada_data')}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Poin</p>
                    <p className="font-semibold text-slate-700 dark:text-slate-200">{row.totalPoin}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-slate-400">30 Hari</p>
                    <p className="font-medium text-slate-600 dark:text-slate-300">S {row.monthly.sakit} • I {row.monthly.izin} • A {row.monthly.alfa} • P {row.monthly.parsial}</p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        <div className="hidden md:block">
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(140px,1.2fr)_minmax(120px,1fr)_minmax(160px,1.2fr)_80px] gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/40 border-t border-surface-2 text-[11px] font-semibold text-slate-500">
            <div>Siswa</div>
            <div>Status Hari Ini</div>
            <div>Sumber</div>
            <div>30 Hari</div>
            <div>Poin</div>
          </div>
          <div className="divide-y divide-surface-2">
            {studentRows.map(row => {
              const detailHref = `/dashboard/siswa/${row.siswa_id}?tab=absensi&returnTo=${encodeURIComponent(kelasIdOverride ? `/dashboard/kelas-binaan?kelas=${kelas.id}` : '/dashboard/kelas-binaan')}`
              return (
                <Link key={row.siswa_id} href={detailHref} className="grid grid-cols-[minmax(0,2fr)_minmax(140px,1.2fr)_minmax(120px,1fr)_minmax(160px,1.2fr)_80px] gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{row.nama_lengkap}</p>
                    <p className="text-[11px] text-slate-400 truncate">{row.nisn}</p>
                  </div>
                  <div className="flex items-center">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${badgeClass(row.todayStatus?.status_akhir || 'BELUM_ADA_DATA')}`}>
                      {row.todayStatus?.status_akhir === 'BELUM_ADA_DATA' ? 'Belum Ada Data' : row.todayStatus?.status_akhir || 'Belum Ada Data'}
                    </span>
                  </div>
                  <div className="flex items-center text-[11px] text-slate-500">{sourceLabel(row.todayStatus?.sumber_status || 'belum_ada_data')}</div>
                  <div className="flex items-center text-[11px] text-slate-500">S {row.monthly.sakit} • I {row.monthly.izin} • A {row.monthly.alfa} • P {row.monthly.parsial}</div>
                  <div className="flex items-center text-[11px] font-semibold text-slate-700 dark:text-slate-200">{row.totalPoin}</div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {showFeatureShortcuts && <FeatureShortcuts userId={userId} />}
    </div>
  )
}
