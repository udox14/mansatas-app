import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { 
  Users, UserCog, Library, ShieldAlert, 
  TrendingUp, CalendarCheck, Clock, ArrowRight,
  GraduationCap
} from 'lucide-react'

export const metadata = {
  title: 'Dashboard - MANSATAS App',
}

export default async function DashboardPage() {
  // 1. Inisialisasi Supabase (Async untuk Next 16)
  const supabase = await createClient()

  // 2. Cek Sesi User
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 3. Ambil Data Profil
  const { data: profile } = await supabase
    .from('profiles')
    .select('nama_lengkap, role, avatar_url')
    .eq('id', user.id)
    .single()

  // 4. Ambil Tahun Ajaran Aktif
  const { data: taAktif } = await supabase
    .from('tahun_ajaran')
    .select('nama, semester')
    .eq('is_active', true)
    .single()

  // 5. Fetch Statistik Paralel (Sangat Cepat karena hanya menghitung 'count', bukan mengambil semua baris)
  const [
    { count: jmlSiswa },
    { count: jmlGuru },
    { count: jmlKelas },
    { data: pelanggaranTerbaru }
  ] = await Promise.all([
    supabase.from('siswa').select('*', { count: 'exact', head: true }).eq('status', 'aktif'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).in('role', ['guru', 'guru_bk', 'wakamad', 'kepsek', 'guru_piket']),
    supabase.from('kelas').select('*', { count: 'exact', head: true }),
    supabase.from('siswa_pelanggaran')
      .select(`
        id, tanggal, keterangan,
        siswa(nama_lengkap, kelas(tingkat, nomor_kelas)),
        master_pelanggaran(nama_pelanggaran, poin)
      `)
      .order('created_at', { ascending: false })
      .limit(5)
  ])

  // Helper sapaan berdasarkan waktu
  const hour = new Date().getHours()
  const sapaan = hour < 11 ? 'Selamat Pagi' : hour < 15 ? 'Selamat Siang' : hour < 18 ? 'Selamat Sore' : 'Selamat Malam'

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      
      {/* HEADER WELCOME */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-8 sm:p-10 text-white shadow-xl relative overflow-hidden border border-slate-700/50">
        {/* Ornamen Latar */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 opacity-10">
          <HexagonPattern />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-bold tracking-wider uppercase mb-4 text-emerald-300">
              <CalendarCheck className="h-3.5 w-3.5" /> 
              TA: {taAktif?.nama || 'Belum Diatur'} ({taAktif?.semester || '-'})
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">
              {sapaan}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">{profile?.nama_lengkap.split(' ')[0]}!</span>
            </h1>
            <p className="text-slate-400 text-sm sm:text-base max-w-xl">
              Selamat datang di pusat kendali MANSATAS. Pantau perkembangan akademik dan kedisiplinan madrasah hari ini.
            </p>
          </div>
          
          <div className="hidden lg:flex items-center gap-4 bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
            <div className="h-14 w-14 rounded-full bg-gradient-to-tr from-emerald-400 to-blue-500 p-1">
              <div className="h-full w-full rounded-full bg-slate-900 flex items-center justify-center overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <UserCog className="h-6 w-6 text-emerald-400" />
                )}
              </div>
            </div>
            <div>
              <p className="font-bold text-white leading-tight">{profile?.nama_lengkap}</p>
              <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider">{profile?.role.replace('_', ' ')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* STATISTIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard 
          title="Total Siswa Aktif" 
          value={jmlSiswa || 0} 
          icon={<Users className="h-6 w-6 text-blue-500" />} 
          bg="bg-blue-50" border="border-blue-100" text="text-blue-600"
          href="/dashboard/siswa"
        />
        <StatCard 
          title="Guru & Tenaga Pendidik" 
          value={jmlGuru || 0} 
          icon={<UserCog className="h-6 w-6 text-emerald-500" />} 
          bg="bg-emerald-50" border="border-emerald-100" text="text-emerald-600"
          href="/dashboard/guru"
        />
        <StatCard 
          title="Total Rombongan Belajar" 
          value={jmlKelas || 0} 
          icon={<Library className="h-6 w-6 text-amber-500" />} 
          bg="bg-amber-50" border="border-amber-100" text="text-amber-600"
          href="/dashboard/kelas"
        />
        <StatCard 
          title="Pusat Akademik & PDSS" 
          value="Akses" 
          icon={<GraduationCap className="h-6 w-6 text-purple-500" />} 
          bg="bg-purple-50" border="border-purple-100" text="text-purple-600"
          href="/dashboard/akademik"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 sm:gap-8">
        {/* AKTIVITAS PELANGGARAN TERBARU (KIRI - LEBIH LEBAR) */}
        <div className="xl:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/60 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-100 text-rose-600 rounded-xl">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">Pelanggaran Kedisiplinan Terbaru</h2>
            </div>
            <Link href="/dashboard/kedisiplinan" className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
              Lihat Semua <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="flex-1 overflow-x-auto custom-scrollbar">
            {(!pelanggaranTerbaru || pelanggaranTerbaru.length === 0) ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 py-10">
                <div className="p-4 bg-emerald-50 rounded-full"><TrendingUp className="h-8 w-8 text-emerald-400" /></div>
                <p className="font-medium text-slate-500 text-sm">Alhamdulillah, belum ada catatan pelanggaran.</p>
              </div>
            ) : (
              <div className="space-y-4 min-w-[500px]">
                {pelanggaranTerbaru.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 shrink-0 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center font-black text-sm border border-rose-100">
                        +{p.master_pelanggaran.poin}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{p.siswa?.nama_lengkap}</p>
                        <p className="text-sm text-rose-600 font-medium">{p.master_pelanggaran?.nama_pelanggaran}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-600 uppercase">
                            {p.siswa?.kelas?.tingkat}-{p.siswa?.kelas?.nomor_kelas}
                          </span>
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="h-3 w-3" /> 
                            {new Date(p.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* PINTASAN CEPAT (KANAN) */}
        <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-md flex flex-col justify-between border border-slate-800 relative overflow-hidden">
           <div className="absolute -bottom-10 -right-10 text-white/5">
             <Library className="h-64 w-64" />
           </div>
           
           <div className="relative z-10">
            <h2 className="text-lg font-bold text-white mb-2">Akses Cepat</h2>
            <p className="text-sm text-slate-400 mb-6">Menu operasional harian yang paling sering digunakan.</p>
            
            <div className="space-y-3">
              <QuickLink href="/dashboard/kehadiran" icon={<CalendarCheck className="h-5 w-5"/>} title="Jurnal & Kehadiran" desc="Catat absensi kelas hari ini" color="text-emerald-400" />
              <QuickLink href="/dashboard/kedisiplinan" icon={<ShieldAlert className="h-5 w-5"/>} title="Lapor Pelanggaran" desc="Input poin tata tertib" color="text-rose-400" />
              <QuickLink href="/dashboard/plotting" icon={<Users className="h-5 w-5"/>} title="Plotting Kelas" desc="Manajemen mutasi rombel" color="text-blue-400" />
            </div>
           </div>
        </div>
      </div>

    </div>
  )
}

// --- KOMPONEN BANTUAN ---

function StatCard({ title, value, icon, bg, border, text, href }: any) {
  return (
    <Link href={href} className="group block bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm hover:shadow-md hover:border-slate-300 transition-all overflow-hidden relative">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl ${bg} ${text} ${border} border`}>
          {icon}
        </div>
        <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-slate-600 transition-colors group-hover:translate-x-1" />
      </div>
      <div>
        <h3 className="text-slate-500 font-semibold text-sm">{title}</h3>
        <p className="text-3xl font-black text-slate-800 mt-1 group-hover:scale-105 origin-left transition-transform">{value}</p>
      </div>
    </Link>
  )
}

function QuickLink({ href, icon, title, desc, color }: any) {
  return (
    <Link href={href} className="flex items-center p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group">
      <div className={`p-2 rounded-xl bg-white/10 ${color} mr-4 group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <div>
        <h4 className="font-bold text-white text-sm">{title}</h4>
        <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
      </div>
    </Link>
  )
}

function HexagonPattern() {
  return (
    <svg width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-white">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
    </svg>
  )
}