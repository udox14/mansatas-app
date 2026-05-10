'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, BookOpenCheck, CalendarDays, GraduationCap, House, MessageCircle, Wallet, AlertOctagon, Info, ChevronRight, CheckCircle2, XCircle, AlertTriangle, ShieldAlert } from 'lucide-react'
import { MobileBottomNav } from './mobile-bottom-nav'
import { ScheduleTabs } from './schedule-tabs'
import { ChangePasswordForm } from './change-password-form'
import { SummonResponseForm } from './summon-response-form'

function rupiah(v: number) {
  return new Intl.NumberFormat('id-ID').format(v || 0)
}

export function PortalOrtuClient({ data }: { data: any }) {
  const [activeTab, setActiveTab] = useState('beranda')

  const {
    profil,
    kelasLabel,
    waliKelasRow,
    waUrl,
    pengumumanRows,
    absensiRekap,
    absensiTerbaru,
    disiplinRekap,
    disiplinRiwayat,
    semesters,
    semesterAvg,
    dsptTarget,
    dsptBayar,
    dsptDiskon,
    dsptSisa,
    sppNominal,
    sppBayar,
    sppSisa,
    transaksiTerbaru,
    notifications,
    summons,
    notes,
    jadwalObject,
  } = data

  const initialLetter = String(profil.nama_lengkap || 'S').slice(0, 1)

  // Duolingo-style Chunky Button
  const ChunkyButton = ({ children, color = 'emerald', className = '', onClick }: any) => {
    const colors: Record<string, string> = {
      emerald: 'bg-emerald-500 border-emerald-600 text-white',
      rose: 'bg-rose-500 border-rose-600 text-white',
      sky: 'bg-sky-400 border-sky-500 text-white',
      amber: 'bg-amber-400 border-amber-500 text-amber-950',
      slate: 'bg-slate-200 border-slate-300 text-slate-700',
    }
    const c = colors[color] || colors.emerald
    return (
      <button 
        onClick={onClick}
        className={`relative inline-flex items-center justify-center font-bold rounded-2xl border-b-[6px] active:border-b-0 active:translate-y-[6px] transition-all px-5 py-3 ${c} ${className}`}
      >
        {children}
      </button>
    )
  }

  // Duolingo-style Chunky Card
  const ChunkyCard = ({ children, color = 'white', className = '' }: any) => {
    const colors: Record<string, string> = {
      white: 'bg-white border-slate-200',
      emerald: 'bg-emerald-50 border-emerald-200',
      rose: 'bg-rose-50 border-rose-200',
      sky: 'bg-sky-50 border-sky-200',
      amber: 'bg-amber-50 border-amber-200',
      indigo: 'bg-indigo-50 border-indigo-200',
    }
    const c = colors[color] || colors.white
    return (
      <div className={`rounded-[28px] border-2 border-b-[6px] p-5 lg:p-6 ${c} ${className}`}>
        {children}
      </div>
    )
  }

  const renderBeranda = () => (
    <motion.div
      key="beranda"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", bounce: 0.4, duration: 0.6 }}
      className="space-y-6 pb-24 sm:pb-8"
    >
      {/* Hero Section */}
      <div className="relative pt-6">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-sky-400 rounded-[36px] rotate-1 scale-[1.02] opacity-20 -z-10" />
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-[36px] p-6 text-white shadow-lg border-4 border-white/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 relative z-10">
            <div className="relative">
              <div className="h-24 w-24 rounded-full border-4 border-white bg-white flex items-center justify-center overflow-hidden shadow-xl shrink-0">
                {profil.foto_url ? (
                  <img src={profil.foto_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-4xl font-black text-emerald-600">{initialLetter}</span>
                )}
              </div>
              <div className="absolute -bottom-2 -right-2 bg-amber-400 text-amber-950 text-[10px] font-black px-3 py-1 rounded-full border-2 border-white shadow-sm uppercase tracking-wider">
                Siswa
              </div>
            </div>
            
            <div className="flex-1">
              <p className="text-emerald-100 font-bold tracking-widest uppercase text-xs mb-1">Halo, Orang Tua dari</p>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight mb-2">
                {profil.nama_lengkap}
              </h1>
              <div className="flex flex-wrap gap-2">
                <span className="bg-black/20 text-white px-3 py-1 rounded-xl text-xs font-bold backdrop-blur-sm">
                  Kelas {kelasLabel}
                </span>
                <span className="bg-black/20 text-white px-3 py-1 rounded-xl text-xs font-bold backdrop-blur-sm">
                  NISN {profil.nisn}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Wali Kelas & Quick Action */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 sm:col-span-1">
          <ChunkyCard color="sky" className="h-full flex flex-col justify-between group">
            <div>
              <div className="bg-sky-200 text-sky-700 w-10 h-10 rounded-2xl flex items-center justify-center mb-3">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold text-sky-600 uppercase tracking-wider">Wali Kelas</p>
              <h3 className="text-lg font-black text-slate-800 mt-1 leading-tight">
                {waliKelasRow?.nama_lengkap || 'Belum diatur'}
              </h3>
            </div>
            <div className="mt-4">
              {waUrl ? (
                <a href={waUrl} target="_blank" className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border-b-4 border-sky-600 bg-sky-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-400 hover:border-sky-500 active:border-b-0 active:translate-y-1 transition-all">
                  <MessageCircle className="h-4 w-4" /> Hubungi
                </a>
              ) : (
                <span className="inline-block text-xs font-bold text-sky-600/50">Kontak tidak tersedia</span>
              )}
            </div>
          </ChunkyCard>
        </div>

        {/* Quick Stats Mini */}
        <div className="col-span-2 sm:col-span-1 grid grid-cols-2 gap-4">
          <div className="rounded-[24px] bg-emerald-100 border-2 border-b-[4px] border-emerald-200 p-4 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-black text-emerald-700">{absensiRekap?.hadir || 0}</span>
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mt-1">Hadir</span>
          </div>
          <div className="rounded-[24px] bg-rose-100 border-2 border-b-[4px] border-rose-200 p-4 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-black text-rose-700">{disiplinRekap?.total_poin || 0}</span>
            <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mt-1">Poin Min</span>
          </div>
          <div className="col-span-2 rounded-[24px] bg-amber-100 border-2 border-b-[4px] border-amber-200 p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Sakit/Izin</span>
              <p className="text-xl font-black text-amber-900">{(absensiRekap?.sakit || 0) + (absensiRekap?.izin || 0)} <span className="text-xs font-bold text-amber-600">hari</span></p>
            </div>
            <div className="w-10 h-10 bg-amber-200 text-amber-700 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Critical Notifications / Summons */}
      {(summons.results?.length > 0 || notifications.results?.length > 0) && (
        <div className="space-y-4">
          <h2 className="text-lg font-black text-slate-800 ml-2">Perhatian Penting</h2>
          
          {(summons.results || []).map((s: any) => (
            <div key={s.id} className="relative overflow-hidden rounded-[28px] bg-rose-500 text-white border-4 border-rose-600 p-5 shadow-sm">
              <div className="absolute -right-4 -top-4 opacity-20">
                <AlertOctagon className="w-32 h-32" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-white text-rose-600 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg">Panggilan Wali</span>
                  <span className="text-rose-100 text-[10px] font-bold uppercase tracking-wider">{s.status}</span>
                </div>
                <h3 className="text-xl font-black mb-2">{s.reason}</h3>
                <div className="bg-rose-600/50 rounded-2xl p-3 mb-4 text-sm font-bold backdrop-blur-sm">
                  <p>📅 {s.event_date || '-'} {s.event_time || ''}</p>
                  {s.location && <p>📍 {s.location}</p>}
                </div>
                {s.note && <p className="text-sm font-medium mb-4">{s.note}</p>}
                <div className="bg-white rounded-2xl p-2">
                  <SummonResponseForm summonId={s.id} status={s.status} />
                </div>
              </div>
            </div>
          ))}

          {(notifications.results || []).map((n: any) => (
             <ChunkyCard key={n.id} color={n.level === 'critical' ? 'rose' : n.level === 'warning' ? 'amber' : 'sky'}>
               <div className="flex gap-4">
                 <div className={`mt-1 shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center ${
                   n.level === 'critical' ? 'bg-rose-200 text-rose-700' : n.level === 'warning' ? 'bg-amber-200 text-amber-700' : 'bg-sky-200 text-sky-700'
                 }`}>
                   <Bell className="h-5 w-5" />
                 </div>
                 <div>
                   <h3 className="text-base font-black text-slate-800">{n.title}</h3>
                   <p className="text-sm font-medium text-slate-600 mt-1">{n.message}</p>
                 </div>
               </div>
             </ChunkyCard>
          ))}
        </div>
      )}

      {/* Announcements */}
      <div>
        <div className="flex items-center justify-between mb-4 ml-2">
          <h2 className="text-lg font-black text-slate-800">Pengumuman</h2>
          <span className="bg-slate-200 text-slate-600 text-[10px] font-black px-2 py-1 rounded-lg uppercase">
            {(pengumumanRows.results || []).length} Baru
          </span>
        </div>
        
        <div className="space-y-4">
          {(pengumumanRows.results || []).length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-[28px]">
              <p className="text-sm font-bold text-slate-400">Belum ada pengumuman.</p>
            </div>
          ) : (pengumumanRows.results || []).map((item: any) => (
            <div key={item.id} className="group relative bg-white rounded-[24px] border-2 border-slate-200 p-5 hover:border-sky-300 transition-colors">
              <div className="absolute left-0 top-6 bottom-6 w-1.5 bg-sky-300 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">{item.publish_at}</p>
              <h3 className="text-base font-black text-slate-800">{item.title}</h3>
              <p className="text-sm font-medium text-slate-600 whitespace-pre-line mt-2">{item.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-6 border-t-2 border-slate-200 border-dashed">
        <h2 className="text-lg font-black text-slate-800 ml-2 mb-4">Pengaturan</h2>
        <ChangePasswordForm />
        <div className="mt-4">
          <form action="/api/auth/sign-out" method="post">
            <button className="w-full rounded-[20px] border-2 border-rose-200 bg-rose-50 px-5 py-4 text-sm font-black text-rose-600 hover:bg-rose-100 hover:border-rose-300 transition-colors flex items-center justify-center gap-2">
              <XCircle className="h-5 w-5" /> Keluar dari Aplikasi
            </button>
          </form>
        </div>
      </div>
    </motion.div>
  )

  const renderJadwal = () => (
    <motion.div
      key="jadwal"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", bounce: 0.4, duration: 0.6 }}
      className="space-y-6 pb-24 sm:pb-8"
    >
      <div className="bg-sky-100 rounded-[32px] p-6 border-2 border-sky-200">
        <div className="w-12 h-12 bg-sky-500 rounded-2xl flex items-center justify-center text-white mb-4 rotate-3 shadow-sm border-b-4 border-sky-600">
          <CalendarDays className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-black text-sky-900">Jadwal Kelas</h1>
        <p className="text-sm font-bold text-sky-700/80 mt-1">Pantau rutinitas akademik harian anak.</p>
      </div>

      <div className="pt-2">
        <ScheduleTabs jadwalByDay={jadwalObject as any} />
      </div>
    </motion.div>
  )

  const renderKehadiran = () => (
    <motion.div
      key="kehadiran"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", bounce: 0.4, duration: 0.6 }}
      className="space-y-6 pb-24 sm:pb-8"
    >
      {/* Kehadiran Header */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 bg-emerald-500 rounded-[32px] p-6 text-white border-b-[8px] border-emerald-700 flex items-center justify-between overflow-hidden relative">
          <div className="absolute right-0 top-0 opacity-10">
            <BookOpenCheck className="w-48 h-48 -mr-10 -mt-10" />
          </div>
          <div className="relative z-10">
            <p className="text-emerald-100 font-bold uppercase tracking-widest text-xs">Total Kehadiran</p>
            <h2 className="text-5xl font-black mt-1 tracking-tighter">{absensiRekap?.hadir || 0} <span className="text-xl font-bold text-emerald-200">hari</span></h2>
          </div>
          <div className="w-16 h-16 bg-white/20 rounded-[20px] flex items-center justify-center backdrop-blur-sm relative z-10 rotate-6">
            <CheckCircle2 className="h-8 w-8 text-white" />
          </div>
        </div>

        <div className="bg-amber-100 rounded-[28px] border-2 border-b-[4px] border-amber-200 p-5 flex flex-col justify-between">
          <p className="text-amber-700 font-bold uppercase tracking-widest text-[10px]">Izin & Sakit</p>
          <div className="mt-2 flex items-end justify-between">
            <span className="text-3xl font-black text-amber-900">{(absensiRekap?.sakit || 0) + (absensiRekap?.izin || 0)}</span>
            <div className="w-8 h-8 bg-amber-200 rounded-xl flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
            </div>
          </div>
        </div>

        <div className="bg-rose-100 rounded-[28px] border-2 border-b-[4px] border-rose-200 p-5 flex flex-col justify-between">
          <p className="text-rose-700 font-bold uppercase tracking-widest text-[10px]">Tanpa Keterangan</p>
          <div className="mt-2 flex items-end justify-between">
            <span className="text-3xl font-black text-rose-900">{absensiRekap?.alfa || 0}</span>
            <div className="w-8 h-8 bg-rose-200 rounded-xl flex items-center justify-center">
              <XCircle className="h-4 w-4 text-rose-700" />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-black text-slate-800 ml-2">Riwayat Terkini</h2>
        <div className="bg-white rounded-[32px] border-2 border-slate-200 p-2">
          {(absensiTerbaru.results || []).length === 0 ? (
            <p className="text-sm font-bold text-slate-400 p-6 text-center">Belum ada catatan absensi.</p>
          ) : (absensiTerbaru.results || []).map((r: any, i: number) => {
            const isHadir = r.status === 'HADIR';
            return (
              <div key={i} className="flex items-center gap-4 p-3 rounded-[24px] hover:bg-slate-50 transition-colors">
                <div className={`w-12 h-12 rounded-[18px] shrink-0 flex items-center justify-center border-b-4 ${
                  isHadir ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : 'bg-amber-100 text-amber-600 border-amber-200'
                }`}>
                  {isHadir ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-black text-slate-800">{r.status}</h4>
                  <p className="text-xs font-bold text-slate-400 mt-0.5">{r.tanggal}</p>
                </div>
                {r.catatan && (
                  <div className="max-w-[120px] bg-slate-100 rounded-xl p-2 text-[10px] font-bold text-slate-500">
                    {r.catatan}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="pt-4 border-t-2 border-dashed border-slate-200">
        <h2 className="text-lg font-black text-slate-800 ml-2 mb-4">Kedisiplinan & Poin</h2>
        
        <div className="bg-slate-900 rounded-[32px] p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-slate-800 rounded-full blur-2xl -mr-10 -mt-10" />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-1">Total Poin Min</p>
              <p className="text-4xl font-black text-rose-400 tracking-tighter">{disiplinRekap?.total_poin || 0}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-1">Tercatat</p>
              <p className="text-2xl font-black text-white">{disiplinRekap?.total_kasus || 0} <span className="text-xs text-slate-500">kasus</span></p>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {(disiplinRiwayat.results || []).map((r: any, i: number) => (
            <div key={i} className="bg-rose-50 rounded-[24px] border-2 border-rose-100 p-4 flex gap-4 items-start">
              <div className="bg-rose-200 text-rose-700 font-black text-lg px-3 py-2 rounded-xl shrink-0 -rotate-2 border-b-4 border-rose-300">
                +{r.poin}
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-800">{r.nama_pelanggaran}</h4>
                <p className="text-[11px] font-bold text-slate-500 mt-1 uppercase">{r.tanggal} · {r.kategori}</p>
                {r.keterangan && <p className="text-[13px] font-medium text-slate-700 mt-2 bg-white rounded-xl p-2 border border-rose-100">{r.keterangan}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )

  const renderNilai = () => (
    <motion.div
      key="nilai"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", bounce: 0.4, duration: 0.6 }}
      className="space-y-6 pb-24 sm:pb-8"
    >
      <div className="bg-indigo-500 rounded-[36px] p-6 text-white border-b-[8px] border-indigo-700 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-indigo-800/20 to-transparent" />
        <div className="relative z-10">
          <div className="w-16 h-16 bg-white/20 mx-auto rounded-full flex items-center justify-center backdrop-blur-sm mb-4">
            <GraduationCap className="h-8 w-8 text-white" />
          </div>
          <p className="text-indigo-200 font-bold uppercase tracking-widest text-xs">Nilai Rata-rata Total</p>
          <h1 className="text-6xl font-black tracking-tighter mt-2">{semesterAvg ?? '-'}</h1>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-black text-slate-800 ml-2">Per Semester</h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {semesters.map((s: any, idx: number) => {
            const isFilled = s.value !== null && s.value !== undefined
            return (
              <div key={s.label} className={`rounded-[28px] border-2 border-b-[6px] p-5 flex flex-col items-center justify-center text-center transition-all ${
                isFilled 
                  ? 'bg-white border-indigo-200 hover:border-indigo-400 hover:-translate-y-1' 
                  : 'bg-slate-50 border-slate-200 opacity-70'
              }`}>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">{s.label}</span>
                <span className={`text-3xl font-black ${isFilled ? 'text-indigo-700' : 'text-slate-300'}`}>
                  {s.value ?? '-'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </motion.div>
  )

  const renderKeuangan = () => (
    <motion.div
      key="keuangan"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", bounce: 0.4, duration: 0.6 }}
      className="space-y-6 pb-24 sm:pb-8"
    >
      <div className="space-y-5">
        {/* Credit Card Style for DSPT */}
        <div className="bg-gradient-to-tr from-slate-900 to-slate-800 rounded-[32px] p-6 text-white shadow-xl relative overflow-hidden border-t border-slate-700">
          <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-full blur-xl -mr-10 -mt-10" />
          <div className="absolute bottom-4 right-4 text-slate-700 font-black text-6xl opacity-30 select-none">DSPT</div>
          
          <div className="relative z-10 flex flex-col h-full justify-between gap-8">
            <div className="flex justify-between items-start">
              <div className="w-12 h-8 bg-amber-200/20 rounded-md border border-amber-200/30 flex items-center justify-center">
                <Wallet className="h-4 w-4 text-amber-200" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Dana Tahunan</span>
            </div>
            
            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Sisa Tagihan</p>
              <p className="text-3xl font-black tracking-tight text-rose-300">Rp {rupiah(dsptSisa)}</p>
            </div>
            
            <div className="flex justify-between items-end border-t border-slate-700/50 pt-4">
              <div>
                <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">Target</p>
                <p className="text-sm font-bold mt-0.5">Rp {rupiah(dsptTarget)}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">Lunas</p>
                <p className="text-sm font-bold mt-0.5 text-emerald-400">Rp {rupiah(dsptBayar + dsptDiskon)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* SPP Card */}
        <div className="bg-gradient-to-tr from-sky-500 to-indigo-500 rounded-[32px] p-6 text-white shadow-lg relative overflow-hidden border-b-4 border-indigo-700">
          <div className="absolute left-0 bottom-0 w-32 h-32 bg-white/10 rounded-full blur-xl -ml-10 -mb-10" />
          
          <div className="relative z-10 flex flex-col h-full justify-between gap-6">
            <div className="flex justify-between items-center">
              <span className="text-lg font-black tracking-tight">SPP Bulanan</span>
              <span className="text-[10px] font-bold bg-white/20 px-3 py-1 rounded-full uppercase tracking-wider">Berjalan</span>
            </div>
            
            <div className="flex items-end justify-between bg-white/10 p-4 rounded-2xl backdrop-blur-md">
              <div>
                <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest mb-1">Total Tagihan</p>
                <p className="text-xl font-black">Rp {rupiah(sppNominal)}</p>
              </div>
              <div className="text-right">
                <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest mb-1">Sisa</p>
                <p className="text-2xl font-black text-rose-200">Rp {rupiah(sppSisa)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-2">
        <h2 className="text-lg font-black text-slate-800 ml-2 mb-4">Riwayat Pembayaran</h2>
        <div className="space-y-3">
          {(transaksiTerbaru.results || []).length === 0 ? (
            <p className="text-sm font-bold text-slate-400 text-center py-6 border-2 border-dashed border-slate-200 rounded-[24px]">Belum ada transaksi.</p>
          ) : (transaksiTerbaru.results || []).map((t: any, i: number) => (
            <div key={`${t.nomor_kuitansi}-${i}`} className="bg-white rounded-[24px] border-2 border-slate-200 p-4 flex items-center justify-between group hover:border-emerald-300 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-[16px] text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800">{t.kategori}</h4>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">{t.created_at.split(' ')[0]} · {t.metode_bayar}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-base font-black text-emerald-600">Rp {rupiah(Number(t.jumlah_total || 0))}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-900 [font-family:'Plus_Jakarta_Sans',ui-sans-serif,system-ui] selection:bg-emerald-200">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800;900&display=swap');
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
        h1, h2, h3, h4, .font-black { font-family: 'Plus Jakarta Sans', sans-serif; }
      `}} />
      
      {/* Desktop Sidebar (Adjusted for pastel/Duolingo theme) */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-[280px] border-r-2 border-slate-200 bg-white z-40 flex-col p-6 overflow-y-auto">
        <div className="flex items-center gap-3 mb-10">
          <div className="h-12 w-12 rounded-[20px] bg-emerald-500 border-b-4 border-emerald-700 flex items-center justify-center text-white">
            <House className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Portal Ortu</h2>
        </div>
        
        <nav className="flex flex-col gap-3">
          {[
            { id: 'beranda', label: 'Beranda', Icon: House, color: 'emerald' },
            { id: 'jadwal', label: 'Jadwal', Icon: CalendarDays, color: 'sky' },
            { id: 'kehadiran', label: 'Kehadiran', Icon: BookOpenCheck, color: 'amber' },
            { id: 'nilai', label: 'Nilai', Icon: GraduationCap, color: 'indigo' },
            { id: 'keuangan', label: 'Keuangan', Icon: Wallet, color: 'rose' },
          ].map(({ id, label, Icon, color }) => {
            const isActive = activeTab === id
            const colorMap: any = {
              emerald: isActive ? 'bg-emerald-100 text-emerald-700 border-emerald-300 border-b-4' : 'text-slate-500 hover:bg-slate-100 border-transparent',
              sky: isActive ? 'bg-sky-100 text-sky-700 border-sky-300 border-b-4' : 'text-slate-500 hover:bg-slate-100 border-transparent',
              amber: isActive ? 'bg-amber-100 text-amber-700 border-amber-300 border-b-4' : 'text-slate-500 hover:bg-slate-100 border-transparent',
              indigo: isActive ? 'bg-indigo-100 text-indigo-700 border-indigo-300 border-b-4' : 'text-slate-500 hover:bg-slate-100 border-transparent',
              rose: isActive ? 'bg-rose-100 text-rose-700 border-rose-300 border-b-4' : 'text-slate-500 hover:bg-slate-100 border-transparent',
            }
            
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-4 px-5 py-4 rounded-[24px] font-bold transition-all border-2 ${colorMap[color]}`}
              >
                <Icon className="h-6 w-6" strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[15px]">{label}</span>
              </button>
            )
          })}
        </nav>
      </aside>

      <main className="md:ml-[280px] min-h-screen flex flex-col">
        {/* Top Header Mobile */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b-2 border-slate-200 px-5 py-4 flex items-center justify-between md:hidden">
          <div className="flex items-center gap-3">
             <div className="relative h-11 w-11 overflow-hidden rounded-[18px] border-2 border-emerald-200 bg-emerald-100 flex items-center justify-center">
               {profil.foto_url ? (
                <img src={profil.foto_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg font-black text-emerald-600">{initialLetter}</span>
              )}
            </div>
            <p className="text-lg font-black text-slate-800">Portal Ortu</p>
          </div>
          <button className="relative h-11 w-11 rounded-[18px] bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors border-2 border-transparent">
            <Bell className="h-6 w-6" />
            {(notifications.results?.length > 0 || summons.results?.length > 0) && (
              <span className="absolute right-2 top-2 h-3 w-3 rounded-full bg-rose-500 border-2 border-white" />
            )}
          </button>
        </header>

        {/* Content Box */}
        <div className="flex-1 w-full max-w-2xl mx-auto p-4 sm:p-8 pt-6">
          <AnimatePresence mode="wait">
            {activeTab === 'beranda' && renderBeranda()}
            {activeTab === 'jadwal' && renderJadwal()}
            {activeTab === 'kehadiran' && renderKehadiran()}
            {activeTab === 'nilai' && renderNilai()}
            {activeTab === 'keuangan' && renderKeuangan()}
          </AnimatePresence>
        </div>
      </main>

      <MobileBottomNav activeTab={activeTab} onChange={setActiveTab} />
    </div>
  )
}
