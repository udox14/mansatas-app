// UBAH FILE INI
// Lokasi: app/dashboard/page.tsx
import { createClient } from '@/utils/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, GraduationCap, CalendarCheck, AlertTriangle } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  // Ambil data profil untuk personalisasi sapaan
  const { data: profile } = await supabase
    .from('profiles')
    .select('nama_lengkap, role')
    .eq('id', user?.id)
    .single()

  const namaLengkap = profile?.nama_lengkap || 'Pengguna'
  const userRole = profile?.role?.replace('_', ' ') || 'Wali Murid'

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Welcome Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-bold tracking-tight mb-2">
            Selamat datang kembali, {namaLengkap}! 👋
          </h2>
          <p className="text-blue-100 max-w-2xl text-lg">
            Anda masuk sebagai <span className="font-semibold uppercase tracking-wider text-white">{userRole}</span>. 
            Berikut adalah ringkasan informasi terkini di MANSATAS App hari ini.
          </p>
        </div>
        {/* Dekorasi Background */}
        <div className="absolute right-0 top-0 -mt-16 -mr-16 h-64 w-64 rounded-full bg-white opacity-10 blur-3xl"></div>
        <div className="absolute right-32 bottom-0 -mb-16 h-40 w-40 rounded-full bg-blue-400 opacity-20 blur-2xl"></div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-sm ring-1 ring-slate-100 transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-600">Total Siswa Aktif</CardTitle>
            <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">1,482</div>
            <p className="text-xs text-slate-500 mt-1">
              <span className="text-emerald-500 font-medium">↑ 12</span> siswa baru bulan ini
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm ring-1 ring-slate-100 transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-600">Total Guru & Staf</CardTitle>
            <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-indigo-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">145</div>
            <p className="text-xs text-slate-500 mt-1">
              Terdiri dari 110 Guru & 35 Staf
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm ring-1 ring-slate-100 transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-600">Kehadiran Hari Ini</CardTitle>
            <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center">
              <CalendarCheck className="h-5 w-5 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">98.2%</div>
            <p className="text-xs text-slate-500 mt-1">
              <span className="text-rose-500 font-medium">↓ 0.5%</span> dari hari kemarin
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm ring-1 ring-slate-100 transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-600">Pelanggaran Aktif</CardTitle>
            <div className="h-10 w-10 rounded-full bg-rose-50 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">24</div>
            <p className="text-xs text-slate-500 mt-1">
              Butuh tindak lanjut Guru BK
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Info Tambahan (Bisa diisi tabel ringkasan nanti) */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-1 border-none shadow-sm ring-1 ring-slate-100">
          <CardHeader>
            <CardTitle className="text-lg text-slate-800">Pengumuman Sekolah</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50">
              <p className="text-sm text-slate-500">Belum ada pengumuman terbaru.</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="col-span-1 border-none shadow-sm ring-1 ring-slate-100">
          <CardHeader>
            <CardTitle className="text-lg text-slate-800">Aktivitas Terakhir</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50">
              <p className="text-sm text-slate-500">Log aktivitas akan muncul di sini.</p>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  )
}