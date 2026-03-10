// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import Link from 'next/link'
import { 
  Users, UserCog, Library, ShieldAlert, 
  TrendingUp, CalendarCheck, Clock, ArrowRight,
  GraduationCap, Activity, Sparkles, LayoutGrid
} from 'lucide-react'

export const metadata = { title: 'Dashboard - MANSATAS App' }

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  // getDB() adalah async dan tidak menerima argumen — dia ambil context sendiri
  const db = await getDB()

  const taAktif = await db.prepare(
    'SELECT nama, semester FROM tahun_ajaran WHERE is_active = 1'
  ).first<{ nama: string; semester: number }>()

  const [jmlSiswa, jmlGuru, jmlKelas, pelanggaranRaw] = await Promise.all([
    db.prepare("SELECT COUNT(*) as c FROM siswa WHERE status = 'aktif'")
      .first<{ c: number }>().then((r: any) => r?.c ?? 0),
    db.prepare("SELECT COUNT(*) as c FROM user WHERE role IN ('guru','guru_bk','wakamad','kepsek','guru_piket')")
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
  const sapaan = hour < 11 ? 'Selamat Pagi' : hour < 15 ? 'Selamat Siang' : hour < 18 ? 'Selamat Sore' : 'Selamat Malam'
  const namaDepan = ((user as any).nama_lengkap ?? user.name ?? 'Pengguna').split(' ')[0]
  const avatarUrl = (user as any).avatar_url ?? null
  const userRole = (user as any).role ?? ''

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-1000 pb-12 max-w-[1600px] mx-auto">

      {/* HEADER WELCOME */}
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-6 sm:p-8 lg:p-10 shadow-xl border border-slate-800">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[150%] bg-emerald-500/20 blur-[100px] rounded-full animate-pulse mix-blend-screen pointer-events-none" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[120%] bg-blue-600/20 blur-[90px] rounded-full animate-pulse mix-blend-screen pointer-events-none" style={{ animationDuration: '12s' }} />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-[10px] font-bold tracking-widest uppercase mb-4 text-emerald-300 shadow-sm">
              <CalendarCheck className="h-3 w-3" />
              TA: {taAktif?.nama || 'Belum Diatur'} &bull; SMT {taAktif?.semester || '-'}
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight mb-2.5 text-white">
              {sapaan}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 drop-shadow-sm">
                {namaDepan}!
              </span>
            </h1>
            <p className="text-slate-400 text-sm sm:text-base max-w-2xl font-medium leading-relaxed">
              Pusat komando digital <strong className="text-slate-200">MAN 1 Tasikmalaya</strong>. Pantau metrik akademik dan pergerakan kedisiplinan secara real-time.
            </p>
          </div>

          <div className="hidden md:flex items-center gap-4 bg-white/5 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-inner">
            <div className="relative h-14 w-14 rounded-xl bg-gradient-to-tr from-emerald-400 to-cyan-500 p-0.5 shadow-sm">
              <div className="h-full w-full rounded-xl bg-slate-900 flex items-center justify-center overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <UserCog className="h-6 w-6 text-emerald-400" />
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full animate-pulse"></div>
            </div>
            <div className="pr-2">
              <p className="font-bold text-white text-base leading-tight">{(user as any).nama_lengkap ?? user.name}</p>
              <p className="text-[10px] text-emerald-300 font-bold uppercase tracking-widest mt-1 bg-white/10 w-fit px-2 py-0.5 rounded-md">
                {userRole.replace('_', ' ')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* STATISTIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard title="Total Siswa Aktif" value={jmlSiswa} icon={<Users className="h-6 w-6 text-blue-600" />} bgIcon="bg-blue-100" theme="blue" href="/dashboard/siswa" />
        <StatCard title="Pegawai & Guru" value={jmlGuru} icon={<UserCog className="h-6 w-6 text-emerald-600" />} bgIcon="bg-emerald-100" theme="emerald" href="/dashboard/guru" />
        <StatCard title="Rombongan Belajar" value={jmlKelas} icon={<Library className="h-6 w-6 text-amber-600" />} bgIcon="bg-amber-100" theme="amber" href="/dashboard/kelas" />
        <StatCard title="Analitik Kelulusan" value="PDSS" icon={<GraduationCap className="h-6 w-6 text-purple-600" />} bgIcon="bg-purple-100" theme="purple" href="/dashboard/akademik/analitik" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 sm:gap-8">

        {/* RADAR KEDISIPLINAN */}
        <div className="xl:col-span-2 bg-white rounded-[2rem] p-6 sm:p-8 border border-slate-200/60 shadow-sm flex flex-col relative overflow-hidden">
          <Activity className="absolute -right-10 -top-10 h-64 w-64 text-slate-50 opacity-50 pointer-events-none rotate-12" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 relative z-10 gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 shadow-inner">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Radar Kedisiplinan</h2>
                <p className="text-xs font-semibold text-slate-500 mt-0.5 uppercase tracking-wider">5 Aktivitas Terkini</p>
              </div>
            </div>
            <Link href="/dashboard/kedisiplinan" className="group flex items-center justify-center gap-2 text-sm font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-4 py-2.5 rounded-xl transition-all border border-transparent hover:border-rose-200 w-full sm:w-auto">
              Lihat Semua <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="flex-1 overflow-x-auto relative z-10">
            {(!pelanggaranRaw || pelanggaranRaw.length === 0) ? (
              <div className="h-full min-h-[250px] flex flex-col items-center justify-center text-slate-400 space-y-4">
                <div className="p-5 bg-emerald-50 rounded-full ring-4 ring-emerald-50/50">
                  <TrendingUp className="h-10 w-10 text-emerald-500" />
                </div>
                <p className="font-bold text-slate-600 text-lg">Situasi Aman Terkendali</p>
                <p className="text-sm">Belum ada catatan pelanggaran yang dilaporkan.</p>
              </div>
            ) : (
              <div className="space-y-4 min-w-[500px]">
                {pelanggaranRaw.map((p: any) => (
                  <div key={p.id} className="group flex items-start gap-5 p-5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-md hover:border-rose-100 transition-all duration-300">
                    <div className="h-14 w-14 shrink-0 rounded-2xl bg-gradient-to-br from-rose-100 to-red-100 text-rose-700 flex flex-col items-center justify-center border border-rose-200 shadow-inner">
                      <span className="text-[10px] font-bold uppercase mb-[-2px] opacity-70">Poin</span>
                      <span className="font-black text-xl leading-none">+{p.poin}</span>
                    </div>
                    <div className="flex-1 pt-0.5">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-slate-800 text-base">{p.siswa_nama}</h4>
                        <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm shrink-0 ml-2">
                          <Clock className="h-3 w-3 text-slate-500" />
                          {new Date(p.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-rose-600 mb-2">{p.nama_pelanggaran}</p>
                      <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                        Kelas {p.tingkat}-{p.nomor_kelas} {p.kelompok !== 'UMUM' ? p.kelompok : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* AKSES CEPAT */}
        <div className="bg-slate-900 rounded-[2rem] p-6 sm:p-8 shadow-xl flex flex-col border border-slate-800 relative overflow-hidden">
          <LayoutGrid className="absolute -bottom-10 -right-10 h-64 w-64 text-white/5 rotate-12" />
          <div className="relative z-10 h-full flex flex-col">
            <div className="mb-6">
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2 mb-1">
                <Sparkles className="h-5 w-5 text-amber-400" /> Akses Cepat
              </h2>
              <p className="text-sm text-slate-400 font-medium">Menu operasional esensial madrasah.</p>
            </div>
            <div className="space-y-3.5 flex-1 flex flex-col justify-center">
              <QuickLink href="/dashboard/kehadiran" icon={<CalendarCheck className="h-5 w-5"/>} title="Jurnal & Kehadiran" desc="Isi absensi & jurnal kelas" color="text-emerald-400" hoverBg="hover:bg-emerald-500/10" hoverBorder="hover:border-emerald-500/30" />
              <QuickLink href="/dashboard/kedisiplinan" icon={<ShieldAlert className="h-5 w-5"/>} title="Lapor Pelanggaran" desc="Input kasus tata tertib" color="text-rose-400" hoverBg="hover:bg-rose-500/10" hoverBorder="hover:border-rose-500/30" />
              <QuickLink href="/dashboard/izin" icon={<Clock className="h-5 w-5"/>} title="Perizinan Siswa" desc="Siswa keluar komplek / kelas" color="text-amber-400" hoverBg="hover:bg-amber-500/10" hoverBorder="hover:border-amber-500/30" />
            </div>
            <div className="mt-8 pt-6 border-t border-slate-800/80 text-center">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sistem Terenkripsi & Terintegrasi</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

function StatCard({ title, value, icon, bgIcon, theme, href }: any) {
  const hoverColors: Record<string, string> = {
    blue: 'hover:border-blue-300 hover:shadow-blue-500/10',
    emerald: 'hover:border-emerald-300 hover:shadow-emerald-500/10',
    amber: 'hover:border-amber-300 hover:shadow-amber-500/10',
    purple: 'hover:border-purple-300 hover:shadow-purple-500/10'
  }
  return (
    <Link href={href} className={`relative overflow-hidden group bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between min-h-[130px] ${hoverColors[theme]}`}>
      <div className="flex justify-between items-start mb-3 relative z-10">
        <div className={`p-3 rounded-xl ${bgIcon} shadow-inner`}>{icon}</div>
        <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="relative z-10">
        <h3 className="text-slate-500 font-bold text-xs sm:text-sm tracking-wide">{title}</h3>
        <p className="text-2xl sm:text-3xl font-black text-slate-800 mt-0.5 tracking-tight">{value}</p>
      </div>
    </Link>
  )
}

function QuickLink({ href, icon, title, desc, color, hoverBg, hoverBorder }: any) {
  return (
    <Link href={href} className={`flex items-center p-3.5 sm:p-4 rounded-2xl bg-white/5 border border-white/10 transition-all duration-300 group ${hoverBg} ${hoverBorder}`}>
      <div className={`p-2.5 rounded-xl bg-white/10 ${color} mr-3 sm:mr-4 shadow-inner group-hover:scale-110 transition-transform duration-300`}>{icon}</div>
      <div className="flex-1">
        <h4 className="font-bold text-white text-sm sm:text-base">{title}</h4>
        <p className="text-[11px] sm:text-xs font-medium text-slate-400 mt-0.5">{desc}</p>
      </div>
    </Link>
  )
}