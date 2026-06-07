import Link from 'next/link'
import Image from 'next/image'
import { getAppSession } from '@/utils/auth/server'
import TypingHero from '@/components/shared/typing-hero'
import FeaturesDrawer from '@/components/shared/features-drawer'
import {
  ArrowRight,
  LayoutDashboard,
  LogIn,
  UsersRound,
  ShieldCheck,
  CalendarCheck2,
  ScanLine,
} from 'lucide-react'

export const metadata = {
  title: 'MANSATAS App',
  description: 'Ruang kerja digital MAN 1 Tasikmalaya untuk layanan madrasah yang lebih tertib, cepat, dan terukur.',
}

export const dynamic = 'force-dynamic'

export default async function LandingPage() {
  const session = await getAppSession()
  const isStaff = session?.kind === 'staff'
  const isParent = session?.kind === 'parent'
  const primaryHref = isParent ? '/portal-ortu' : isStaff ? '/dashboard' : '/login'
  const primaryLabel = isParent ? 'Buka Portal Orang Tua' : isStaff ? 'Buka Dashboard' : 'Masuk Dashboard'
  const PrimaryIcon = isParent || isStaff ? LayoutDashboard : LogIn

  return (
    <div className="h-[100dvh] w-screen overflow-hidden bg-[#fafcfa] text-slate-800 relative flex flex-col justify-between font-sans selection:bg-teal-100 selection:text-teal-900">
      
      {/* Custom Floating Animation Styles & Dot Grid Background */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes float-mockup {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(1deg); }
        }
        @keyframes blob-glow {
          0%, 100% { transform: scale(1) translate(0px, 0px); }
          33% { transform: scale(1.1) translate(30px, -40px); }
          66% { transform: scale(0.9) translate(-20px, 20px); }
        }
        .animate-float {
          animation: float-mockup 6s ease-in-out infinite;
        }
        .animate-blob-1 {
          animation: blob-glow 10s ease-in-out infinite;
        }
        .animate-blob-2 {
          animation: blob-glow 12s ease-in-out infinite alternate;
        }
        .bg-dots {
          background-image: radial-gradient(rgba(13, 148, 136, 0.06) 1.5px, transparent 1.5px);
          background-size: 24px 24px;
        }
      `}} />

      {/* Decorative Dot Grid Overlay */}
      <div className="absolute inset-0 bg-dots pointer-events-none z-10" />

      {/* Decorative Glowing Blur Blobs */}
      <div className="absolute -left-20 -top-20 w-96 h-96 rounded-full bg-teal-500/10 blur-[100px] pointer-events-none animate-blob-1 z-0" />
      <div className="absolute right-0 bottom-0 w-[500px] h-[500px] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none animate-blob-2 z-0" />
      <div className="absolute left-1/3 top-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-teal-500/5 blur-[100px] pointer-events-none z-0" />

      {/* Main Container */}
      <main className="relative z-20 flex-1 min-h-0 w-full max-w-7xl mx-auto px-5 sm:px-6 md:px-10 lg:px-12 flex items-center justify-center overflow-hidden py-3 sm:py-4 lg:py-0">
        
        {/* Responsive Grid */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-10 items-center">
          
          {/* Column Left: Brand / Title / Hero & Buttons */}
          <div className="lg:col-span-7 flex flex-col justify-center items-center lg:items-start text-center lg:text-left space-y-4 sm:space-y-5 lg:space-y-5 max-w-xl mx-auto lg:mx-0">

            {/* Brand Identity */}
            <div className="flex flex-col lg:flex-row items-center lg:items-center text-center lg:text-left gap-2.5 sm:gap-3">
              <div className="relative h-12 w-12 sm:h-14 sm:w-14 shrink-0 flex items-center justify-center transition-transform hover:scale-105 duration-300">
                <Image
                  src="/logokemenag.png"
                  alt="Logo Kemenag"
                  width={56}
                  height={56}
                  className="h-12 w-12 sm:h-14 sm:w-14 object-contain"
                  priority
                />
              </div>
              <div className="space-y-0.5 sm:space-y-1">
                <h2 className="text-xs sm:text-sm font-black tracking-[0.2em] text-teal-955 uppercase">
                  MAN 1 TASIKMALAYA
                </h2>
                <p className="text-[10px] sm:text-xs font-semibold text-slate-500 tracking-wide">
                  Kab. Tasikmalaya - Jawa Barat
                </p>
              </div>
            </div>

            {/* Main Heading & Typing Animation */}
            <div className="space-y-1.5 sm:space-y-2 w-full flex flex-col items-center lg:items-start">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-teal-950 whitespace-nowrap leading-none">
                MANSATAS <span className="text-slate-500 font-extrabold">App</span>
              </h1>
              <div className="text-sm sm:text-base lg:text-xl min-h-[1.7em] leading-relaxed text-slate-600 font-semibold px-2 lg:px-0 pt-0.5">
                <TypingHero />
              </div>
            </div>

            {/* Brief Description */}
            <p className="text-xs sm:text-sm leading-relaxed text-slate-500 font-medium max-w-md mx-auto lg:mx-0">
              Satu portal digital untuk mengelola administrasi, kegiatan akademik, kesiswaan, bimbingan konseling, keuangan, dan portal informasi langsung bagi wali murid.
            </p>

            {/* Action Buttons: Clean & Professional */}
            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 pt-0.5 justify-center lg:justify-start w-full max-w-md mx-auto lg:mx-0">
              {session ? (
                <Link
                  href={primaryHref}
                  className="inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-teal-700 px-6 text-sm font-extrabold text-white shadow-md shadow-teal-700/20 hover:bg-teal-800 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200"
                >
                  <PrimaryIcon className="h-4 w-4" />
                  <span>{primaryLabel}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <>
                  {/* Login Pegawai */}
                  <Link
                    href="/login"
                    className="inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2.5 rounded-xl bg-teal-700 px-6 text-sm font-extrabold text-white shadow-md shadow-teal-700/20 hover:bg-teal-800 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200"
                  >
                    <LogIn className="h-4.5 w-4.5" />
                    <span>Login Pegawai</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>

                  {/* Login Orang Tua */}
                  <Link
                    href="/portal-ortu/login"
                    className="inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2.5 rounded-xl bg-white border border-teal-200 px-6 text-sm font-extrabold text-teal-955 shadow-sm hover:bg-teal-50/50 hover:border-teal-400 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200"
                  >
                    <UsersRound className="h-4.5 w-4.5 text-teal-700" />
                    <span>Login Orang Tua</span>
                    <ArrowRight className="h-4 w-4 text-teal-505" />
                  </Link>
                </>
              )}
            </div>

            {/* Footer Features Link & Security badges */}
            <div className="flex flex-row items-center justify-between lg:justify-start gap-4 sm:gap-6 text-xs font-bold text-slate-500 pt-3 border-t border-slate-100 w-full max-w-md mx-auto lg:mx-0">
              <FeaturesDrawer />
              <div className="flex items-center gap-1.5 text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
                <span>Koneksi Aman</span>
              </div>
            </div>

          </div>

          {/* Column Right: High-Fidelity Mockup (Visible on Large Screens) */}
          <div className="hidden lg:col-span-5 lg:flex items-center justify-center relative select-none">
            
            {/* Phone Shell Wrapper */}
            <div className="relative w-full max-w-[280px] max-h-[calc(100dvh-7rem)] aspect-[9/18.5] bg-slate-950 rounded-[3rem] p-3 shadow-2xl border-4 border-slate-900/90 overflow-hidden animate-float">
              
              {/* Phone Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-6 bg-slate-950 rounded-b-2xl z-50 flex items-center justify-center">
                <div className="w-12 h-1 bg-slate-800 rounded-full" />
              </div>
              
              {/* Screen Interior Content */}
              <div className="w-full h-full bg-[#f9fbf6] rounded-[2.5rem] overflow-hidden flex flex-col justify-between p-4 pt-8 text-slate-800 relative">
                
                {/* Mock Header */}
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-1">
                    <Image src="/logokemenag.png" alt="Logo" width={14} height={14} />
                    <span className="text-[9px] font-black text-teal-950 tracking-tight">MANSATAS App</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-[7px] font-bold text-slate-400">Sinkron</span>
                  </div>
                </div>

                {/* Dashboard Widget Card */}
                <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 flex-1 flex flex-col justify-between max-h-[140px] mb-3">
                  <div>
                    <div className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">HARI INI</div>
                    <div className="text-xs font-black text-slate-900 mt-0.5">Layanan Presensi & Kelas</div>
                  </div>
                  
                  <div className="my-2 flex items-baseline gap-1">
                    <span className="text-2xl font-black text-teal-700">94.8%</span>
                    <span className="text-[7px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded">+1.2%</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 p-1 rounded-lg bg-teal-50/50">
                      <ScanLine className="h-2.5 w-2.5 text-teal-700" />
                      <div className="text-[7px] font-bold text-teal-950">1,240 Siswa Terabsen</div>
                    </div>
                  </div>
                </div>

                {/* Agenda Widget Card */}
                <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 flex-1 flex flex-col justify-between max-h-[120px] mb-3">
                  <div className="flex justify-between items-center mb-1">
                    <div className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">AGENDA</div>
                    <CalendarCheck2 className="h-3.5 w-3.5 text-teal-600" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-[9px] font-bold text-slate-800">Rapat Koordinasi TU</div>
                    <div className="text-[7px] font-semibold text-slate-400">Pukul 09.30 - Selesai</div>
                  </div>
                  <div className="mt-2 text-[7px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded w-fit">
                    18 Agenda Aktif
                  </div>
                </div>

                {/* Quick Info Card */}
                <div className="rounded-xl bg-teal-900 p-3 text-white shadow-sm flex flex-col justify-between mb-2">
                  <span className="text-[8px] font-bold text-teal-300">INFO MADRASAH</span>
                  <p className="text-[9px] font-medium leading-normal text-slate-100 mt-1">
                    Seluruh data terintegrasi antar guru piket, wali kelas, dan pimpinan secara real-time.
                  </p>
                </div>

                {/* Screen Bottom Menu */}
                <div className="pt-2 border-t border-slate-100 flex justify-around text-slate-400">
                  <div className="flex flex-col items-center gap-0.5 text-teal-700">
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    <span className="text-[7px] font-extrabold">Beranda</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <UsersRound className="h-3.5 w-3.5" />
                    <span className="text-[7px] font-extrabold">Wali</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span className="text-[7px] font-extrabold">Aman</span>
                  </div>
                </div>

              </div>

            </div>

          </div>

        </div>

      </main>

      {/* Screen Footer */}
      <footer className="relative z-30 shrink-0 py-2.5 sm:py-3 border-t border-slate-100 text-center text-[10px] font-bold text-slate-400">
        &copy; {new Date().getFullYear()} MAN 1 Tasikmalaya. Semua Hak Cipta Dilindungi.
      </footer>

    </div>
  )
}
