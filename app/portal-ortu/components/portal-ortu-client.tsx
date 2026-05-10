'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, BookOpenCheck, CalendarDays, GraduationCap, House, MessageCircle, Wallet, Image as ImageIcon } from 'lucide-react'
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

  // Duolingo-style card components
  const Card = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
    <div className={`rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  )

  const Title = ({ children }: { children: React.ReactNode }) => (
    <h2 className="text-base font-bold text-slate-800 tracking-tight [font-family:'Quicksand',ui-sans-serif]">{children}</h2>
  )

  const renderBeranda = () => (
    <motion.div
      key="beranda"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="space-y-5 pb-24 sm:pb-8"
    >
      <Card className="flex items-center justify-between gap-4 border-emerald-200 bg-emerald-50/50">
        <div className="flex items-center gap-4">
          <div className="relative h-14 w-14 overflow-hidden rounded-full border-2 border-emerald-300 bg-emerald-100 flex items-center justify-center shadow-sm">
            {profil.foto_url ? (
              <img src={profil.foto_url} alt={profil.nama_lengkap} className="h-full w-full object-cover" />
            ) : (
              <span className="text-xl font-extrabold text-emerald-700">{initialLetter}</span>
            )}
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">{profil.nama_lengkap}</h1>
            <p className="text-sm font-semibold text-emerald-700">Kelas {kelasLabel}</p>
          </div>
        </div>
      </Card>

      <Card>
        <Title>Wali Kelas</Title>
        <p className="text-sm font-bold text-slate-700 mt-2">{waliKelasRow?.nama_lengkap || 'Belum ditetapkan'}</p>
        <p className="text-[13px] text-slate-500 font-medium">Pembimbing utama dan narahubung akademik</p>
        <div className="mt-4">
          {waUrl ? (
            <a href={waUrl} target="_blank" className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border-b-4 border-emerald-600 bg-emerald-500 px-5 text-sm font-bold text-white hover:bg-emerald-400 hover:border-emerald-500 active:border-b-0 active:translate-y-1 transition-all">
              <MessageCircle className="h-5 w-5" /> Chat via WhatsApp
            </a>
          ) : (
            <p className="text-xs font-semibold text-slate-400 bg-slate-50 p-3 rounded-xl border border-slate-100 inline-block">Nomor kontak belum tersedia</p>
          )}
        </div>
      </Card>

      <Card>
        <Title>Pengumuman Sekolah</Title>
        <div className="mt-4 space-y-3">
          {(pengumumanRows.results || []).length === 0 ? (
            <p className="text-sm font-medium text-slate-400">Belum ada pengumuman.</p>
          ) : (pengumumanRows.results || []).map((item: any) => (
            <div key={item.id} className="rounded-2xl border-2 border-slate-100 bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-800">{item.title}</p>
              <p className="text-[13px] font-medium text-slate-600 whitespace-pre-line mt-1">{item.body}</p>
              <p className="text-[11px] font-bold text-slate-400 mt-2 uppercase tracking-wider">{item.publish_at}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <Title>Notifikasi Utama</Title>
          <div className="mt-4 space-y-3">
            {(notifications.results || []).length === 0 ? (
              <p className="text-sm font-medium text-slate-400">Aman, tidak ada notifikasi.</p>
            ) : (notifications.results || []).map((n: any) => (
              <div key={n.id} className={`rounded-2xl border-2 p-4 ${n.level === 'critical' || n.level === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-slate-50'}`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 rounded-full p-1.5 ${n.level === 'critical' || n.level === 'warning' ? 'bg-amber-200 text-amber-700' : 'bg-blue-100 text-blue-600'}`}>
                    <Bell className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{n.title}</p>
                    <p className="text-[13px] font-medium text-slate-600 mt-0.5">{n.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <Title>Pemanggilan Orang Tua</Title>
          <div className="mt-4 space-y-3">
            {(summons.results || []).length === 0 ? (
              <p className="text-sm font-medium text-slate-400">Tidak ada pemanggilan aktif.</p>
            ) : (summons.results || []).map((s: any) => (
              <div key={s.id} className="rounded-2xl border-2 border-rose-100 bg-rose-50 p-4">
                <p className="text-sm font-bold text-rose-900">{s.reason}</p>
                <div className="mt-2 text-[13px] font-medium text-rose-700 space-y-1">
                  <p>📅 {s.event_date || '-'} {s.event_time || ''}</p>
                  {s.location && <p>📍 {s.location}</p>}
                  <p>ℹ️ Status: <span className="font-bold uppercase tracking-wide">{s.status}</span></p>
                </div>
                {s.note && <p className="text-[13px] font-medium text-rose-800 mt-2 bg-rose-100/50 p-2 rounded-xl">{s.note}</p>}
                <div className="mt-3">
                  <SummonResponseForm summonId={s.id} status={s.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <Title>Pengaturan Akun</Title>
        <div className="mt-4">
          <ChangePasswordForm />
          <div className="mt-4 pt-4 border-t-2 border-slate-100">
            <form action="/api/auth/sign-out" method="post">
              <button className="h-11 w-full rounded-2xl border-2 border-rose-200 bg-rose-50 text-sm font-bold text-rose-600 hover:bg-rose-100 transition-colors">
                Keluar dari Portal
              </button>
            </form>
          </div>
        </div>
      </Card>
    </motion.div>
  )

  const renderJadwal = () => (
    <motion.div
      key="jadwal"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="space-y-5 pb-24 sm:pb-8"
    >
      <Card>
        <Title>Jadwal Pelajaran</Title>
        <p className="text-sm font-medium text-slate-500 mt-1">Pilih hari untuk melihat jadwal anak.</p>
        <div className="mt-4">
          <ScheduleTabs jadwalByDay={jadwalObject as any} />
        </div>
      </Card>
    </motion.div>
  )

  const renderKehadiran = () => (
    <motion.div
      key="kehadiran"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="space-y-5 pb-24 sm:pb-8"
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-3xl border-2 border-emerald-200 bg-emerald-50 p-4 flex flex-col items-center text-center">
          <p className="text-[13px] font-bold text-emerald-700">Hadir</p>
          <p className="text-3xl font-black text-emerald-900 mt-1">{absensiRekap?.hadir || 0}</p>
        </div>
        <div className="rounded-3xl border-2 border-amber-200 bg-amber-50 p-4 flex flex-col items-center text-center">
          <p className="text-[13px] font-bold text-amber-700">Sakit</p>
          <p className="text-3xl font-black text-amber-900 mt-1">{absensiRekap?.sakit || 0}</p>
        </div>
        <div className="rounded-3xl border-2 border-blue-200 bg-blue-50 p-4 flex flex-col items-center text-center">
          <p className="text-[13px] font-bold text-blue-700">Izin</p>
          <p className="text-3xl font-black text-blue-900 mt-1">{absensiRekap?.izin || 0}</p>
        </div>
        <div className="rounded-3xl border-2 border-rose-200 bg-rose-50 p-4 flex flex-col items-center text-center">
          <p className="text-[13px] font-bold text-rose-700">Alfa</p>
          <p className="text-3xl font-black text-rose-900 mt-1">{absensiRekap?.alfa || 0}</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <Title>Riwayat Absensi</Title>
          <div className="mt-4 space-y-3">
            {(absensiTerbaru.results || []).length === 0 ? (
              <p className="text-sm font-medium text-slate-400">Belum ada riwayat absensi.</p>
            ) : (absensiTerbaru.results || []).map((r: any, i: number) => {
              const colors: Record<string, string> = {
                'HADIR': 'text-emerald-700 bg-emerald-50 border-emerald-100',
                'SAKIT': 'text-amber-700 bg-amber-50 border-amber-100',
                'IZIN': 'text-blue-700 bg-blue-50 border-blue-100',
                'ALFA': 'text-rose-700 bg-rose-50 border-rose-100',
              }
              const colorClass = colors[r.status] || 'text-slate-700 bg-slate-50 border-slate-100'
              return (
                <div key={`${r.tanggal}-${i}`} className={`rounded-2xl border-2 px-4 py-3 flex items-center justify-between gap-2 ${colorClass}`}>
                  <div>
                    <p className="text-[13px] font-bold opacity-80">{r.tanggal}</p>
                    {r.catatan && <p className="text-xs font-medium mt-0.5 opacity-90">{r.catatan}</p>}
                  </div>
                  <span className="text-sm font-black tracking-widest">{r.status}</span>
                </div>
              )
            })}
          </div>
        </Card>

        <Card>
          <Title>Kedisiplinan</Title>
          <div className="mt-4 rounded-2xl border-2 border-slate-800 bg-slate-900 p-5 flex items-center justify-between text-white">
            <div>
              <p className="text-[13px] font-bold text-slate-400">Total Poin Pelanggaran</p>
              <p className="text-4xl font-black mt-1">{disiplinRekap?.total_poin || 0}</p>
            </div>
            <div className="text-right">
              <p className="text-[13px] font-bold text-slate-400">Kasus</p>
              <p className="text-2xl font-black">{disiplinRekap?.total_kasus || 0}</p>
            </div>
          </div>
          
          <div className="mt-5 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Riwayat Pelanggaran</p>
            {(disiplinRiwayat.results || []).length === 0 ? (
              <p className="text-sm font-medium text-slate-400">Siswa tidak memiliki catatan pelanggaran.</p>
            ) : (disiplinRiwayat.results || []).map((r: any, i: number) => (
              <div key={`${r.tanggal}-${i}`} className="rounded-2xl border-2 border-slate-100 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{r.nama_pelanggaran}</p>
                    <p className="text-[13px] font-medium text-slate-500 mt-1">{r.tanggal} · {r.kategori}</p>
                  </div>
                  <span className="shrink-0 bg-rose-100 text-rose-800 text-xs font-black px-2 py-1 rounded-lg">+{r.poin} poin</span>
                </div>
                {r.keterangan && <p className="text-[13px] font-medium text-slate-600 mt-2 bg-white p-2 rounded-xl border border-slate-100">{r.keterangan}</p>}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </motion.div>
  )

  const renderNilai = () => (
    <motion.div
      key="nilai"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="space-y-5 pb-24 sm:pb-8"
    >
      <Card>
        <Title>Prestasi Akademik</Title>
        <div className="mt-4 rounded-3xl border-2 border-indigo-200 bg-indigo-50 p-5 flex items-center justify-between">
          <div>
            <p className="text-[13px] font-bold text-indigo-700">Rata-rata Keseluruhan</p>
            <p className="text-4xl font-black text-indigo-900 mt-1">{semesterAvg ?? '-'}</p>
          </div>
          <div className="relative h-20 w-20 shrink-0">
            <svg className="h-20 w-20 -rotate-90" viewBox="0 0 36 36">
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" className="text-indigo-200/50" strokeLinecap="round" />
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" className="text-indigo-600" strokeDasharray={`${Math.max(0, Math.min(100, semesterAvg || 0))}, 100`} strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-indigo-900">{semesterAvg ?? '-'}</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {semesters.map((s: any) => (
            <div key={s.label} className="rounded-2xl border-2 border-slate-100 bg-white p-4 text-center">
              <p className="text-[13px] font-bold text-slate-500">{s.label}</p>
              <p className="text-2xl font-black text-slate-800 mt-1">{s.value ?? '-'}</p>
            </div>
          ))}
        </div>
      </Card>
    </motion.div>
  )

  const renderKeuangan = () => (
    <motion.div
      key="keuangan"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="space-y-5 pb-24 sm:pb-8"
    >
      <Card>
        <Title>Status Keuangan</Title>
        <div className="mt-4 grid gap-3">
          <div className="rounded-3xl border-2 border-slate-200 bg-white p-5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
            <div className="relative z-10">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">DSPT</p>
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-[13px] font-bold"><span className="text-slate-600">Target</span><span className="text-slate-900">Rp {rupiah(dsptTarget)}</span></div>
                <div className="flex justify-between text-[13px] font-bold"><span className="text-slate-600">Terbayar</span><span className="text-emerald-600">Rp {rupiah(dsptBayar + dsptDiskon)}</span></div>
                <div className="flex justify-between text-[13px] font-black border-t-2 border-slate-100 pt-1 mt-1"><span className="text-slate-800">Sisa Tagihan</span><span className="text-rose-600">Rp {rupiah(dsptSisa)}</span></div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border-2 border-slate-200 bg-white p-5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
            <div className="relative z-10">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">SPP</p>
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-[13px] font-bold"><span className="text-slate-600">Total Tagihan</span><span className="text-slate-900">Rp {rupiah(sppNominal)}</span></div>
                <div className="flex justify-between text-[13px] font-bold"><span className="text-slate-600">Terbayar</span><span className="text-emerald-600">Rp {rupiah(sppBayar)}</span></div>
                <div className="flex justify-between text-[13px] font-black border-t-2 border-slate-100 pt-1 mt-1"><span className="text-slate-800">Sisa Tagihan</span><span className="text-rose-600">Rp {rupiah(sppSisa)}</span></div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <Title>Riwayat Transaksi Terbaru</Title>
        <div className="mt-4 space-y-3">
          {(transaksiTerbaru.results || []).length === 0 ? (
            <p className="text-sm font-medium text-slate-400">Belum ada transaksi.</p>
          ) : (transaksiTerbaru.results || []).map((t: any, i: number) => (
            <div key={`${t.nomor_kuitansi}-${i}`} className="rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-bold text-slate-500">{t.nomor_kuitansi || 'No Resi'}</p>
                <p className="text-sm font-black text-slate-800 mt-0.5">{t.kategori} · {t.metode_bayar}</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-base font-black text-emerald-700">Rp {rupiah(Number(t.jumlah_total || 0))}</p>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mt-1">{t.created_at}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </motion.div>
  )

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 [font-family:'Plus_Jakarta_Sans',ui-sans-serif,system-ui] selection:bg-emerald-200">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Quicksand:wght@600;700;800&display=swap');
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
      `}} />
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-72 border-r border-slate-200 bg-white z-40 flex-col p-6 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-inner">
            <House className="h-5 w-5" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight [font-family:'Quicksand',ui-sans-serif]">Portal Ortu</h2>
        </div>
        
        <nav className="mt-10 flex flex-col gap-2">
          {[
            { id: 'beranda', label: 'Beranda', Icon: House },
            { id: 'jadwal', label: 'Jadwal', Icon: CalendarDays },
            { id: 'kehadiran', label: 'Kehadiran & Sikap', Icon: BookOpenCheck },
            { id: 'nilai', label: 'Nilai Akademik', Icon: GraduationCap },
            { id: 'keuangan', label: 'Keuangan', Icon: Wallet },
          ].map(({ id, label, Icon }) => {
            const isActive = activeTab === id
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl font-bold transition-all ${
                  isActive 
                    ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-100 shadow-sm' 
                    : 'text-slate-500 hover:bg-slate-50 border-2 border-transparent'
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                {label}
              </button>
            )
          })}
        </nav>
      </aside>

      <main className="md:ml-72 min-h-screen flex flex-col">
        {/* Mobile Header */}
        <header className="sticky top-0 z-30 border-b border-slate-200/50 bg-white/80 backdrop-blur-xl px-5 py-4 flex items-center justify-between md:hidden">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-slate-200 bg-emerald-50 flex items-center justify-center">
               {profil.foto_url ? (
                <img src={profil.foto_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm font-black text-emerald-700">{initialLetter}</span>
              )}
            </div>
            <p className="text-lg font-black text-slate-800 [font-family:'Quicksand',ui-sans-serif]">Portal Ortu</p>
          </div>
          <button className="relative h-10 w-10 rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors">
            <Bell className="h-5 w-5" />
            {(notifications.results?.length > 0 || summons.results?.length > 0) && (
              <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-rose-500 border-2 border-white" />
            )}
          </button>
        </header>

        {/* Content Area */}
        <div className="flex-1 w-full max-w-4xl mx-auto p-4 sm:p-8">
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
