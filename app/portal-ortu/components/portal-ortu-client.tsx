'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, BookOpenCheck, CalendarDays, GraduationCap, House, MessageCircle, Wallet, AlertOctagon, Settings, LogOut, CheckCircle2, XCircle, AlertTriangle, ShieldAlert, ChevronRight } from 'lucide-react'
import { MobileBottomNav } from './mobile-bottom-nav'
import { ScheduleTabs } from './schedule-tabs'
import { ChangePasswordForm } from './change-password-form'
import { SummonResponseForm } from './summon-response-form'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

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

  const StandardCard = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
    <div className={`bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 ${className}`}>
      {children}
    </div>
  )

  const renderBeranda = () => (
    <motion.div
      key="beranda"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="space-y-5 pb-24 sm:pb-8"
    >
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 rounded-[28px] p-6 sm:p-8 text-white shadow-md overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <GraduationCap className="w-48 h-48 -mt-12 -mr-12" />
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <button className="absolute top-4 right-4 w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors z-20 border border-white/10">
              <Settings className="w-4 h-4 text-white" />
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md rounded-2xl p-0 border-0 overflow-hidden bg-white">
            <DialogHeader className="p-6 pb-4 border-b border-slate-100">
              <DialogTitle className="text-lg font-semibold text-slate-800">Pengaturan Akun</DialogTitle>
            </DialogHeader>
            <div className="p-6 bg-slate-50">
              <ChangePasswordForm />
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex flex-col sm:flex-row sm:items-center gap-5 relative z-10">
          <div className="relative shrink-0">
            <div className="w-20 aspect-[3/4] rounded-xl border-2 border-white/20 bg-slate-800 flex items-center justify-center overflow-hidden shadow-inner">
              {profil.foto_url ? (
                <img src={profil.foto_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-slate-400">{initialLetter}</span>
              )}
            </div>
          </div>
          
          <div className="flex-1">
            <p className="text-slate-400 text-xs font-medium tracking-wide uppercase mb-1">Portal Orang Tua</p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2 pr-8">
              {profil.nama_lengkap}
            </h1>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="bg-white/10 border border-white/20 text-slate-100 px-3 py-1 rounded-md text-xs font-medium">
                Kelas {kelasLabel}
              </span>
              <span className="bg-white/10 border border-white/20 text-slate-100 px-3 py-1 rounded-md text-xs font-medium">
                NISN {profil.nisn}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Wali Kelas */}
        <div className="col-span-2 sm:col-span-1">
          <StandardCard className="h-full flex flex-col justify-between hover:border-sky-200 transition-colors">
            <div className="flex items-start gap-4">
              <div className="bg-sky-50 text-sky-600 p-3 rounded-xl">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-0.5">Wali Kelas</p>
                <h3 className="text-sm font-semibold text-slate-800 leading-tight">
                  {waliKelasRow?.nama_lengkap || 'Belum diatur'}
                </h3>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              {waUrl ? (
                <a href={waUrl} target="_blank" className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100 transition-colors">
                  <MessageCircle className="h-4 w-4" /> Hubungi via WhatsApp
                </a>
              ) : (
                <span className="inline-block text-xs font-medium text-slate-400">Kontak tidak tersedia</span>
              )}
            </div>
          </StandardCard>
        </div>

        {/* Quick Stats */}
        <div className="col-span-2 sm:col-span-1 grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-emerald-100 p-4 flex flex-col items-center justify-center text-center shadow-sm">
            <span className="text-2xl font-bold text-emerald-600">{absensiRekap?.hadir || 0}</span>
            <span className="text-[11px] font-medium text-slate-500 mt-1">Kehadiran</span>
          </div>
          <div className="bg-white rounded-2xl border border-rose-100 p-4 flex flex-col items-center justify-center text-center shadow-sm">
            <span className="text-2xl font-bold text-rose-600">{disiplinRekap?.total_poin || 0}</span>
            <span className="text-[11px] font-medium text-slate-500 mt-1">Poin Min</span>
          </div>
          <div className="col-span-2 bg-white rounded-2xl border border-amber-100 p-4 flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[11px] font-medium text-slate-500 block mb-0.5">Sakit & Izin</span>
              <p className="text-lg font-bold text-amber-600">{(absensiRekap?.sakit || 0) + (absensiRekap?.izin || 0)} <span className="text-xs font-medium text-slate-500">hari</span></p>
            </div>
            <div className="p-2 bg-amber-50 rounded-lg text-amber-500">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Critical Notifications / Summons */}
      {(summons.results?.length > 0 || notifications.results?.length > 0) && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide ml-1">Peringatan Penting</h2>
          
          {(summons.results || []).map((s: any) => (
            <div key={s.id} className="bg-rose-50 border border-rose-200 rounded-2xl p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-rose-100 text-rose-700 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md">Panggilan Wali</span>
                <span className="text-rose-600 text-[10px] font-medium uppercase tracking-wider">{s.status}</span>
              </div>
              <h3 className="text-lg font-semibold text-rose-900 mb-2">{s.reason}</h3>
              <div className="bg-white/60 rounded-xl p-3 mb-4 text-sm font-medium text-slate-700">
                <p className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-slate-400"/> {s.event_date || '-'} {s.event_time || ''}</p>
                {s.location && <p className="flex items-center gap-2 mt-1"><House className="w-4 h-4 text-slate-400"/> {s.location}</p>}
              </div>
              {s.note && <p className="text-sm text-slate-600 mb-4">{s.note}</p>}
              <div className="bg-white rounded-xl p-2 border border-rose-100 shadow-sm">
                <SummonResponseForm summonId={s.id} status={s.status} />
              </div>
            </div>
          ))}

          {(notifications.results || []).map((n: any) => (
             <StandardCard key={n.id} className={`border-l-4 ${n.level === 'critical' ? 'border-l-rose-500' : n.level === 'warning' ? 'border-l-amber-500' : 'border-l-sky-500'}`}>
               <div className="flex gap-4">
                 <div className={`mt-0.5 shrink-0 p-2 rounded-lg ${
                   n.level === 'critical' ? 'bg-rose-50 text-rose-600' : n.level === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-sky-50 text-sky-600'
                 }`}>
                   <Bell className="h-4 w-4" />
                 </div>
                 <div>
                   <h3 className="text-sm font-semibold text-slate-800">{n.title}</h3>
                   <p className="text-sm text-slate-600 mt-1">{n.message}</p>
                 </div>
               </div>
             </StandardCard>
          ))}
        </div>
      )}

      {/* Announcements */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-3 ml-1">
          <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Pengumuman Sekolah</h2>
        </div>
        
        <div className="space-y-3">
          {(pengumumanRows.results || []).length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
              <p className="text-sm text-slate-500">Tidak ada pengumuman terbaru.</p>
            </div>
          ) : (pengumumanRows.results || []).map((item: any) => (
            <StandardCard key={item.id} className="group hover:shadow-md transition-shadow">
              <p className="text-[11px] font-medium text-slate-400 mb-1.5">{item.publish_at}</p>
              <h3 className="text-base font-semibold text-slate-800 mb-2">{item.title}</h3>
              <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{item.body}</p>
            </StandardCard>
          ))}
        </div>
      </div>
    </motion.div>
  )

  const renderJadwal = () => (
    <motion.div
      key="jadwal"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="space-y-5 pb-24 sm:pb-8"
    >
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Jadwal Pelajaran</h1>
          <p className="text-sm text-slate-500 mt-1">Pantau rutinitas kelas harian.</p>
        </div>
        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400">
          <CalendarDays className="h-6 w-6" />
        </div>
      </div>

      <div>
        <ScheduleTabs jadwalByDay={jadwalObject as any} />
      </div>
    </motion.div>
  )

  const renderKehadiran = () => (
    <motion.div
      key="kehadiran"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="space-y-5 pb-24 sm:pb-8"
    >
      {/* Kehadiran Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-3 bg-white rounded-2xl border border-emerald-100 p-6 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Total Kehadiran</p>
            <h2 className="text-3xl font-bold text-emerald-600">{absensiRekap?.hadir || 0} <span className="text-base font-medium text-emerald-600/60">hari</span></h2>
          </div>
          <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          </div>
        </div>

        <div className="col-span-1 bg-white rounded-2xl border border-amber-100 p-4 shadow-sm flex flex-col items-center justify-center text-center">
          <p className="text-xs font-medium text-slate-500 mb-2">Izin</p>
          <span className="text-xl font-bold text-amber-600">{absensiRekap?.izin || 0}</span>
        </div>
        <div className="col-span-1 bg-white rounded-2xl border border-amber-100 p-4 shadow-sm flex flex-col items-center justify-center text-center">
          <p className="text-xs font-medium text-slate-500 mb-2">Sakit</p>
          <span className="text-xl font-bold text-amber-600">{absensiRekap?.sakit || 0}</span>
        </div>
        <div className="col-span-1 bg-white rounded-2xl border border-rose-100 p-4 shadow-sm flex flex-col items-center justify-center text-center">
          <p className="text-xs font-medium text-slate-500 mb-2">Tanpa Ket.</p>
          <span className="text-xl font-bold text-rose-600">{absensiRekap?.alfa || 0}</span>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide ml-1">Riwayat Kehadiran Terkini</h2>
        <StandardCard className="p-0 overflow-hidden">
          {(absensiTerbaru.results || []).length === 0 ? (
            <p className="text-sm text-slate-500 p-6 text-center">Belum ada catatan kehadiran.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {(absensiTerbaru.results || []).map((r: any, i: number) => {
                const isHadir = r.status === 'HADIR';
                return (
                  <div key={i} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
                    <div className={`p-2 rounded-full ${
                      isHadir ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500'
                    }`}>
                      {isHadir ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-slate-800">{r.status}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{r.tanggal}</p>
                    </div>
                    {r.catatan && (
                      <div className="text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded">
                        {r.catatan}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </StandardCard>
      </div>

      <div className="pt-4 mt-4 border-t border-slate-200">
        <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide ml-1 mb-3">Catatan Kedisiplinan</h2>
        
        <div className="bg-slate-800 rounded-2xl p-6 text-white shadow-md flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-1">Total Poin Min</p>
            <p className="text-3xl font-bold text-rose-400">{disiplinRekap?.total_poin || 0}</p>
          </div>
          <div className="text-right">
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-1">Kasus Tercatat</p>
            <p className="text-xl font-semibold text-white">{disiplinRekap?.total_kasus || 0}</p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {(disiplinRiwayat.results || []).map((r: any, i: number) => (
            <StandardCard key={i} className="flex gap-4 items-start border-l-4 border-l-rose-500">
              <div className="bg-rose-50 text-rose-600 font-bold text-sm px-3 py-1.5 rounded-lg shrink-0">
                +{r.poin}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-800">{r.nama_pelanggaran}</h4>
                <p className="text-xs text-slate-500 mt-1">{r.tanggal} · {r.kategori}</p>
                {r.keterangan && <p className="text-sm text-slate-600 mt-2 bg-slate-50 rounded-lg p-3 border border-slate-100">{r.keterangan}</p>}
              </div>
            </StandardCard>
          ))}
        </div>
      </div>
    </motion.div>
  )

  const renderNilai = () => (
    <motion.div
      key="nilai"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="space-y-5 pb-24 sm:pb-8"
    >
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 text-center">
        <div className="w-12 h-12 bg-indigo-50 text-indigo-500 mx-auto rounded-full flex items-center justify-center mb-4">
          <GraduationCap className="h-6 w-6" />
        </div>
        <p className="text-slate-500 text-sm font-medium mb-1">Rata-rata Nilai Keseluruhan</p>
        <h1 className="text-4xl font-bold text-slate-800">{semesterAvg ?? '-'}</h1>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide ml-1">Rata-rata Per Semester</h2>
        <div className="grid grid-cols-2 gap-3">
          {semesters.map((s: any) => {
            const isFilled = s.value !== null && s.value !== undefined
            return (
              <div key={s.label} className={`rounded-xl border p-4 flex flex-col items-center justify-center text-center transition-all ${
                isFilled 
                  ? 'bg-white border-slate-200 shadow-sm' 
                  : 'bg-slate-50 border-slate-100 border-dashed'
              }`}>
                <span className="text-xs font-medium text-slate-500 mb-2">{s.label}</span>
                <span className={`text-2xl font-bold ${isFilled ? 'text-indigo-600' : 'text-slate-300'}`}>
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="space-y-5 pb-24 sm:pb-8"
    >
      <div className="space-y-4">
        {/* Card for DSPT */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Wallet className="w-32 h-32 -mr-8 -mt-8" />
          </div>
          <div className="relative z-10 flex flex-col h-full justify-between gap-6">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                 <span className="p-1.5 bg-slate-100 rounded-md"><Wallet className="w-4 h-4 text-slate-600" /></span>
                 Dana Sumbangan Pendidikan (DSPT)
              </span>
            </div>
            
            <div>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">Sisa Tagihan</p>
              <p className="text-2xl font-bold text-rose-600">Rp {rupiah(dsptSisa)}</p>
            </div>
            
            <div className="flex justify-between items-end border-t border-slate-100 pt-4 mt-2">
              <div>
                <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wide">Target</p>
                <p className="text-sm font-semibold text-slate-700 mt-0.5">Rp {rupiah(dsptTarget)}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wide">Lunas</p>
                <p className="text-sm font-semibold text-emerald-600 mt-0.5">Rp {rupiah(dsptBayar + dsptDiskon)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* SPP Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative overflow-hidden">
          <div className="relative z-10 flex flex-col h-full justify-between gap-6">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-slate-800">SPP Bulanan</span>
              <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded uppercase tracking-wide">Tahun Berjalan</span>
            </div>
            
            <div className="flex items-end justify-between bg-slate-50 border border-slate-100 p-4 rounded-xl">
              <div>
                <p className="text-slate-500 text-[10px] font-medium uppercase tracking-wide mb-1">Total Tagihan</p>
                <p className="text-lg font-bold text-slate-800">Rp {rupiah(sppNominal)}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-500 text-[10px] font-medium uppercase tracking-wide mb-1">Sisa</p>
                <p className="text-xl font-bold text-rose-600">Rp {rupiah(sppSisa)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-2">
        <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide ml-1 mb-3">Riwayat Pembayaran Terakhir</h2>
        <div className="space-y-3">
          {(transaksiTerbaru.results || []).length === 0 ? (
            <div className="text-center py-6 bg-white border border-slate-200 border-dashed rounded-2xl">
              <p className="text-sm text-slate-500">Belum ada transaksi terekam.</p>
            </div>
          ) : (transaksiTerbaru.results || []).map((t: any, i: number) => (
            <StandardCard key={`${t.nomor_kuitansi}-${i}`} className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-full text-emerald-500 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">{t.kategori}</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">{t.created_at.split(' ')[0]} • {t.metode_bayar}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-800">Rp {rupiah(Number(t.jumlah_total || 0))}</p>
              </div>
            </StandardCard>
          ))}
        </div>
      </div>
    </motion.div>
  )

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 [font-family:'Plus_Jakarta_Sans',ui-sans-serif,system-ui]">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
        h1, h2, h3, h4, .font-semibold, .font-bold { font-family: 'Plus Jakarta Sans', sans-serif; }
      `}} />
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-[260px] border-r border-slate-200 bg-white z-40 flex-col py-6 overflow-y-auto">
        <div className="flex items-center px-6 mb-8 gap-3">
          <img src="/logokemenag.png" alt="Kemenag" className="h-8 w-auto object-contain" />
          <h2 className="text-xl text-slate-800 tracking-tight"><span className="font-bold">MANSATAS</span> <span className="font-medium text-slate-500">App</span></h2>
        </div>
        
        <nav className="flex flex-col gap-1 px-4 flex-1">
          <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 mt-4">Menu Orang Tua</p>
          {[
            { id: 'beranda', label: 'Beranda', Icon: House },
            { id: 'jadwal', label: 'Jadwal Kelas', Icon: CalendarDays },
            { id: 'kehadiran', label: 'Kehadiran', Icon: BookOpenCheck },
            { id: 'nilai', label: 'Akademik', Icon: GraduationCap },
            { id: 'keuangan', label: 'Keuangan', Icon: Wallet },
          ].map(({ id, label, Icon }) => {
            const isActive = activeTab === id
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-slate-900 text-white shadow-sm' 
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            )
          })}
        </nav>
        
        <div className="px-4 pt-6 mt-6 border-t border-slate-100">
          <form action="/api/auth/sign-out" method="post">
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors">
              <LogOut className="h-4 w-4" />
              Keluar
            </button>
          </form>
        </div>
      </aside>

      <main className="md:ml-[260px] min-h-screen flex flex-col">
        {/* Top Header Mobile */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-5 py-4 flex items-center justify-between md:hidden">
          <div className="flex items-center gap-3">
            <img src="/logokemenag.png" alt="Kemenag" className="h-7 w-auto object-contain" />
            <p className="text-lg text-slate-800 tracking-tight"><span className="font-bold">MANSATAS</span> <span className="font-medium text-slate-500">App</span></p>
          </div>
          
          <div className="flex items-center gap-1">
            <button className="relative w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors">
              <Bell className="h-5 w-5" />
              {(notifications.results?.length > 0 || summons.results?.length > 0) && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 border-2 border-white" />
              )}
            </button>
            <form action="/api/auth/sign-out" method="post">
              <button className="w-10 h-10 rounded-full hover:bg-rose-50 flex items-center justify-center text-rose-500 transition-colors">
                <LogOut className="h-5 w-5" />
              </button>
            </form>
          </div>
        </header>

        {/* Content Box */}
        <div className="flex-1 w-full max-w-3xl mx-auto p-4 sm:p-8 pt-6">
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
