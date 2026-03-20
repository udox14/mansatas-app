// Lokasi: app/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import Link from 'next/link'
import {
  Users, UserCog, Library, ShieldAlert,
  TrendingUp, CalendarCheck, Clock, ArrowRight,
  GraduationCap, Sparkles
} from 'lucide-react'

export const metadata = { title: 'Dashboard - MANSATAS App' }

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()

  const [freshUser, taAktif] = await Promise.all([
    db.prepare('SELECT nama_lengkap, role, avatar_url FROM "user" WHERE id = ?').bind(user.id).first<any>(),
    db.prepare('SELECT nama, semester FROM tahun_ajaran WHERE is_active = 1').first<{ nama: string; semester: number }>(),
  ])

  const [jmlSiswa, jmlGuru, jmlKelas, pelanggaranRaw] = await Promise.all([
    db.prepare("SELECT COUNT(*) as c FROM siswa WHERE status = 'aktif'")
      .first<{ c: number }>().then((r: any) => r?.c ?? 0),
    db.prepare("SELECT COUNT(*) as c FROM \"user\" WHERE role IN ('guru','guru_bk','wakamad','kepsek','guru_piket')")
      .first<{ c: number }>().then((r: any) => r?.c ?? 0),
    db.prepare('SELECT COUNT(*) as c FROM kelas')
      .first<{ c: number }>().then((r: any) => r?.c ?? 0),
    db.prepare(`
      SELECT sp.id, sp.tanggal, sp.keterangan,
        s.nama_lengkap as siswa_nama,
        k.tingkat, k.nomor_kelas, k.kelompok,
        mp.nama_pelanggaran, mp.poin
      FROM siswa_pelanggaran sp
      JOIN siswa s ON sp.siswa_id = s.id
      LEFT JOIN kelas k ON s.kelas_id = k.id
      JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
      ORDER BY sp.created_at DESC LIMIT 5
    `).all<any>().then((r: any) => r.results)
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

  return (
    <div className="space-y-5 animate-in fade-in duration-500 pb-12">

      {/* WELCOME CARD — clean, shadcn-style */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex items-center gap-4 min-w-0">
          {/* Avatar */}
          <div className="relative h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center overflow-hidden shadow-sm">
            {avatarUrl
              ? <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              : <span className="text-lg font-bold text-white">{namaDepan.charAt(0).toUpperCase()}</span>
            }
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white" />
          </div>
          {/* Greeting */}
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-widest leading-none mb-1">{sapaan}</p>
            <h1 className="text-base font-semibold text-slate-900 leading-tight truncate">{namaLengkap}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md uppercase tracking-wide">
                {roleLabel[userRole] ?? userRole.replace('_', ' ')}
              </span>
              {taAktif && (
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <CalendarCheck className="h-3 w-3" />
                  TA {taAktif.nama} · Smt {taAktif.semester}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick action */}
        <Link
          href="/dashboard/settings/profile"
          className="shrink-0 text-xs font-medium text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-md transition-colors hidden sm:inline-flex items-center gap-1.5"
        >
          <UserCog className="h-3.5 w-3.5" /> Profil Saya
        </Link>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Siswa Aktif" value={jmlSiswa} icon={<Users className="h-4 w-4 text-blue-500" />} href="/dashboard/siswa" accent="blue" />
        <StatCard title="Guru & Pegawai" value={jmlGuru} icon={<UserCog className="h-4 w-4 text-emerald-500" />} href="/dashboard/guru" accent="emerald" />
        <StatCard title="Rombel" value={jmlKelas} icon={<Library className="h-4 w-4 text-amber-500" />} href="/dashboard/kelas" accent="amber" />
        <StatCard title="Analitik SNBP" value="PDSS" icon={<GraduationCap className="h-4 w-4 text-violet-500" />} href="/dashboard/akademik/analitik" accent="violet" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* RADAR KEDISIPLINAN */}
        <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-rose-50 rounded-md border border-rose-100">
                <ShieldAlert className="h-4 w-4 text-rose-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Radar Kedisiplinan</p>
                <p className="text-[11px] text-slate-400">5 pelanggaran terbaru</p>
              </div>
            </div>
            <Link
              href="/dashboard/kedisiplinan"
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
            >
              Lihat semua <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="p-4">
            {!pelanggaranRaw || pelanggaranRaw.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-3">
                <div className="p-3 bg-emerald-50 rounded-full">
                  <TrendingUp className="h-6 w-6 text-emerald-500" />
                </div>
                <p className="text-sm font-medium text-slate-600">Situasi aman terkendali</p>
                <p className="text-xs text-slate-400">Belum ada catatan pelanggaran.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pelanggaranRaw.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="h-8 w-8 shrink-0 rounded-lg bg-rose-50 border border-rose-100 flex flex-col items-center justify-center">
                      <span className="text-[9px] font-bold text-rose-400 leading-none">+{p.poin}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-800 truncate">{p.siswa_nama}</p>
                        <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(p.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <p className="text-xs text-rose-500 truncate">{p.nama_pelanggaran}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* AKSES CEPAT */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <p className="text-sm font-semibold text-slate-800">Akses Cepat</p>
          </div>
          <div className="p-3 space-y-1.5">
            <QuickLink href="/dashboard/kehadiran" icon={<CalendarCheck className="h-4 w-4 text-emerald-500" />} title="Jurnal & Kehadiran" desc="Isi absensi harian" />
            <QuickLink href="/dashboard/kedisiplinan" icon={<ShieldAlert className="h-4 w-4 text-rose-500" />} title="Lapor Pelanggaran" desc="Input kasus tata tertib" />
            <QuickLink href="/dashboard/izin" icon={<Clock className="h-4 w-4 text-amber-500" />} title="Perizinan Siswa" desc="Keluar komplek / jam kelas" />
          </div>
        </div>

      </div>
    </div>
  )
}

function StatCard({ title, value, icon, href, accent }: {
  title: string; value: number | string; icon: React.ReactNode; href: string; accent: string
}) {
  const accentMap: Record<string, string> = {
    blue: 'hover:border-blue-200',
    emerald: 'hover:border-emerald-200',
    amber: 'hover:border-amber-200',
    violet: 'hover:border-violet-200',
  }
  return (
    <Link href={href} className={`flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md ${accentMap[accent] ?? ''}`}>
      <div className="flex items-center justify-between">
        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">{icon}</div>
        <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
      </div>
      <div>
        <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold text-slate-800 mt-0.5 tracking-tight">{value}</p>
      </div>
    </Link>
  )
}

function QuickLink({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors group">
      <div className="p-1.5 rounded-md bg-slate-50 border border-slate-100 group-hover:border-slate-200 transition-colors shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-700">{title}</p>
        <p className="text-[11px] text-slate-400 truncate">{desc}</p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-slate-300 ml-auto shrink-0 group-hover:text-slate-400 transition-colors" />
    </Link>
  )
}
