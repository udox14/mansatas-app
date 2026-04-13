// Lokasi: app/page.tsx
import Link from 'next/link'
import Image from 'next/image'
import { getCurrentUser } from '@/utils/auth/server'
import { ArrowRight, LayoutDashboard, LogIn, Sparkles, UserCheck, CalendarDays, BarChart3, Fingerprint } from 'lucide-react'

export const metadata = {
  title: 'MANSATAS App',
  description: 'Sistem Informasi Manajemen Terpadu MAN 1 Tasikmalaya.',
}

export const dynamic = 'force-dynamic'

export default async function LandingPage() {
  const user = await getCurrentUser()

  return (
    <div className="min-h-[100dvh] bg-[#FCFCFD] font-sans relative overflow-x-hidden selection:bg-blue-200 selection:text-blue-900 flex flex-col">
      
      <style>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(2deg); }
        }
        @keyframes float-fast {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(-2deg); }
        }
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob { animation: blob 10s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
        .card-float-1 { animation: float-slow 6s ease-in-out infinite; }
        .card-float-2 { animation: float-fast 5s ease-in-out infinite; }
        .card-float-3 { animation: float-slow 7s ease-in-out infinite; animation-delay: 1s; }
        
        .glass-pill {
          background: rgba(255, 255, 255, 0.6);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.8);
          box-shadow: 0 4px 30px rgba(0, 0, 0, 0.03);
        }
        .glass-card {
          background: rgba(255, 255, 255, 0.75);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 1);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.6);
        }
        .mesh-bg {
          background-color: #f8fafc;
          background-image: 
            radial-gradient(at 10% 20%, hsla(210,100%,94%,1) 0px, transparent 50%),
            radial-gradient(at 80% 0%, hsla(189,100%,92%,1) 0px, transparent 50%),
            radial-gradient(at 0% 50%, hsla(41,100%,92%,1) 0px, transparent 50%),
            radial-gradient(at 80% 50%, hsla(210,100%,95%,1) 0px, transparent 50%),
            radial-gradient(at 20% 90%, hsla(189,100%,90%,1) 0px, transparent 50%),
            radial-gradient(at 70% 90%, hsla(41,100%,95%,1) 0px, transparent 50%);
        }
      `}</style>

      {/* Dynamic Mesh Background */}
      <div className="absolute inset-0 z-0 mesh-bg opacity-70"></div>
      
      {/* Animated Light Blobs */}
      <div className="absolute top-0 right-10 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute top-0 right-40 w-72 h-72 bg-cyan-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-amber-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>

      {/* Floating Pill Header */}
      <header className="fixed top-6 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl z-50 transition-all duration-300">
        <div className="h-16 glass-pill rounded-full flex items-center justify-between px-3 sm:px-4">
          <div className="flex items-center gap-3 pl-2">
            <div className="relative w-9 h-9 flex-shrink-0 bg-white rounded-full shadow-sm flex items-center justify-center p-1.5">
              <Image src="/logokemenag.png" alt="MAN 1 Tasikmalaya" width={36} height={36} className="w-full h-full object-contain drop-shadow-sm" priority />
            </div>
            <div className="flex flex-col justify-center hidden sm:flex">
              <span className="font-extrabold text-[15px] tracking-tight text-slate-900 leading-none">MANSATAS</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50/50 text-[11px] font-bold text-blue-700 tracking-wide uppercase mr-2 border border-blue-100">
              <Fingerprint className="w-3.5 h-3.5" /> Portal Resmi
            </span>
            {user ? (
               <Link href="/dashboard" className="group flex items-center gap-2 bg-[#0F172A] hover:bg-slate-800 text-white px-5 py-2.5 rounded-full font-bold text-xs sm:text-sm transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5">
                <LayoutDashboard className="h-4 w-4 transition-transform group-hover:scale-110" /> 
                <span>Buka Dashboard</span>
              </Link>
            ) : (
              <Link href="/login" className="group flex items-center gap-2 bg-[#0F172A] hover:bg-slate-800 text-white px-6 py-2.5 rounded-full font-bold text-xs sm:text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
                <LogIn className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /> 
                <span>Masuk Portal</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Asymmetrical Layout */}
      <main className="relative z-10 flex-1 flex items-center pt-28 pb-16 lg:pt-0 lg:pb-0">
        <div className="max-w-[1400px] w-full mx-auto px-6 sm:px-10 lg:px-16 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center min-h-[85vh]">
          
          {/* LEFT: Typography & Context */}
          <div className="lg:col-span-5 flex flex-col items-start text-left pt-12 lg:pt-0">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm text-xs font-bold text-slate-700 mb-8 animate-in fade-in slide-in-from-left-4 duration-700">
               <Sparkles className="h-4 w-4 text-amber-500" /> Platform Edukasi Terpadu v2.0
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-[72px] font-[900] text-slate-900 tracking-[-0.03em] leading-[1.05] mb-6 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-150">
              MANSATAS <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-cyan-500 inline-block pb-2">
                App
              </span>
            </h1>

            <p className="text-lg text-slate-600 leading-relaxed mb-10 max-w-xl font-medium animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
              Transformasi digital madrasah modern secara mutlak. Kelola administrasi, asrama, bimbingan, hingga kedisiplinan dalam satu ekosistem presisi bebas hambatan.
            </p>

            <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-4 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-500">
              {user ? (
                <Link href="/dashboard" className="h-14 px-8 rounded-2xl bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white flex items-center justify-center gap-2 font-bold text-[15px] shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40 hover:-translate-y-1 transition-all duration-300 border border-blue-500/50">
                  Kembali ke Dashboard <ArrowRight className="h-5 w-5" />
                </Link>
              ) : (
                <Link href="/login" className="group h-14 px-10 rounded-2xl bg-[#0F172A] hover:bg-slate-800 text-white flex items-center justify-center gap-3 font-bold text-[15px] shadow-lg shadow-slate-900/20 hover:shadow-xl hover:shadow-slate-900/30 hover:-translate-y-1 transition-all duration-300">
                  Mulai Gunakan <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
              )}
            </div>

            <div className="mt-12 flex items-center gap-4 animate-in fade-in duration-1000 delay-700">
              <div className="flex -space-x-2">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center">
                    <UserCheck className="w-4 h-4 text-slate-400" />
                  </div>
                ))}
              </div>
              <p className="text-xs font-semibold text-slate-500">
                Dipercaya seluruh pendidik <br/> <strong className="text-slate-800">MAN 1 Tasikmalaya</strong>
              </p>
            </div>
          </div>

          {/* RIGHT: Visual Abstraction (Glass Cards) */}
          <div className="lg:col-span-7 relative h-full min-h-[400px] sm:min-h-[500px] lg:min-h-0 w-full flex items-center justify-center pointer-events-none perspective-1000">
            {/* Center Main Card */}
            <div className="absolute z-30 w-72 sm:w-80 glass-card rounded-3xl p-6 card-float-1 border-white/60">
               <div className="flex items-center justify-between mb-6">
                 <div className="w-12 h-12 rounded-xl bg-blue-100/80 flex items-center justify-center">
                   <BarChart3 className="w-6 h-6 text-blue-600" />
                 </div>
                 <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full uppercase tracking-wider">Live</span>
               </div>
               <div className="space-y-3">
                 <div className="h-3 w-1/3 bg-slate-200/80 rounded-full" />
                 <div className="h-2 w-3/4 bg-slate-100 rounded-full" />
                 <div className="pt-4 grid grid-cols-2 gap-3">
                   <div className="h-16 rounded-2xl bg-blue-50/60 border border-blue-100/50" />
                   <div className="h-16 rounded-2xl bg-cyan-50/60 border border-cyan-100/50" />
                 </div>
               </div>
            </div>

            {/* Left Overlapping Card */}
            <div className="absolute z-20 w-64 glass-card rounded-3xl p-5 card-float-2 -left-4 sm:left-4 lg:-left-12 top-10 sm:top-20 opacity-90 rotate-[-4deg]">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-100/80 flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <div className="h-2.5 w-20 bg-slate-200/80 rounded-full mb-2" />
                  <div className="h-2 w-12 bg-slate-100 rounded-full" />
                </div>
              </div>
              <div className="space-y-2">
                 <div className="h-2 w-full bg-slate-100 rounded-full" />
                 <div className="h-2 w-4/5 bg-slate-100 rounded-full" />
              </div>
            </div>

            {/* Right Overlapping Card */}
            <div className="absolute z-40 w-56 glass-card rounded-2xl p-4 card-float-3 right-0 sm:right-10 lg:-right-4 bottom-10 sm:bottom-20 opacity-95 rotate-[3deg]">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100/80 flex items-center justify-center shrink-0">
                  <CalendarDays className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="w-full space-y-2 pt-1">
                  <div className="h-2 w-full bg-slate-200/80 rounded-full" />
                  <div className="h-2 w-2/3 bg-slate-100 rounded-full" />
                  <div className="h-2 w-1/2 bg-slate-100 rounded-full" />
                </div>
              </div>
            </div>
            
            {/* Background Decor Elements */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-[1px] border-slate-200/60 rounded-full border-dashed animate-[spin_60s_linear_infinite]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 border-[1px] border-slate-200/40 rounded-full border-solid" />
          </div>

        </div>
      </main>

    </div>
  )
}
