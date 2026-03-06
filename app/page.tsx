// LOKASI: app/page.tsx
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/utils/supabase/server'
import { ArrowRight, LayoutDashboard, LogIn, Shield } from 'lucide-react'

export const metadata = {
  title: 'MANSATAS ERP - Sistem Manajemen MAN 1 Tasikmalaya',
  description: 'Portal Sistem Informasi Manajemen Terpadu MAN 1 Tasikmalaya.',
}

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans selection:bg-emerald-200 selection:text-emerald-900 relative">
      
      {/* =======================================================
          CSS ANIMASI GELOMBANG HALUS (AURORA MESH)
          ======================================================= */}
      <style>{`
        @keyframes wave-1 {
          0% { transform: translateY(0) translateX(0) scale(1) rotate(0deg); }
          33% { transform: translateY(-40px) translateX(80px) scale(1.05) rotate(5deg); }
          66% { transform: translateY(20px) translateX(-40px) scale(0.95) rotate(-5deg); }
          100% { transform: translateY(0) translateX(0) scale(1) rotate(0deg); }
        }
        @keyframes wave-2 {
          0% { transform: translateY(0) translateX(0) scale(1) rotate(0deg); }
          33% { transform: translateY(50px) translateX(-60px) scale(0.95) rotate(-5deg); }
          66% { transform: translateY(-30px) translateX(60px) scale(1.05) rotate(5deg); }
          100% { transform: translateY(0) translateX(0) scale(1) rotate(0deg); }
        }
        @keyframes wave-3 {
          0% { transform: translateY(0) translateX(0) scale(1); }
          50% { transform: translateY(-60px) translateX(40px) scale(1.1); }
          100% { transform: translateY(0) translateX(0) scale(1); }
        }
        .animate-wave-1 { animation: wave-1 20s ease-in-out infinite; }
        .animate-wave-2 { animation: wave-2 25s ease-in-out infinite; }
        .animate-wave-3 { animation: wave-3 18s ease-in-out infinite; }
      `}</style>

      {/* =======================================================
          BACKGROUND GELOMBANG MODERN (MATCHING LOGIN PAGE)
          ======================================================= */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
         {/* Blob Warna Emerald, Teal, dan Blue yang bergerak mengalun */}
         <div className="absolute top-[-10%] left-[-10%] w-[80vw] sm:w-[60vw] h-[60vh] bg-emerald-400/20 rounded-full filter blur-[120px] animate-wave-1" />
         <div className="absolute top-[20%] right-[-10%] w-[70vw] sm:w-[50vw] h-[70vh] bg-teal-400/20 rounded-full filter blur-[120px] animate-wave-2" />
         <div className="absolute bottom-[-20%] left-[10%] w-[90vw] sm:w-[70vw] h-[60vh] bg-blue-400/20 rounded-full filter blur-[120px] animate-wave-3" />
         
         {/* Pola Titik Enterprise yang sangat tipis di belakang */}
         <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '40px 40px', opacity: 0.2 }}></div>

         {/* Filter Kaca (Glassmorphism) tebal untuk menyatukan warna menjadi gelombang halus */}
         <div className="absolute inset-0 bg-white/40 backdrop-blur-[50px]"></div>
         
         {/* Gradasi pemudar agar ujung-ujungnya membaur sempurna dengan putih */}
         <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/60 to-slate-50"></div>
      </div>

      {/* NAVBAR: Fixed, Clean, & Minimalist */}
      <header className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200/60 transition-all shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logokemenag.png"
              alt="Logo Kemenag"
              width={44}
              height={44}
              className="h-11 w-auto drop-shadow-sm"
              priority
            />
            <div className="flex flex-col justify-center">
              <span className="font-extrabold text-lg tracking-tight text-slate-900 leading-none">
                MANSATAS <span className="font-medium text-slate-500">App</span>
              </span>
            </div>
          </div>
          
          <div className="hidden sm:block">
            {user ? (
               <Link href="/dashboard" className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 px-5 py-2.5 rounded-full font-bold text-sm transition-colors shadow-sm border border-slate-200/50">
               <LayoutDashboard className="h-4 w-4" /> Buka Dashboard
             </Link>
            ) : (
              <Link href="/login" className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-full font-bold text-sm shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5">
                <LogIn className="h-4 w-4" /> Masuk Portal
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* MAIN HERO: Ultra Clean, Typography Focused */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 pt-32 pb-20">
        
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
          
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/90 backdrop-blur-md border border-emerald-200 shadow-sm text-sm font-semibold text-slate-600 animate-in fade-in slide-in-from-bottom-4 duration-700">
             <Shield className="h-4 w-4 text-emerald-600" /> Enterprise Resource Planning v2.0
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold text-slate-900 tracking-tight leading-[1.15] mb-6 animate-in fade-in slide-in-from-bottom-6 duration-1000">
            Sistem Digitalisasi <br className="hidden md:block" />
            <span className="text-emerald-600">MAN 1 Tasikmalaya</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl leading-relaxed mb-12 font-medium animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150">
            Platform manajemen informasi sekolah yang dirancang eksklusif untuk menyederhanakan administrasi akademik, kedisiplinan, dan operasional harian secara presisi.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-300">
            {user ? (
              <Link href="/dashboard" className="h-14 px-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-2 font-bold text-lg shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:-translate-y-1 transition-all duration-300 border border-slate-800">
                Lanjutkan ke Dashboard <ArrowRight className="h-5 w-5" />
              </Link>
            ) : (
              <Link href="/login" className="h-14 px-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-2 font-bold text-lg shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:-translate-y-1 transition-all duration-300 border border-slate-800 w-full sm:w-auto">
                Masuk ke Sistem <ArrowRight className="h-5 w-5" />
              </Link>
            )}
          </div>
          
        </div>
      </main>

      {/* FOOTER: Minimalist */}
      <footer className="relative z-10 w-full py-8 border-t border-slate-200/60 bg-transparent text-center mt-auto">
        <p className="text-slate-500 text-sm font-semibold drop-shadow-sm">
          &copy; {new Date().getFullYear()} Hak Cipta Dilindungi &bull; MAN 1 Tasikmalaya
        </p>
      </footer>

    </div>
  )
}