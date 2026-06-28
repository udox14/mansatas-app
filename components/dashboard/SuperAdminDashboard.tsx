import Link from 'next/link'
import { getDB } from '@/utils/db'
import { todayWIB } from '@/lib/time'
import { getSuperAdminDashboardStats } from '@/utils/cache'
import { StatCard } from './shared/StatCard'
import { JadwalMengajarToday } from './shared/JadwalMengajarToday'
import { KehadiranPribadiCard } from './shared/KehadiranPribadiCard'
import { PenugasanMasukCard } from './shared/PenugasanMasukCard'
import { BreakdownSiswaModal } from './shared/BreakdownSiswaModal'
import { ChartCard } from './charts/ChartCard'
import { AktivitasSeverityChart } from './charts/AktivitasSeverityChart'
import { GenderDonut, AngkatanBar, DomisiliBar } from './charts/DemografiCharts'
import { PelanggaranTrend, TopPelanggaranBar, PresensiDonut } from './charts/KedisiplinanCharts'
import {
  BookOpen,
  PaperPlaneTilt as Send,
  Users,
  UserGear as UserCog,
  Pulse,
  GraduationCap,
  House,
  TrendDown as TrendingDown,
  ListChecks,
  UserCheck,
  ShieldWarning,
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
  userRoles?: string[]
  primaryRole?: string
  dashboardVisibility?: Record<string, boolean>
}

type AgendaStats = {
  total: number
  filled: number
  percent: number
}

function pct(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0
}

const SEVERITY_STYLE: Record<string, { dot: string; label: string }> = {
  danger: { dot: 'bg-rose-500', label: 'Bahaya' },
  warning: { dot: 'bg-amber-500', label: 'Peringatan' },
}

function formatWaktuLog(iso: string) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  })
}

async function getAgendaStats(db: D1Database, today: string, taId?: string): Promise<AgendaStats> {
  if (!taId) return { total: 0, filled: 0, percent: 0 }

  const d = new Date(today + 'T00:00:00')
  const hariIni = d.getDay() === 0 ? 7 : d.getDay()

  const row = await db.prepare(`
    SELECT
      COUNT(DISTINCT jm.penugasan_id) as total,
      COUNT(DISTINCT CASE WHEN ag.id IS NOT NULL THEN jm.penugasan_id END) as filled
    FROM jadwal_mengajar jm
    JOIN penugasan_mengajar pm ON jm.penugasan_id = pm.id
    JOIN kelas k ON pm.kelas_id = k.id
    LEFT JOIN agenda_guru ag ON ag.penugasan_id = jm.penugasan_id AND ag.tanggal = ?
    WHERE jm.tahun_ajaran_id = ?
      AND jm.hari = ?
      AND (k.kbm_nonaktif_mulai IS NULL OR k.kbm_nonaktif_mulai > ?)
  `).bind(today, taId, hariIni, today).first<{ total: number; filled: number }>()

  const total = row?.total ?? 0
  const filled = row?.filled ?? 0
  return { total, filled, percent: pct(filled, total) }
}

export async function SuperAdminDashboard({
  userId,
  taAktif,
  isGuruPiket,
  dashboardVisibility,
}: Props) {
  const show = (id: string) => dashboardVisibility?.[id] !== false
  const db = await getDB()
  const today = todayWIB()

  const [
    counts,
    penugasan,
    agenda,
    breakdownAngkatan,
    breakdownKelas,
    stats,
  ] = await Promise.all([
    db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM siswa WHERE status = 'aktif') as siswa,
        (SELECT COUNT(*) FROM "user" WHERE nama_lengkap IS NOT NULL) as guru
    `).first<{ siswa: number; guru: number }>(),

    db.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'SELESAI' THEN 1 END) as selesai
      FROM delegasi_tugas WHERE tanggal = ?
    `).bind(today).first<{ total: number; selesai: number }>(),

    getAgendaStats(db, today, taAktif?.id),

    db.prepare(`
      SELECT tahun_masuk as angkatan, COUNT(*) as count 
      FROM siswa 
      WHERE status = 'aktif' AND tahun_masuk IS NOT NULL 
      GROUP BY tahun_masuk 
      ORDER BY tahun_masuk DESC
    `).all<{ angkatan: number; count: number }>(),

    taAktif ? db.prepare(`
      SELECT 
        (k.tingkat || '-' || k.nomor_kelas || COALESCE(' ' || k.kelompok, '')) as kelas, 
        COUNT(s.id) as count 
      FROM siswa s
      JOIN riwayat_kelas rk ON s.id = rk.siswa_id
      JOIN kelas k ON rk.kelas_id = k.id
      WHERE s.status = 'aktif' AND rk.tahun_ajaran_id = ?
      GROUP BY k.id
      ORDER BY k.tingkat ASC, k.nomor_kelas ASC, k.kelompok ASC
    `).bind(taAktif.id).all<{ kelas: string; count: number }>() : Promise.resolve({ results: [] }),

    getSuperAdminDashboardStats(),
  ])

  const totalSiswa = counts?.siswa ?? 0
  const totalGuru = counts?.guru ?? 0
  const totalDelegasi = penugasan?.total ?? 0
  const selesaiDelegasi = penugasan?.selesai ?? 0

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-16">
      {show('kehadiran_pribadi') && <KehadiranPribadiCard userId={userId} />}

      {isGuruPiket && <PenugasanMasukCard userId={userId} />}

      {show('jadwal_mengajar') && <JadwalMengajarToday userId={userId} taAktif={taAktif} />}

      {show('statistik') && (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Siswa Aktif Modal Trigger */}
        <BreakdownSiswaModal 
          total={totalSiswa} 
          angkatan={breakdownAngkatan.results ?? []} 
          kelas={breakdownKelas.results ?? []}
        >
          <div className="group flex items-center gap-3 rounded-2xl bg-white dark:bg-slate-800 p-3 sm:p-4 shadow-sm border border-slate-100 dark:border-slate-700/50 hover:shadow-md transition-all active:scale-[0.98]">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shrink-0">
              <Users className="h-6 w-6" weight="duotone" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5 truncate">Siswa Aktif</p>
              <div className="flex items-end gap-2">
                <p className="text-xl sm:text-2xl font-extrabold text-slate-800 dark:text-slate-50 tracking-tight leading-none tabular-nums">{totalSiswa}</p>
                <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate mb-0.5">Lihat rincian</p>
              </div>
            </div>
          </div>
        </BreakdownSiswaModal>

        <StatCard
          title="Guru & Pegawai"
          value={totalGuru}
          sub="terdaftar"
          icon={<UserCog className="h-6 w-6" weight="duotone" />}
          iconBg="bg-emerald-50 dark:bg-emerald-900/20"
          iconColor="text-emerald-600 dark:text-emerald-400"
          href="/dashboard/guru"
        />

        <StatCard
          title="Agenda Guru"
          value={`${agenda.percent}%`}
          sub={`${agenda.filled} dari ${agenda.total} terisi`}
          icon={<BookOpen className="h-6 w-6" weight="duotone" />}
          iconBg="bg-amber-50 dark:bg-amber-900/20"
          iconColor="text-amber-600 dark:text-amber-400"
          href="/dashboard/monitoring-agenda"
        />

        <StatCard
          title="Delegasi Tugas"
          value={`${selesaiDelegasi} / ${totalDelegasi}`}
          sub={totalDelegasi > 0 && selesaiDelegasi === totalDelegasi ? 'Semua selesai' : 'Sedang berjalan'}
          icon={<Send className="h-6 w-6" weight="duotone" />}
          iconBg="bg-purple-50 dark:bg-purple-900/20"
          iconColor="text-purple-600 dark:text-purple-400"
          href="/dashboard/monitoring-penugasan"
        />
      </div>
      )}

      {/* ============ SEKSI: PERLU PERHATIAN ============ */}
      {show('perlu_perhatian') && (
      <section className="space-y-3">
        <h2 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
          Perlu Perhatian
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard
            title="Aktivitas Sistem"
            subtitle="7 hari terakhir, per tingkat"
            icon={<Pulse className="h-3.5 w-3.5" weight="bold" />}
            iconBg="bg-sky-50 dark:bg-sky-900/20"
            iconColor="text-sky-600 dark:text-sky-400"
            href="/dashboard/log-aktivitas"
          >
            <AktivitasSeverityChart data={stats.aktivitas7h} />
          </ChartCard>

          <ChartCard
            title="Log Penting Terbaru"
            subtitle="Peringatan & bahaya"
            icon={<ShieldWarning className="h-3.5 w-3.5" weight="bold" />}
            iconBg="bg-rose-50 dark:bg-rose-900/20"
            iconColor="text-rose-600 dark:text-rose-400"
            href="/dashboard/log-aktivitas"
            hrefLabel="Semua"
          >
            {stats.perluPerhatian.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1 py-6 text-slate-400">
                <UserCheck className="h-5 w-5 text-emerald-400" weight="duotone" />
                <p className="text-[11px]">Tidak ada aktivitas yang perlu perhatian 👍</p>
              </div>
            ) : (
              <ul className="divide-y divide-surface-2">
                {stats.perluPerhatian.map((log, i) => {
                  const sev = SEVERITY_STYLE[log.severity] ?? SEVERITY_STYLE.warning
                  return (
                    <li key={i} className="flex items-start gap-2.5 py-2">
                      <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${sev.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-slate-700 dark:text-slate-200 line-clamp-2 leading-snug">{log.summary}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                          {sev.label} · {log.module}
                          {log.actor_name ? ` · ${log.actor_name}` : ''} · {formatWaktuLog(log.created_at)}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </ChartCard>
        </div>
      </section>
      )}

      {/* ============ SEKSI: SISWA & DEMOGRAFI ============ */}
      {show('siswa_demografi') && (
      <section className="space-y-3">
        <h2 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
          Siswa &amp; Demografi
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <ChartCard
            title="Komposisi Gender"
            subtitle="Siswa aktif"
            icon={<Users className="h-3.5 w-3.5" weight="bold" />}
            iconBg="bg-blue-50 dark:bg-blue-900/20"
            iconColor="text-blue-600 dark:text-blue-400"
          >
            <GenderDonut gender={stats.gender} />
          </ChartCard>

          <ChartCard
            title="Siswa per Angkatan"
            subtitle="Tahun masuk"
            icon={<GraduationCap className="h-3.5 w-3.5" weight="bold" />}
            iconBg="bg-cyan-50 dark:bg-cyan-900/20"
            iconColor="text-cyan-600 dark:text-cyan-400"
            href="/dashboard/siswa"
          >
            <AngkatanBar data={(breakdownAngkatan.results ?? []) as { angkatan: number; count: number }[]} />
          </ChartCard>

          <ChartCard
            title="Sebaran Domisili"
            subtitle="Tempat tinggal siswa"
            icon={<House className="h-3.5 w-3.5" weight="bold" />}
            iconBg="bg-violet-50 dark:bg-violet-900/20"
            iconColor="text-violet-600 dark:text-violet-400"
            className="md:col-span-2 xl:col-span-1"
          >
            <DomisiliBar data={stats.domisili} />
          </ChartCard>
        </div>
      </section>
      )}

      {/* ============ SEKSI: KEHADIRAN & KEDISIPLINAN ============ */}
      {show('kehadiran_kedisiplinan') && (
      <section className="space-y-3">
        <h2 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
          Kehadiran &amp; Kedisiplinan
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <ChartCard
            title="Tren Pelanggaran"
            subtitle="14 hari terakhir"
            icon={<TrendingDown className="h-3.5 w-3.5" weight="bold" />}
            iconBg="bg-rose-50 dark:bg-rose-900/20"
            iconColor="text-rose-600 dark:text-rose-400"
            href="/dashboard/kedisiplinan"
          >
            <PelanggaranTrend data={stats.pelanggaran14h} />
          </ChartCard>

          <ChartCard
            title="Jenis Pelanggaran Teratas"
            subtitle="Total keseluruhan"
            icon={<ListChecks className="h-3.5 w-3.5" weight="bold" />}
            iconBg="bg-orange-50 dark:bg-orange-900/20"
            iconColor="text-orange-600 dark:text-orange-400"
            href="/dashboard/kedisiplinan"
          >
            <TopPelanggaranBar data={stats.topPelanggaran} />
          </ChartCard>

          <ChartCard
            title="Presensi Pegawai"
            subtitle="Hari ini"
            icon={<UserCheck className="h-3.5 w-3.5" weight="bold" />}
            iconBg="bg-emerald-50 dark:bg-emerald-900/20"
            iconColor="text-emerald-600 dark:text-emerald-400"
            href="/dashboard/kehadiran"
            className="md:col-span-2 xl:col-span-1"
          >
            <PresensiDonut data={stats.presensiPegawai} />
          </ChartCard>
        </div>
      </section>
      )}
    </div>
  )
}
