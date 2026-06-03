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
  AlertCircle,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  LayoutGrid,
  Library,
  Megaphone,
  Radio,
  Send,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  Users,
  UserCog,
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
    <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
      <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{title}</p>
        {desc && <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{desc}</p>}
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
      className="group rounded-xl border border-surface bg-surface p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${color}`}>{icon}</div>
        <ArrowRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 shrink-0" />
      </div>
      <div className="mt-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{title}</p>
        <p className="mt-1 text-2xl font-bold leading-none tracking-tight text-slate-800 dark:text-slate-100 tabular-nums">{value}</p>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{desc}</p>
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
    <Link href={href} className="group block rounded-xl border border-surface bg-surface p-4 shadow-sm hover:border-slate-300 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Agenda Guru</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">Pengisian jurnal hari ini</p>
        </div>
        <span className={`text-xl font-bold tabular-nums ${tone.split(' ')[1]}`}>{agenda.percent}%</span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-50 tabular-nums">{agenda.filled}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">dari {agenda.total} jadwal</p>
        </div>
        <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-slate-400" />
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={`h-full rounded-full ${tone.split(' ')[0]}`} style={{ width: `${agenda.percent}%` }} />
      </div>
      <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
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
    rose: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20 dark:border-rose-900/40',
    amber: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:border-amber-900/40',
    blue: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:border-blue-900/40',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-900/40',
    slate: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300',
  }[item.tone]

  return (
    <Link href={item.href} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-surface-2 transition-colors">
      <div className={`h-8 w-8 shrink-0 rounded-lg border flex items-center justify-center ${toneClass}`}>{item.icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{item.title}</p>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{item.desc}</p>
      </div>
      {item.badge !== undefined && (
        <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {item.badge}
        </span>
      )}
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-slate-400" />
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
    <div className="space-y-3 animate-in fade-in duration-500 pb-12">
      <WelcomeStrip nama={nama} namaDepan={namaDepan} avatarUrl={avatarUrl}
        roleLabel={roleLabel} roleColor={roleColor} taAktif={taAktif} sapaan={sapaan} />

      <KehadiranPribadiCard userId={userId} />

      {isGuruPiket && <PenugasanMasukCard userId={userId} />}

      <JadwalMengajarToday userId={userId} taAktif={taAktif} />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)] gap-3">
        <div className="space-y-3">
          <div className="rounded-xl border border-surface bg-surface shadow-sm">
            <SectionHeader
              icon={<CalendarCheck className="h-3.5 w-3.5" />}
              title="Hari Ini"
              desc="Hal yang paling perlu terlihat begitu dashboard dibuka"
            />
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <ProgressPanel agenda={agenda} href="/dashboard/monitoring-agenda" />
              <TodayMetric
                title="Hadir Estimasi"
                value={hadirSiswaEst}
                desc={`${tidakMasuk} izin tidak masuk`}
                href="/dashboard/izin"
                icon={<Users className="h-4 w-4" />}
                color="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20"
              />
              <TodayMetric
                title="Delegasi"
                value={`${selesaiDelegasi}/${totalDelegasi}`}
                desc={belumSelesaiDelegasi > 0 ? `${belumSelesaiDelegasi} masih berjalan` : 'Tidak ada yang tertunda'}
                href="/dashboard/monitoring-penugasan"
                icon={<Send className="h-4 w-4" />}
                color="bg-purple-50 text-purple-600 dark:bg-purple-900/20"
              />
              <TodayMetric
                title="Di Luar Komplek"
                value={diLuar}
                desc={`${kehadiranSiswa?.keluar_hari_ini ?? 0} izin keluar hari ini`}
                href="/dashboard/izin"
                icon={<AlertCircle className="h-4 w-4" />}
                color={diLuar > 0 ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/20' : 'bg-slate-100 text-slate-600 dark:bg-slate-800'}
              />
            </div>
          </div>

          <div className="rounded-xl border border-surface bg-surface shadow-sm">
            <SectionHeader
              icon={<LayoutGrid className="h-3.5 w-3.5" />}
              title="Akses Cepat Terarah"
              desc="Dikelompokkan mengikuti hak akses menu yang aktif"
            />
            <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              {shortcutGroups.map(group => {
                const meta = GROUP_META[group.id]
                return (
                  <div key={group.id} className="rounded-lg border border-surface-2 bg-surface">
                    <div className="px-3 py-2 border-b border-surface-2">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{meta.title}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">{meta.desc}</p>
                    </div>
                    <div className="p-1.5 grid grid-cols-1 sm:grid-cols-2 gap-0.5">
                      {group.items.map(item => {
                        const meta = SHORTCUT_TONES[item.id] || DEFAULT_SHORTCUT
                        const Icon = item.icon as any
                        return (
                          <QuickLink
                            key={item.id}
                            href={item.href}
                            icon={<Icon className="h-4 w-4" />}
                            iconBg={meta.bg}
                            iconColor={meta.color}
                            title={item.title}
                            desc={meta.desc}
                          />
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-surface bg-surface shadow-sm">
            <SectionHeader
              icon={<AlertCircle className="h-3.5 w-3.5" />}
              title="Butuh Tindakan"
              desc="Antrian kerja dan sinyal yang jangan kelewat"
            />
            <div className="p-2">
              {actionItems.map((item, index) => <ActionCard key={`${item.title}-${index}`} item={item} />)}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-1 gap-3">
            <StatCard
              title="Siswa Aktif"
              value={totalSiswa}
              sub={`${counts?.kelas ?? 0} rombel`}
              icon={<Users className="h-4 w-4" />}
              iconBg="bg-blue-50 dark:bg-blue-900/20"
              iconColor="text-blue-600 dark:text-blue-400"
              href="/dashboard/siswa"
            />
            <StatCard
              title="Guru & Pegawai"
              value={counts?.guru ?? 0}
              sub="terdaftar"
              icon={<UserCog className="h-4 w-4" />}
              iconBg="bg-emerald-50 dark:bg-emerald-900/20"
              iconColor="text-emerald-600 dark:text-emerald-400"
              href="/dashboard/guru"
            />
            <StatCard
              title="Rombel"
              value={counts?.kelas ?? 0}
              sub="kelas aktif"
              icon={<Library className="h-4 w-4" />}
              iconBg="bg-amber-50 dark:bg-amber-900/20"
              iconColor="text-amber-600 dark:text-amber-400"
              href="/dashboard/kelas"
            />
          </div>

          <div className="rounded-xl border border-surface bg-surface shadow-sm">
            <SectionHeader
              icon={<BarChart3 className="h-3.5 w-3.5" />}
              title="Snapshot Data"
              desc="Ringkasan lintas area"
            />
            <div className="p-3 space-y-2">
              <SnapshotRow label="Agenda terisi hari ini" value={`${agenda.percent}%`} href="/dashboard/monitoring-agenda" />
              <SnapshotRow label="Izin tidak masuk" value={tidakMasuk} href="/dashboard/izin" />
              <SnapshotRow label="Siswa di luar komplek" value={diLuar} href="/dashboard/izin" />
              <SnapshotRow label="Delegasi belum selesai" value={belumSelesaiDelegasi} href="/dashboard/monitoring-penugasan" />
              <SnapshotRow label="Pelanggaran 7 hari" value={pelanggaran?.tujuh_hari ?? 0} href="/dashboard/monitoring-kedisiplinan" />
              <SnapshotRow label="Tamu hari ini" value={bukuTamu?.hari_ini ?? 0} href="/dashboard/buku-tamu" />
            </div>
          </div>

          <div className="rounded-xl border border-surface bg-surface shadow-sm">
            <SectionHeader
              icon={<Settings className="h-3.5 w-3.5" />}
              title="Kontrol Sistem"
              desc={isSuperAdmin ? 'Akses konfigurasi super admin' : 'Akses konfigurasi aplikasi'}
            />
            <div className="p-2 grid grid-cols-1 gap-0.5">
              <QuickLink
                href="/dashboard/settings"
                icon={<Settings className="h-4 w-4" />}
                iconBg="bg-slate-100 dark:bg-slate-800"
                iconColor="text-slate-600 dark:text-slate-400"
                title="Pengaturan Aplikasi"
                desc="Tahun ajaran, jadwal, dan konfigurasi"
              />
              {isSuperAdmin && (
                <>
                  <QuickLink
                    href="/dashboard/settings/fitur"
                    icon={<SlidersHorizontal className="h-4 w-4" />}
                    iconBg="bg-rose-50 dark:bg-rose-900/30"
                    iconColor="text-rose-600 dark:text-rose-400"
                    title="Manajemen Fitur"
                    desc="Role, sidebar, dan izin fitur"
                  />
                  <QuickLink
                    href="/dashboard/settings/notifications"
                    icon={<Radio className="h-4 w-4" />}
                    iconBg="bg-cyan-50 dark:bg-cyan-900/30"
                    iconColor="text-cyan-600 dark:text-cyan-400"
                    title="Broadcast"
                    desc="Kirim notifikasi ke pengguna"
                  />
                  <QuickLink
                    href="/dashboard/pengumuman-ortu"
                    icon={<Megaphone className="h-4 w-4" />}
                    iconBg="bg-amber-50 dark:bg-amber-900/30"
                    iconColor="text-amber-600 dark:text-amber-400"
                    title="Pengumuman Ortu"
                    desc="Informasi untuk portal orang tua"
                  />
                </>
              )}
            </div>
          </div>
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
    <Link href={href} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-surface-2 transition-colors">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tabular-nums">{value}</span>
    </Link>
  )
}
