// components/dashboard/SuperAdminDashboard.tsx
import Link from 'next/link'
import { getDB } from '@/utils/db'
import { todayWIB } from '@/lib/time'
import { WelcomeStrip } from './shared/WelcomeStrip'
import { StatCard } from './shared/StatCard'
import { QuickLink } from './shared/QuickLink'
import { KehadiranPribadiCard } from './shared/KehadiranPribadiCard'
import {
  Users, UserCog, Library, CalendarCheck,
  Activity, ClipboardList, FileSpreadsheet,
  Send, PackageSearch, Settings, ArrowRight,
} from 'lucide-react'

type Props = {
  userId: string; nama: string; namaDepan: string; avatarUrl: string | null
  roleLabel: string; roleColor: string; sapaan: string
  taAktif: { id?: string; nama: string; semester: number } | null
}

export async function SuperAdminDashboard({ userId, nama, namaDepan, avatarUrl, roleLabel, roleColor, sapaan, taAktif }: Props) {
  const db = await getDB()
  const today = todayWIB()

  const [counts, kehadiranSiswa, penugasan] = await Promise.all([
    db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM siswa WHERE status = 'aktif') as siswa,
        (SELECT COUNT(*) FROM "user" WHERE nama_lengkap IS NOT NULL) as guru,
        (SELECT COUNT(*) FROM kelas) as kelas
    `).first<any>(),

    db.prepare(`
      SELECT
        (SELECT COUNT(DISTINCT siswa_id) FROM izin_tidak_masuk_kelas WHERE tanggal = ?) as tidak_masuk,
        (SELECT COUNT(*) FROM izin_keluar_komplek WHERE status = 'BELUM KEMBALI') as di_luar,
        (SELECT COUNT(*) FROM izin_keluar_komplek WHERE DATE(waktu_keluar) = ?) as keluar_hari_ini
    `).bind(today, today).first<any>(),

    db.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'SELESAI' THEN 1 END) as selesai
      FROM delegasi_tugas WHERE tanggal = ?
    `).bind(today).first<any>(),
  ])

  const tidakMasuk    = kehadiranSiswa?.tidak_masuk ?? 0
  const diLuar        = kehadiranSiswa?.di_luar ?? 0
  const totalSiswa    = counts?.siswa ?? 0
  const hadirSiswaEst = Math.max(0, totalSiswa - tidakMasuk)
  const totalDelegasi = penugasan?.total ?? 0
  const selesaiDelegasi = penugasan?.selesai ?? 0

  return (
    <div className="space-y-3 animate-in fade-in duration-500 pb-12">
      <WelcomeStrip nama={nama} namaDepan={namaDepan} avatarUrl={avatarUrl}
        roleLabel={roleLabel} roleColor={roleColor} taAktif={taAktif} sapaan={sapaan} />

      <KehadiranPribadiCard userId={userId} />

      <div className="grid grid-cols-3 gap-3">
        <StatCard title="Siswa Aktif" value={counts?.siswa ?? 0}
          sub={`${counts?.kelas ?? 0} rombel`}
          icon={<Users className="h-4 w-4" />} iconBg="bg-blue-50" iconColor="text-blue-600"
          href="/dashboard/siswa" />
        <StatCard title="Guru & Pegawai" value={counts?.guru ?? 0} sub="terdaftar"
          icon={<UserCog className="h-4 w-4" />} iconBg="bg-emerald-50" iconColor="text-emerald-600"
          href="/dashboard/guru" />
        <StatCard title="Rombel" value={counts?.kelas ?? 0} sub="Kelas 10, 11, 12"
          icon={<Library className="h-4 w-4" />} iconBg="bg-amber-50" iconColor="text-amber-600"
          href="/dashboard/kelas" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Kehadiran Siswa */}
        <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
            <div className="p-1.5 rounded-md bg-emerald-50 border border-emerald-100">
              <CalendarCheck className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Kehadiran Siswa</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Hari ini</p>
            </div>
            <Link href="/dashboard/izin" className="ml-auto text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1">
              Detail <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800">
            <div className="flex flex-col items-center gap-1 py-4">
              <span className="text-2xl font-bold text-emerald-600 tabular-nums">{hadirSiswaEst}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">Hadir (est.)</span>
            </div>
            <div className="flex flex-col items-center gap-1 py-4">
              <span className="text-2xl font-bold text-rose-500 tabular-nums">{tidakMasuk}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">Izin tdk masuk</span>
            </div>
          </div>
          {diLuar > 0 && (
            <Link href="/dashboard/izin" className="flex items-center justify-between px-4 py-2 border-t border-amber-100 bg-amber-50 dark:bg-amber-900/20">
              <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                {diLuar} siswa di luar komplek
              </span>
              <ArrowRight className="h-3 w-3 text-amber-500" />
            </Link>
          )}
        </div>

        {/* Penugasan Hari Ini */}
        <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
            <div className="p-1.5 rounded-md bg-purple-50 border border-purple-100">
              <Send className="h-3.5 w-3.5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Penugasan / Delegasi</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Hari ini</p>
            </div>
            <Link href="/dashboard/penugasan" className="ml-auto text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1">
              Lihat <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800">
            <div className="flex flex-col items-center gap-1 py-5">
              <span className="text-2xl font-bold text-purple-600 tabular-nums">{totalDelegasi}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">Total delegasi</span>
            </div>
            <div className="flex flex-col items-center gap-1 py-5">
              <span className="text-2xl font-bold text-emerald-600 tabular-nums">{selesaiDelegasi}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">Selesai</span>
            </div>
          </div>
          {totalDelegasi > 0 && totalDelegasi > selesaiDelegasi && (
            <div className="px-4 py-2 border-t border-surface-2 bg-purple-50/40 dark:bg-purple-900/10">
              <p className="text-[10px] text-purple-600 dark:text-purple-400">
                {totalDelegasi - selesaiDelegasi} delegasi masih berjalan
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Shortcut Monitoring & Rekap */}
      <div className="rounded-xl border border-surface bg-surface shadow-sm">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
          <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <Activity className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Monitoring & Rekap</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">Akses cepat semua laporan & pengaturan</p>
          </div>
        </div>
        <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-0.5">
          <QuickLink href="/dashboard/monitoring-agenda"
            icon={<Activity className="h-4 w-4" />} iconBg="bg-blue-50" iconColor="text-blue-600"
            title="Monitoring Agenda" desc="Pantau jurnal mengajar guru" />
          <QuickLink href="/dashboard/rekap-absensi"
            icon={<ClipboardList className="h-4 w-4" />} iconBg="bg-amber-50" iconColor="text-amber-600"
            title="Rekap Absensi Siswa" desc="Kehadiran per kelas & periode" />
          <QuickLink href="/dashboard/akademik/nilai"
            icon={<FileSpreadsheet className="h-4 w-4" />} iconBg="bg-purple-50" iconColor="text-purple-600"
            title="Rekap Nilai" desc="Capaian akademik siswa" />
          <QuickLink href="/dashboard/sarpras"
            icon={<PackageSearch className="h-4 w-4" />} iconBg="bg-rose-50" iconColor="text-rose-500"
            title="Sarana Prasarana" desc="Inventaris & kondisi aset" />
          <QuickLink href="/dashboard/settings"
            icon={<Settings className="h-4 w-4" />} iconBg="bg-slate-100 dark:bg-slate-800" iconColor="text-slate-600 dark:text-slate-400"
            title="Pengaturan Sistem" desc="Tahun ajaran, jurusan, fitur" />
        </div>
      </div>
    </div>
  )
}
