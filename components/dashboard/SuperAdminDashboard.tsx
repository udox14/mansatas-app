// components/dashboard/SuperAdminDashboard.tsx
import Link from 'next/link'
import { getDB } from '@/utils/db'
import { todayWIB } from '@/lib/time'
import { getAllowedMenuItems } from '@/lib/features'
import { DEFAULT_SIDEBAR_GROUPS } from '@/config/menu'
import { WelcomeStrip } from './shared/WelcomeStrip'
import { StatCard } from './shared/StatCard'
import { QuickLink } from './shared/QuickLink'
import { JadwalMengajarToday } from './shared/JadwalMengajarToday'
import { KehadiranPribadiCard } from './shared/KehadiranPribadiCard'
import { PenugasanMasukCard } from './shared/PenugasanMasukCard'
import {
  WarningCircle as AlertCircle,
  ArrowRight,
  ChartBar as BarChart3,
  BookOpen,
  CalendarCheck,
  CheckCircle as CheckCircle2,
  SquaresFour as LayoutGrid,
  Books as Library,
  Megaphone,
  Radio,
  PaperPlaneTilt as Send,
  Gear as Settings,
  ShieldWarning as ShieldAlert,
  Sliders as SlidersHorizontal,
  Users,
  UserGear as UserCog,
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
}

type AgendaStats = {
  total: number
  filled: number
  percent: number
}

type ActionItem = {
  title: string
  desc: string
  href: string
  icon: React.ReactNode
  tone: 'rose' | 'amber' | 'blue' | 'emerald' | 'slate'
  badge?: string | number
}

const GROUP_META: Record<string, { title: string; desc: string }> = {
  'data-master': { title: 'Data Master', desc: 'Siswa, pegawai, kelas, dan plotting' },
  'tugas-harian-guru': { title: 'Operasional Harian', desc: 'Agenda, absensi, nilai, dan penugasan' },
  'monitoring-rekap': { title: 'Monitoring', desc: 'Pantauan harian dan rekap kerja' },
  'administrasi-hr': { title: 'Administrasi', desc: 'Surat, rapat, sarpras, buku tamu' },
  sistem: { title: 'Sistem', desc: 'Pengaturan, fitur, dan broadcast' },
}

const SHORTCUT_TONES: Record<string, { bg: string; color: string; desc: string }> = {
  siswa: { bg: 'bg-blue-50 dark:bg-blue-900/30', color: 'text-blue-600 dark:text-blue-400', desc: 'Data siswa aktif' },
  guru: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', color: 'text-emerald-600 dark:text-emerald-400', desc: 'Guru & pegawai' },
  kelas: { bg: 'bg-amber-50 dark:bg-amber-900/30', color: 'text-amber-600 dark:text-amber-400', desc: 'Rombel dan wali kelas' },
  plotting: { bg: 'bg-purple-50 dark:bg-purple-900/30', color: 'text-purple-600 dark:text-purple-400', desc: 'Kenaikan & penjurusan' },
  agenda: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', color: 'text-emerald-600 dark:text-emerald-400', desc: 'Jurnal mengajar' },
  kehadiran: { bg: 'bg-blue-50 dark:bg-blue-900/30', color: 'text-blue-600 dark:text-blue-400', desc: 'Absensi siswa' },
  penugasan: { bg: 'bg-purple-50 dark:bg-purple-900/30', color: 'text-purple-600 dark:text-purple-400', desc: 'Delegasi tugas' },
  'monitoring-agenda': { bg: 'bg-blue-50 dark:bg-blue-900/30', color: 'text-blue-600 dark:text-blue-400', desc: 'Jurnal hari ini' },
  'monitoring-penugasan': { bg: 'bg-purple-50 dark:bg-purple-900/30', color: 'text-purple-600 dark:text-purple-400', desc: 'Status delegasi' },
  'rekap-absensi': { bg: 'bg-amber-50 dark:bg-amber-900/30', color: 'text-amber-600 dark:text-amber-400', desc: 'Laporan kehadiran' },
  surat: { bg: 'bg-sky-50 dark:bg-sky-900/30', color: 'text-sky-600 dark:text-sky-400', desc: 'Surat keluar' },
  rapat: { bg: 'bg-amber-50 dark:bg-amber-900/30', color: 'text-amber-600 dark:text-amber-400', desc: 'Undangan rapat' },
  sarpras: { bg: 'bg-rose-50 dark:bg-rose-900/30', color: 'text-rose-600 dark:text-rose-400', desc: 'Inventaris aset' },
  settings: { bg: 'bg-slate-100 dark:bg-slate-800', color: 'text-slate-600 dark:text-slate-400', desc: 'Konfigurasi app' },
  'settings-fitur': { bg: 'bg-rose-50 dark:bg-rose-900/30', color: 'text-rose-600 dark:text-rose-400', desc: 'Hak akses fitur' },
  'settings-notifications': { bg: 'bg-cyan-50 dark:bg-cyan-900/30', color: 'text-cyan-600 dark:text-cyan-400', desc: 'Broadcast pesan' },
}

const GROUP_LIMITS: Record<string, number> = {
  'data-master': 4,
  'tugas-harian-guru': 4,
  'monitoring-rekap': 4,
  'administrasi-hr': 4,
  sistem: 4,
}

const DEFAULT_SHORTCUT = {
  bg: 'bg-slate-100 dark:bg-slate-800',
  color: 'text-slate-600 dark:text-slate-400',
  desc: 'Akses fitur',
}

function pct(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0
}

function progressTone(percent: number) {
  if (percent >= 80) return 'bg-emerald-500 text-emerald-600'
  if (percent >= 50) return 'bg-amber-500 text-amber-600'
  return 'bg-rose-500 text-rose-600'
}

async function optionalFirst<T>(db: D1Database, sql: string, bindings: unknown[] = [], fallback: T): Promise<T> {
  try {
    return (await db.prepare(sql).bind(...bindings).first<T>()) ?? fallback
  } catch {
    return fallback
  }
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

function SectionHeader({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode
  title: string
  desc?: string
}) {
  return (
    <div className="flex items-center gap-3 px-2 mb-4">
      <div className="p-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-sm">
        {icon}
      </div>
      <div className="min-w-0">
        <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-50 tracking-tight leading-none">{title}</h2>
        {desc && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{desc}</p>}
      </div>
    </div>
  )
}

function TodayMetric({
  title,
  value,
  desc,
  href,
  icon,
  color,
}: {
  title: string
  value: string | number
  desc: string
  href: string
  icon: React.ReactNode
  color: string
}) {
  return (
    <Link
      href={href}
      className="group rounded-3xl bg-white dark:bg-slate-800 p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:-translate-y-1"
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`h-11 w-11 rounded-2xl flex items-center justify-center ${color} shadow-sm`}>{icon}</div>
        <div className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowRight className="h-4 w-4 text-slate-400 dark:text-slate-300" />
        </div>
      </div>
      <div className="mt-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">{title}</p>
        <p className="text-3xl font-extrabold leading-none tracking-tight text-slate-800 dark:text-slate-50 tabular-nums">{value}</p>
        <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400 leading-snug">{desc}</p>
      </div>
    </Link>
  )
}

function ProgressPanel({
  agenda,
  href,
}: {
  agenda: AgendaStats
  href: string
}) {
  const tone = progressTone(agenda.percent)

  return (
    <Link href={href} className="group block rounded-3xl bg-white dark:bg-slate-800 p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:-translate-y-1">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Agenda Guru</p>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-slate-50 tabular-nums">{agenda.filled}</p>
        </div>
        <div className={`px-3 py-1.5 rounded-xl font-bold tabular-nums text-sm ${tone.split(' ')[1]} ${tone.split(' ')[0].replace('bg-', 'bg-opacity-20 bg-')}`}>{agenda.percent}%</div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">dari {agenda.total} jadwal</p>
        <div className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowRight className="h-4 w-4 text-slate-400 dark:text-slate-300" />
        </div>
      </div>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/50">
        <div className={`h-full rounded-full ${tone.split(' ')[0]}`} style={{ width: `${agenda.percent}%` }} />
      </div>
      <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">
        {agenda.total === 0
          ? 'Tidak ada jadwal mengajar hari ini'
          : agenda.percent >= 80
            ? 'Pengisian agenda berjalan baik'
            : 'Masih ada jurnal yang perlu dikejar'}
      </p>
    </Link>
  )
}

function ActionCard({ item }: { item: ActionItem }) {
  const toneClass = {
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20',
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  }[item.tone]

  return (
    <Link href={item.href} className="group flex items-center gap-4 rounded-3xl bg-white dark:bg-slate-800 p-4 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
      <div className={`h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center ${toneClass}`}>{item.icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{item.title}</p>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">{item.desc}</p>
      </div>
      {item.badge !== undefined && (
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
          {item.badge}
        </span>
      )}
      <div className="shrink-0 p-2 bg-slate-50 dark:bg-slate-700/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
        <ArrowRight className="h-4 w-4 text-slate-400 dark:text-slate-300" />
      </div>
    </Link>
  )
}

export async function SuperAdminDashboard({
  userId,
  nama,
  namaDepan,
  avatarUrl,
  roleLabel,
  roleColor,
  sapaan,
  taAktif,
  isGuruPiket,
  primaryRole = 'admin_tu',
}: Props) {
  const db = await getDB()
  const today = todayWIB()
  const isSuperAdmin = primaryRole === 'super_admin'

  const [
    counts,
    kehadiranSiswa,
    penugasan,
    agenda,
    pelanggaran,
    bukuTamu,
    allowedMenus,
  ] = await Promise.all([
    db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM siswa WHERE status = 'aktif') as siswa,
        (SELECT COUNT(*) FROM "user" WHERE nama_lengkap IS NOT NULL) as guru,
        (SELECT COUNT(*) FROM kelas) as kelas
    `).first<{ siswa: number; guru: number; kelas: number }>(),

    db.prepare(`
      SELECT
        (SELECT COUNT(DISTINCT siswa_id) FROM izin_tidak_masuk_kelas WHERE tanggal = ?) as tidak_masuk,
        (SELECT COUNT(*) FROM izin_keluar_komplek WHERE status = 'BELUM KEMBALI') as di_luar,
        (SELECT COUNT(*) FROM izin_keluar_komplek WHERE DATE(waktu_keluar) = ?) as keluar_hari_ini
    `).bind(today, today).first<{ tidak_masuk: number; di_luar: number; keluar_hari_ini: number }>(),

    db.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'SELESAI' THEN 1 END) as selesai
      FROM delegasi_tugas WHERE tanggal = ?
    `).bind(today).first<{ total: number; selesai: number }>(),

    getAgendaStats(db, today, taAktif?.id),

    db.prepare(`
      SELECT
        COUNT(*) as hari_ini,
        (SELECT COUNT(*) FROM siswa_pelanggaran WHERE tanggal >= date(?, '-6 days')) as tujuh_hari
      FROM siswa_pelanggaran WHERE tanggal = ?
    `).bind(today, today).first<{ hari_ini: number; tujuh_hari: number }>(),

    optionalFirst(db, `
      SELECT COUNT(*) as hari_ini FROM buku_tamu WHERE DATE(waktu_datang) = ?
    `, [today], { hari_ini: 0 }),

    getAllowedMenuItems(db, userId),
  ])

  const totalSiswa = counts?.siswa ?? 0
  const tidakMasuk = kehadiranSiswa?.tidak_masuk ?? 0
  const diLuar = kehadiranSiswa?.di_luar ?? 0
  const hadirSiswaEst = Math.max(0, totalSiswa - tidakMasuk)
  const totalDelegasi = penugasan?.total ?? 0
  const selesaiDelegasi = penugasan?.selesai ?? 0
  const belumSelesaiDelegasi = Math.max(0, totalDelegasi - selesaiDelegasi)

  const actionItems: ActionItem[] = [
    belumSelesaiDelegasi > 0
      ? {
          title: 'Delegasi belum selesai',
          desc: 'Pantau tugas yang masih berjalan hari ini',
          href: '/dashboard/monitoring-penugasan',
          icon: <Send className="h-4 w-4" />,
          tone: 'amber',
          badge: belumSelesaiDelegasi,
        }
      : {
          title: 'Delegasi hari ini terkendali',
          desc: 'Tidak ada delegasi tertunda',
          href: '/dashboard/penugasan',
          icon: <CheckCircle2 className="h-4 w-4" />,
          tone: 'emerald',
        },
    agenda.total > 0 && agenda.percent < 80
      ? {
          title: 'Agenda guru perlu dikejar',
          desc: `${agenda.filled} dari ${agenda.total} jadwal sudah terisi`,
          href: '/dashboard/monitoring-agenda',
          icon: <BookOpen className="h-4 w-4" />,
          tone: 'amber',
          badge: `${agenda.percent}%`,
        }
      : {
          title: 'Agenda guru stabil',
          desc: agenda.total === 0 ? 'Tidak ada jadwal hari ini' : `${agenda.percent}% jurnal sudah terisi`,
          href: '/dashboard/monitoring-agenda',
          icon: <CheckCircle2 className="h-4 w-4" />,
          tone: 'emerald',
        },
    (pelanggaran?.hari_ini ?? 0) > 0
      ? {
          title: 'Catatan kedisiplinan baru',
          desc: 'Perlu dipantau BK dan wali kelas',
          href: '/dashboard/monitoring-kedisiplinan',
          icon: <ShieldAlert className="h-4 w-4" />,
          tone: 'rose',
          badge: pelanggaran?.hari_ini,
        }
      : {
          title: 'Kedisiplinan hari ini tenang',
          desc: 'Belum ada pelanggaran tercatat',
          href: '/dashboard/monitoring-kedisiplinan',
          icon: <CheckCircle2 className="h-4 w-4" />,
          tone: 'emerald',
        },
  ]

  if (diLuar > 0) {
    actionItems.splice(1, 0, {
      title: 'Siswa belum kembali',
      desc: 'Izin keluar komplek masih aktif',
      href: '/dashboard/izin',
      icon: <AlertCircle className="h-4 w-4" />,
      tone: 'rose',
      badge: diLuar,
    })
  }

  if ((bukuTamu?.hari_ini ?? 0) > 0) {
    actionItems.push({
      title: 'Tamu hari ini',
      desc: 'Cek buku tamu madrasah',
      href: '/dashboard/buku-tamu',
      icon: <Users className="h-4 w-4" />,
      tone: 'blue',
      badge: bukuTamu?.hari_ini,
    })
  }

  const allowedById = new Map(allowedMenus.map(item => [item.id, item]))
  const shortcutGroups = DEFAULT_SIDEBAR_GROUPS
    .filter(group => GROUP_META[group.id])
    .map(group => ({
      ...group,
      items: group.items
        .map(id => allowedById.get(id))
        .filter((item): item is NonNullable<typeof item> => item !== undefined)
        .slice(0, GROUP_LIMITS[group.id] ?? 4),
    }))
    .filter(group => group.items.length > 0)

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-16">
      <WelcomeStrip nama={nama} namaDepan={namaDepan} avatarUrl={avatarUrl}
        roleLabel={roleLabel} roleColor={roleColor} taAktif={taAktif} sapaan={sapaan} />

      <KehadiranPribadiCard userId={userId} />

      {isGuruPiket && <PenugasanMasukCard userId={userId} />}

      <JadwalMengajarToday userId={userId} taAktif={taAktif} />

      {/* Masonry-like Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8 items-start">
        {/* Kolom Kiri: Operasional & Tindakan */}
        <div className="flex flex-col gap-6 lg:gap-8">
          <section>
            <SectionHeader
              icon={<CalendarCheck className="h-5 w-5" weight="duotone" />}
              title="Overview Hari Ini"
              desc="Pantauan vital operasional sekolah"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ProgressPanel agenda={agenda} href="/dashboard/monitoring-agenda" />
              <TodayMetric
                title="Hadir Estimasi"
                value={hadirSiswaEst}
                desc={`${tidakMasuk} izin tidak masuk`}
                href="/dashboard/izin"
                icon={<Users className="h-6 w-6" weight="duotone" />}
                color="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20"
              />
              <TodayMetric
                title="Delegasi"
                value={`${selesaiDelegasi}/${totalDelegasi}`}
                desc={belumSelesaiDelegasi > 0 ? `${belumSelesaiDelegasi} masih berjalan` : 'Tidak ada yang tertunda'}
                href="/dashboard/monitoring-penugasan"
                icon={<Send className="h-6 w-6" weight="duotone" />}
                color="bg-purple-50 text-purple-600 dark:bg-purple-900/20"
              />
              <TodayMetric
                title="Di Luar Komplek"
                value={diLuar}
                desc={`${kehadiranSiswa?.keluar_hari_ini ?? 0} izin keluar hari ini`}
                href="/dashboard/izin"
                icon={<AlertCircle className="h-6 w-6" weight="duotone" />}
                color={diLuar > 0 ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/20' : 'bg-slate-100 text-slate-600 dark:bg-slate-800'}
              />
            </div>
          </section>

          {actionItems.length > 0 && (
            <section>
              <SectionHeader
                icon={<AlertCircle className="h-5 w-5" weight="duotone" />}
                title="Butuh Tindakan"
                desc="Antrian tugas dan sinyal perhatian"
              />
              <div className="flex flex-col gap-3">
                {actionItems.map((item, index) => <ActionCard key={`${item.title}-${index}`} item={item} />)}
              </div>
            </section>
          )}
        </div>

        {/* Kolom Kanan: Data Master, Snapshot & Kontrol */}
        <div className="flex flex-col gap-6 lg:gap-8">
          <section>
            <SectionHeader
              icon={<Library className="h-5 w-5" weight="duotone" />}
              title="Data Master"
              desc="Statistik utama madrasah"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 gap-4">
              <StatCard
                title="Siswa Aktif"
                value={totalSiswa}
                sub={`${counts?.kelas ?? 0} rombel`}
                icon={<Users className="h-6 w-6" weight="duotone" />}
                iconBg="bg-blue-50 dark:bg-blue-900/20"
                iconColor="text-blue-600 dark:text-blue-400"
                href="/dashboard/siswa"
              />
              <StatCard
                title="Guru & Pegawai"
                value={counts?.guru ?? 0}
                sub="terdaftar"
                icon={<UserCog className="h-6 w-6" weight="duotone" />}
                iconBg="bg-emerald-50 dark:bg-emerald-900/20"
                iconColor="text-emerald-600 dark:text-emerald-400"
                href="/dashboard/guru"
              />
              <StatCard
                title="Rombel"
                value={counts?.kelas ?? 0}
                sub="kelas aktif"
                icon={<Library className="h-6 w-6" weight="duotone" />}
                iconBg="bg-amber-50 dark:bg-amber-900/20"
                iconColor="text-amber-600 dark:text-amber-400"
                href="/dashboard/kelas"
              />
            </div>
          </section>

          <section>
            <SectionHeader
              icon={<BarChart3 className="h-5 w-5" weight="duotone" />}
              title="Snapshot"
              desc="Ringkasan data lintas area"
            />
            <div className="rounded-3xl bg-white dark:bg-slate-800 p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] space-y-3">
              <SnapshotRow label="Agenda terisi hari ini" value={`${agenda.percent}%`} href="/dashboard/monitoring-agenda" />
              <SnapshotRow label="Izin tidak masuk" value={tidakMasuk} href="/dashboard/izin" />
              <SnapshotRow label="Siswa di luar komplek" value={diLuar} href="/dashboard/izin" />
              <SnapshotRow label="Delegasi belum selesai" value={belumSelesaiDelegasi} href="/dashboard/monitoring-penugasan" />
              <SnapshotRow label="Pelanggaran 7 hari" value={pelanggaran?.tujuh_hari ?? 0} href="/dashboard/monitoring-kedisiplinan" />
              <SnapshotRow label="Tamu hari ini" value={bukuTamu?.hari_ini ?? 0} href="/dashboard/buku-tamu" />
            </div>
          </section>

          <section>
            <SectionHeader
              icon={<Settings className="h-5 w-5" weight="duotone" />}
              title="Kontrol Sistem"
              desc={isSuperAdmin ? 'Konfigurasi mendalam admin' : 'Konfigurasi aplikasi'}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <QuickLink
                href="/dashboard/settings"
                icon={<Settings className="h-5 w-5" weight="duotone" />}
                iconBg="bg-slate-100 dark:bg-slate-800"
                iconColor="text-slate-600 dark:text-slate-400"
                title="Pengaturan Aplikasi"
                desc="Tahun ajaran, jadwal, dan konfigurasi"
              />
              {isSuperAdmin && (
                <>
                  <QuickLink
                    href="/dashboard/settings/fitur"
                    icon={<SlidersHorizontal className="h-5 w-5" weight="duotone" />}
                    iconBg="bg-rose-50 dark:bg-rose-900/30"
                    iconColor="text-rose-600 dark:text-rose-400"
                    title="Manajemen Fitur"
                    desc="Role, sidebar, dan izin fitur"
                  />
                  <QuickLink
                    href="/dashboard/settings/notifications"
                    icon={<Radio className="h-5 w-5" weight="duotone" />}
                    iconBg="bg-cyan-50 dark:bg-cyan-900/30"
                    iconColor="text-cyan-600 dark:text-cyan-400"
                    title="Broadcast"
                    desc="Kirim notifikasi ke pengguna"
                  />
                  <QuickLink
                    href="/dashboard/pengumuman-ortu"
                    icon={<Megaphone className="h-5 w-5" weight="duotone" />}
                    iconBg="bg-amber-50 dark:bg-amber-900/30"
                    iconColor="text-amber-600 dark:text-amber-400"
                    title="Pengumuman Ortu"
                    desc="Informasi portal"
                  />
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function SnapshotRow({
  label,
  value,
  href,
}: {
  label: string
  value: string | number
  href: string
}) {
  return (
    <Link href={href} className="flex items-center justify-between gap-4 rounded-2xl px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{label}</span>
      <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">{value}</span>
    </Link>
  )
}
