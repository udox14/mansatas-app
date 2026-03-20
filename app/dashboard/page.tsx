// Lokasi: app/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import Link from 'next/link'
import {
  Users, UserCog, Library, ShieldAlert,
  TrendingUp, CalendarCheck, Clock, ArrowRight,
  GraduationCap, Settings, BarChart2, AlertTriangle,
  Package
} from 'lucide-react'

export const metadata = { title: 'Dashboard - MANSATAS App' }

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()

  // Batch 1: user info + TA aktif
  const [freshUser, taAktif] = await Promise.all([
    db.prepare('SELECT nama_lengkap, role, avatar_url FROM "user" WHERE id = ?').bind(user.id).first<any>(),
    db.prepare('SELECT nama, semester FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<{ nama: string; semester: number }>(),
  ])

  const today = new Date().toISOString().split('T')[0]

  // Batch 2: stat counts + live counters + pelanggaran — semuanya parallel
  // Hemat reads: 3 COUNT digabung 1 query scalar, live counter 1 query
  const [counts, liveData, pelanggaranRaw] = await Promise.all([
    db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM siswa WHERE status = 'aktif') as siswa,
        (SELECT COUNT(*) FROM "user" WHERE role IN ('guru','guru_bk','wakamad','kepsek','guru_piket')) as guru,
        (SELECT COUNT(*) FROM kelas) as kelas
    `).first<{ siswa: number; guru: number; kelas: number }>(),

    db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM izin_keluar_komplek WHERE status = 'BELUM KEMBALI') as di_luar,
        (SELECT COUNT(*) FROM izin_tidak_masuk_kelas WHERE tanggal = ?) as izin_kelas
    `).bind(today).first<{ di_luar: number; izin_kelas: number }>(),

    db.prepare(`
      SELECT sp.tanggal, s.nama_lengkap as siswa_nama,
        mp.nama_pelanggaran, mp.poin
      FROM siswa_pelanggaran sp
      JOIN siswa s ON sp.siswa_id = s.id
      JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
      ORDER BY sp.created_at DESC LIMIT 5
    `).all<any>().then(r => r.results ?? []),
  ])

  const hour = new Date().getHours()
  const sapaan = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam'
  const namaLengkap = freshUser?.nama_lengkap || user.name || 'Pengguna'
  const namaDepan = namaLengkap.split(' ')[0]
  const avatarUrl = freshUser?.avatar_url ?? null
  const userRole = freshUser?.role || (user as any).role || ''

  const roleLabel: Record<string, string> = {
    super_admin: 'Super Admin', admin_tu: 'Admin TU', kepsek: 'Kepala Madrasah',
    wakamad: 'Wakamad', guru: 'Guru', guru_bk: 'Guru BK',
    guru_piket: 'Guru Piket', satpam: 'Satpam', pramubakti: 'Pramubakti', wali_murid: 'Wali Murid',
  }

  const todayLabel = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="space-y-3 animate-in fade-in duration-500 pb-12">

      {/* ── WELCOME STRIP ── */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-surface bg-surface px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative h-10 w-10 shrink-0 rounded-full bg-emerald-500 flex items-center justify-center overflow-hidden shadow-sm">
            {avatarUrl
              ? <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              : <span className="text-base font-semibold text-white select-none">{namaDepan.charAt(0).toUpperCase()}</span>
            }
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-0.5">{sapaan}</p>
            <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-50 leading-snug truncate">{namaLengkap}</h1>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                {roleLabel[userRole] ?? userRole.replace('_', ' ')}
              </span>
              {taAktif && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <CalendarCheck className="h-3 w-3" />
                  TA {taAktif.nama} · Smt {taAktif.semester}
                </span>
              )}
            </div>
          </div>
        </div>
        <Link
          href="/dashboard/settings/profile"
          className="shrink-0 hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-200 border border-surface hover:border-slate-300 px-3 py-1.5 rounded-md bg-surface-2 hover:bg-surface transition-colors"
        >
          <UserCog className="h-3.5 w-3.5" /> Profil saya
        </Link>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Siswa aktif" value={counts?.siswa ?? 0} sub={`${counts?.kelas ?? 0} rombel`} icon={<Users className="h-4 w-4" />} iconBg="bg-blue-50" iconColor="text-blue-600" href="/dashboard/siswa" />
        <StatCard title="Guru & pegawai" value={counts?.guru ?? 0} sub="berbagai peran" icon={<UserCog className="h-4 w-4" />} iconBg="bg-emerald-50" iconColor="text-emerald-600" href="/dashboard/guru" />
        <StatCard title="Rombel" value={counts?.kelas ?? 0} sub="Kelas 10, 11, 12" icon={<Library className="h-4 w-4" />} iconBg="bg-amber-50" iconColor="text-amber-600" href="/dashboard/kelas" />
        <StatCard title="Analitik SNBP" value="PDSS" sub="Kelas 12 aktif" icon={<BarChart2 className="h-4 w-4" />} iconBg="bg-violet-50" iconColor="text-violet-600" href="/dashboard/akademik/analitik" />
      </div>

      {/* ── MAIN GRID ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">

        {/* KIRI: Live status + Pelanggaran */}
        <div className="flex flex-col gap-3">

          {/* Live counter */}
          <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
              <div className="p-1.5 rounded-md bg-emerald-50 border border-emerald-100">
                <Clock className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Status hari ini</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">{todayLabel}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-slate-100">
              <LiveCell label="Siswa di luar komplek" value={liveData?.di_luar ?? 0} color="rose" href="/dashboard/izin" activeLabel="Belum kembali" />
              <LiveCell label="Izin tidak masuk kelas" value={liveData?.izin_kelas ?? 0} color="amber" href="/dashboard/izin" activeLabel="Hari ini" />
            </div>
          </div>

          {/* Radar pelanggaran */}
          <div className="flex-1 rounded-xl border border-surface bg-surface shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-rose-50 border border-rose-100">
                  <ShieldAlert className="h-3.5 w-3.5 text-rose-500" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Pelanggaran terbaru</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">5 kasus terakhir</p>
                </div>
              </div>
              <Link href="/dashboard/kedisiplinan" className="inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-300 dark:text-slate-600 transition-colors">
                Lihat semua <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="p-2">
              {pelanggaranRaw.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-400 dark:text-slate-500">
                  <div className="p-2.5 rounded-full bg-emerald-50">
                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                  </div>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300 dark:text-slate-600">Situasi aman terkendali</p>
                  <p className="text-[11px]">Belum ada catatan pelanggaran.</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {pelanggaranRaw.map((p: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-2 transition-colors">
                      <div className="h-8 w-8 shrink-0 rounded-lg bg-rose-50 border border-rose-100 flex flex-col items-center justify-center">
                        <span className="text-[9px] font-bold text-rose-400 leading-tight">+{p.poin}</span>
                        <span className="text-[8px] text-rose-300 leading-tight">poin</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate">{p.siswa_nama}</p>
                        <p className="text-[11px] text-rose-500 truncate">{p.nama_pelanggaran}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                        {new Date(p.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* KANAN: Akses cepat */}
        <div className="rounded-xl border border-surface bg-surface shadow-sm">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
            <div className="p-1.5 rounded-md bg-amber-50 border border-amber-100">
              <Package className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Akses cepat</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Menu operasional harian</p>
            </div>
          </div>
          <div className="p-2 space-y-0.5">
            <QuickLink href="/dashboard/kehadiran" icon={<CalendarCheck className="h-4 w-4" />} iconBg="bg-emerald-50" iconColor="text-emerald-600" title="Jurnal & Kehadiran" desc="Isi absensi & jurnal kelas" />
            <QuickLink href="/dashboard/kedisiplinan" icon={<AlertTriangle className="h-4 w-4" />} iconBg="bg-rose-50" iconColor="text-rose-500" title="Lapor Pelanggaran" desc="Input kasus tata tertib" />
            <QuickLink href="/dashboard/izin" icon={<Clock className="h-4 w-4" />} iconBg="bg-amber-50" iconColor="text-amber-600" title="Perizinan Siswa" desc="Keluar komplek & izin kelas" />
            <QuickLink href="/dashboard/plotting" icon={<GraduationCap className="h-4 w-4" />} iconBg="bg-blue-50" iconColor="text-blue-600" title="Plotting & Kenaikan" desc="Penjurusan & naik kelas" />
            <QuickLink href="/dashboard/akademik/analitik" icon={<BarChart2 className="h-4 w-4" />} iconBg="bg-violet-50" iconColor="text-violet-600" title="Analitik Kelulusan" desc="SNBP & SPAN-PTKIN" />
            <QuickLink href="/dashboard/settings" icon={<Settings className="h-4 w-4" />} iconBg="bg-surface-3" iconColor="text-slate-500 dark:text-slate-400 dark:text-slate-500" title="Pengaturan Sistem" desc="Tahun ajaran & jurusan" />
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ title, value, sub, icon, iconBg, iconColor, href }: {
  title: string; value: number | string; sub: string
  icon: React.ReactNode; iconBg: string; iconColor: string; href: string
}) {
  return (
    <Link href={href} className="group flex flex-col gap-3 rounded-xl border border-surface bg-surface p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg ${iconBg} ${iconColor}`}>{icon}</div>
        <ArrowRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:text-slate-500 transition-colors" />
      </div>
      <div>
        <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-0.5 tracking-tight leading-none">{value}</p>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{sub}</p>
      </div>
    </Link>
  )
}

function LiveCell({ label, value, color, href, activeLabel }: {
  label: string; value: number; color: 'rose' | 'amber'; href: string; activeLabel: string
}) {
  const c = {
    rose:  { num: 'text-rose-600',  dot: 'bg-rose-400',  bg: 'bg-rose-50/40' },
    amber: { num: 'text-amber-600', dot: 'bg-amber-400', bg: 'bg-amber-50/40' },
  }[color]
  const active = value > 0
  return (
    <Link href={href} className={`flex flex-col gap-1.5 p-4 hover:bg-surface-2 transition-colors ${active ? c.bg : ''}`}>
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${active ? `${c.dot} animate-pulse` : 'bg-slate-200'}`} />
        <span className={`text-[10px] font-medium ${active ? c.num : 'text-slate-400 dark:text-slate-500'}`}>
          {active ? activeLabel : 'Tidak ada'}
        </span>
      </div>
      <p className={`text-2xl font-bold tracking-tight leading-none ${active ? c.num : 'text-slate-300 dark:text-slate-600'}`}>{value}</p>
      <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">{label}</p>
    </Link>
  )
}

function QuickLink({ href, icon, iconBg, iconColor, title, desc }: {
  href: string; icon: React.ReactNode; iconBg: string; iconColor: string; title: string; desc: string
}) {
  return (
    <Link href={href} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-2 transition-colors group">
      <div className={`p-1.5 rounded-md ${iconBg} ${iconColor} shrink-0`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-700 dark:text-slate-200">{title}</p>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{desc}</p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:text-slate-500 shrink-0 transition-colors" />
    </Link>
  )
}
