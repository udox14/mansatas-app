'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, BookOpenCheck, CalendarDays, GraduationCap, House, MessageCircle, Wallet, AlertOctagon, Settings, LogOut, CheckCircle2, AlertTriangle, ShieldAlert, ChevronRight, MessageSquareText, Megaphone, QrCode, Landmark, Send, ArrowLeft, Download, Loader2 } from 'lucide-react'
import { MobileBottomNav } from './mobile-bottom-nav'
import { ScheduleTabs } from './schedule-tabs'
import { ChangePasswordForm } from './change-password-form'
import { SummonResponseForm } from './summon-response-form'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { getParentSemesterGrades, markParentNotificationRead } from '../actions'
import { AvatarSiswa } from '@/components/ui/avatar-siswa'

function rupiah(v: number) {
  return new Intl.NumberFormat('id-ID').format(v || 0)
}

type SemesterGrade = { mapel: string; nilai: number }
type SemesterDetailState = {
  loading?: boolean
  error?: string
  average?: number | null
  grades?: SemesterGrade[]
}

export function PortalOrtuClient({ data }: { data: any }) {
  const [activeTab, setActiveTab] = useState('beranda')
  const [hiddenNotifications, setHiddenNotifications] = useState<Set<string>>(new Set())
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentStep, setPaymentStep] = useState<1 | 2 | 3>(1)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [expandedSemester, setExpandedSemester] = useState<number | null>(null)
  const [semesterDetails, setSemesterDetails] = useState<Record<number, SemesterDetailState>>({})

  const {
    profil,
    kelasLabel,
    waliKelasRow,
    waUrl,
    pengumumanRows,
    absensiRekap,
    absensiTerbaru,
    disciplineSummary,
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
  const paymentAmountNumber = Number(paymentAmount || 0)
  const isPaymentAmountValid = paymentAmountNumber > 0 && paymentAmountNumber <= Number(dsptSisa || 0)
  const komiteWaNumber = '6282215860650'
  const komiteAccount = 'BJB Syariah: 5160256984318 a.n. Komite MAN 1 Tasikmalaya'

  const resetPaymentWizard = () => {
    setPaymentStep(1)
    setPaymentAmount('')
  }

  const buildWaUrl = (message: string) => `https://wa.me/${komiteWaNumber}?text=${encodeURIComponent(message)}`

  const dsptWaUrl = buildWaUrl([
    "Assalamu'alaikum Pak Dindin Solahudin.",
    '',
    'Saya orang tua/wali dari:',
    `Nama siswa: ${profil.nama_lengkap || '-'}`,
    `Kelas: ${kelasLabel}`,
    `NISN: ${profil.nisn || '-'}`,
    '',
    `Saya telah melakukan pembayaran DSPT sebesar Rp ${rupiah(paymentAmountNumber)} melalui QRIS/Rekening Komite MAN 1 Tasikmalaya.`,
    '',
    'Mohon dibantu konfirmasi pembayaran. Saya akan mengirimkan foto atau screenshot bukti pembayaran pada chat ini.',
    '',
    'Terima kasih.',
  ].join('\n'))

  const sppWaUrl = buildWaUrl([
    "Assalamu'alaikum Pak Dindin Solahudin.",
    '',
    'Saya orang tua/wali dari:',
    `Nama siswa: ${profil.nama_lengkap || '-'}`,
    `Kelas: ${kelasLabel}`,
    `NISN: ${profil.nisn || '-'}`,
    '',
    `Saya ingin konsultasi/konfirmasi penyelesaian tunggakan SPP sebesar Rp ${rupiah(Number(sppSisa || 0))}.`,
    '',
    'Mohon arahan untuk pembayaran via WhatsApp atau datang langsung ke sekolah.',
    '',
    'Terima kasih.',
  ].join('\n'))
  const quickPaymentAmounts = [
    { label: 'Bayar Sisa', value: Number(dsptSisa || 0) },
    { label: 'Rp 500.000', value: 500000 },
    { label: 'Rp 1.000.000', value: 1000000 },
  ].filter((item) => item.value > 0 && item.value <= Number(dsptSisa || 0))
  const needsDisciplineAttention = Boolean(disciplineSummary?.needsFollowUp)
  const disciplineLevelLabel = disciplineSummary?.levelLabel || 'Baik'
  const recentAttendanceRows = absensiTerbaru.results || []

  const toggleSemesterDetail = async (semesterNumber: number, hasAverage: boolean) => {
    if (!hasAverage) return

    if (expandedSemester === semesterNumber) {
      setExpandedSemester(null)
      return
    }

    setExpandedSemester(semesterNumber)
    if (semesterDetails[semesterNumber]?.grades || semesterDetails[semesterNumber]?.loading) return

    setSemesterDetails(prev => ({
      ...prev,
      [semesterNumber]: { loading: true },
    }))

    try {
      const result = await getParentSemesterGrades(semesterNumber)
      if ('error' in result && result.error) {
        setSemesterDetails(prev => ({
          ...prev,
          [semesterNumber]: { loading: false, error: result.error },
        }))
        return
      }

      setSemesterDetails(prev => ({
        ...prev,
        [semesterNumber]: {
          loading: false,
          average: result.average,
          grades: result.grades || [],
        },
      }))
    } catch {
      setSemesterDetails(prev => ({
        ...prev,
        [semesterNumber]: { loading: false, error: 'Gagal memuat nilai semester.' },
      }))
    }
  }

  const StandardCard = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
    <div className={`bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 ${className}`}>
      {children}
    </div>
  )

  const renderBeranda = () => {
    const activeSummons = (summons.results || []).filter((s: any) => s.status === 'terkirim' && !s.parent_response)
    const activeNotifications = (notifications.results || []).filter((n: any) => !n.is_read && !hiddenNotifications.has(n.id))

    return (
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
              <AvatarSiswa fotoUrl={profil.foto_url} nama={profil.nama_lengkap || initialLetter} size="xl" className="h-[106px] w-20 rounded-xl border-2 border-white/20 bg-slate-800 text-slate-400 shadow-inner" />
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
            <div className={`bg-white rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-sm ${needsDisciplineAttention ? 'border border-amber-100' : 'border border-emerald-100'}`}>
              <span className={`text-sm font-bold leading-tight ${needsDisciplineAttention ? 'text-amber-700' : 'text-emerald-600'}`}>{disciplineLevelLabel}</span>
              <span className="text-[11px] font-medium text-slate-500 mt-1">Perlu Perhatian</span>
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
        {(activeSummons.length > 0 || activeNotifications.length > 0) && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide ml-1">Peringatan Penting</h2>
            
            {activeSummons.map((s: any) => (
              <Dialog key={s.id}>
                <DialogTrigger asChild>
                  <button className="w-full text-left outline-none">
                    <StandardCard className="border-l-4 border-l-rose-500 hover:shadow-md transition-shadow">
                      <div className="flex gap-4 items-center">
                        <div className="p-2 rounded-lg bg-rose-50 text-rose-600 shrink-0">
                          <AlertOctagon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="bg-rose-100 text-rose-700 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">Panggilan Wali</span>
                          </div>
                          <h3 className="text-sm font-semibold text-slate-800 leading-tight">{s.reason}</h3>
                          <p className="text-xs text-slate-500 mt-1">{s.event_date} {s.event_time}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </StandardCard>
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md rounded-2xl p-0 border-0 overflow-hidden bg-white">
                  <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-rose-50/30">
                    <DialogTitle className="text-lg font-semibold text-rose-900 flex items-center gap-2">
                      <AlertOctagon className="w-5 h-5 text-rose-600" /> Panggilan Orang Tua
                    </DialogTitle>
                  </DialogHeader>
                  <div className="p-6 space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800 mb-1">Alasan Pemanggilan</h4>
                      <p className="text-sm text-slate-600 leading-relaxed">{s.reason}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-700 border border-slate-100">
                      <p className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-slate-400"/> {s.event_date || '-'} {s.event_time || ''}</p>
                      {s.location && <p className="flex items-center gap-2 mt-1"><House className="w-4 h-4 text-slate-400"/> {s.location}</p>}
                    </div>
                    {s.note && (
                      <div>
                        <h4 className="text-sm font-semibold text-slate-800 mb-1">Catatan Sekolah</h4>
                        <p className="text-sm text-slate-600 leading-relaxed">{s.note}</p>
                      </div>
                    )}
                    <div className="pt-4 border-t border-slate-100 mt-4">
                      <h4 className="text-sm font-semibold text-slate-800 mb-3">Formulir Tanggapan Anda</h4>
                      <SummonResponseForm summonId={s.id} status={s.status} />
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            ))}

            {activeNotifications.map((n: any) => (
               <StandardCard key={n.id} className={`border-l-4 ${n.level === 'critical' ? 'border-l-rose-500' : n.level === 'warning' ? 'border-l-amber-500' : 'border-l-sky-500'}`}>
                 <div className="flex gap-4">
                   <div className={`mt-0.5 shrink-0 p-2 rounded-lg ${
                     n.level === 'critical' ? 'bg-rose-50 text-rose-600' : n.level === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-sky-50 text-sky-600'
                   }`}>
                     <Bell className="h-4 w-4" />
                   </div>
                   <div className="flex-1 pr-2">
                     <h3 className="text-sm font-semibold text-slate-800">{n.title}</h3>
                     <p className="text-sm text-slate-600 mt-1">{n.message}</p>
                   </div>
                   <button 
                     type="button"
                     onClick={() => {
                       setHiddenNotifications(prev => new Set(prev).add(n.id))
                       markParentNotificationRead(n.id)
                     }}
                     className="text-[10px] font-bold text-slate-500 hover:text-slate-800 uppercase tracking-wide bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors shrink-0" 
                   >
                     Tandai Selesai
                   </button>
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
              <Dialog key={item.id}>
                <DialogTrigger asChild>
                  <button className="w-full text-left outline-none">
                    <StandardCard className="border-l-4 border-l-sky-500 hover:shadow-md transition-shadow">
                      <div className="flex gap-4 items-center">
                        <div className="p-2 rounded-lg bg-sky-50 text-sky-600 shrink-0">
                          <Megaphone className="w-5 h-5" />
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <h3 className="text-sm font-semibold text-slate-800 truncate">{item.title}</h3>
                          <p className="text-xs text-slate-500 mt-1">{item.publish_at.split(' ')[0]}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      </div>
                    </StandardCard>
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md rounded-2xl p-0 border-0 overflow-hidden bg-white">
                  <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-sky-50/50">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-sky-100 text-sky-600 shrink-0 mt-0.5">
                        <Megaphone className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <DialogTitle className="text-lg font-semibold text-slate-800 leading-tight">
                          {item.title}
                        </DialogTitle>
                        <p className="text-xs text-slate-500 mt-1">{item.publish_at}</p>
                      </div>
                    </div>
                  </DialogHeader>
                  <div className="p-6 max-h-[60vh] overflow-y-auto">
                    <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{item.body}</p>
                  </div>
                </DialogContent>
              </Dialog>
            ))}
          </div>
        </div>

        {/* Riwayat Respons Orang Tua */}
        {(notes.results || []).length > 0 && (
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3 ml-1">
              <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Riwayat Respons Anda</h2>
            </div>
            
            <div className="space-y-3">
              {(notes.results || []).map((note: any) => (
                <StandardCard key={note.id} className="flex gap-4 items-start">
                  <div className="p-2 rounded-lg shrink-0 bg-indigo-50 text-indigo-600">
                    <MessageSquareText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-slate-800">Anda (Orang Tua)</h3>
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md uppercase">{note.note_type.replace('_', ' ')}</span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{note.content}</p>
                    <p className="text-[11px] text-slate-400 mt-2">{note.created_at}</p>
                  </div>
                </StandardCard>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    )
  }

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
          <p className="text-sm text-slate-500 mt-1">
            Lihat jadwal kelas dan status absensi anak per jam pelajaran berdasarkan input guru.
          </p>
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
        <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide ml-1">Catatan Kehadiran Terbaru</h2>
        <StandardCard className="p-0 overflow-hidden">
          {recentAttendanceRows.length === 0 ? (
            <p className="text-sm text-slate-500 p-6 text-center">Belum ada catatan izin, sakit, tanpa keterangan, atau catatan khusus dari guru.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentAttendanceRows.map((r: any, i: number) => {
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
        <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide ml-1 mb-3">Ringkasan Perhatian Siswa</h2>
        
        <div className={`rounded-2xl p-6 shadow-md flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${
          needsDisciplineAttention ? 'bg-amber-50 border border-amber-100 text-amber-950' : 'bg-emerald-50 border border-emerald-100 text-emerald-950'
        }`}>
          <div>
            <p className={`text-xs font-medium uppercase tracking-wide mb-1 ${needsDisciplineAttention ? 'text-amber-700' : 'text-emerald-700'}`}>Status Pendampingan</p>
            <p className="text-2xl font-bold">{disciplineLevelLabel}</p>
            <p className={`mt-2 text-sm leading-6 ${needsDisciplineAttention ? 'text-amber-800' : 'text-emerald-800'}`}>
              {needsDisciplineAttention
                ? 'Ada catatan yang perlu didampingi bersama wali kelas atau BK. Detail lengkap disampaikan melalui jalur resmi sekolah.'
                : 'Belum ada catatan kedisiplinan yang perlu tindak lanjut khusus.'}
            </p>
          </div>
          <div className="shrink-0 rounded-xl bg-white/70 px-4 py-3 text-left sm:text-right">
            <p className={`text-[10px] font-bold uppercase tracking-wide ${needsDisciplineAttention ? 'text-amber-700' : 'text-emerald-700'}`}>Catatan Tercatat</p>
            <p className="mt-1 text-xl font-bold">{disciplineSummary?.totalKasus || 0}</p>
            {disciplineSummary?.lastDate && (
              <p className="mt-1 text-[11px] font-medium opacity-75">Terakhir {disciplineSummary.lastDate}</p>
            )}
          </div>
        </div>

        {needsDisciplineAttention && (
          <StandardCard className="mt-4 border-l-4 border-l-sky-500">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-800">Koordinasi dengan sekolah</h4>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Orang tua dapat menghubungi wali kelas untuk memahami langkah pendampingan yang tepat.
                </p>
              </div>
              {waUrl && (
                <a href={waUrl} target="_blank" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-sky-50 px-4 text-sm font-bold text-sky-700 hover:bg-sky-100">
                  <MessageCircle className="h-4 w-4" />
                  Hubungi Wali Kelas
                </a>
              )}
            </div>
          </StandardCard>
        )}
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
        {semesterAvg === null && (
          <p className="mt-3 text-sm leading-6 text-slate-500">Rekap nilai semester belum tersedia di portal orang tua.</p>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide ml-1">Rata-rata Per Semester</h2>
        <div className="space-y-3">
          {semesters.map((s: any, index: number) => {
            const semesterNumber = index + 1
            const isFilled = s.value !== null && s.value !== undefined && s.value !== ''
            const isExpanded = expandedSemester === semesterNumber
            const detail = semesterDetails[semesterNumber]
            return (
              <div key={s.label} className={`overflow-hidden rounded-2xl border transition-all ${
                isFilled 
                  ? 'bg-white border-slate-200 shadow-sm' 
                  : 'bg-slate-50 border-slate-100 border-dashed'
              }`}>
                <button
                  type="button"
                  disabled={!isFilled}
                  onClick={() => toggleSemesterDetail(semesterNumber, isFilled)}
                  aria-expanded={isExpanded}
                  className="flex w-full items-center justify-between gap-4 p-4 text-left disabled:cursor-not-allowed"
                >
                  <div className="min-w-0">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{s.label}</span>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className={`text-2xl font-bold ${isFilled ? 'text-indigo-600' : 'text-slate-300'}`}>
                        {s.value ?? '-'}
                      </span>
                      <span className="text-xs font-medium text-slate-400">rata-rata</span>
                    </div>
                  </div>
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors ${
                    isFilled ? 'border-indigo-100 bg-indigo-50 text-indigo-600' : 'border-slate-100 bg-white text-slate-300'
                  }`}>
                    <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      className="border-t border-slate-100"
                    >
                      <div className="p-4 pt-3">
                        {detail?.loading ? (
                          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-3 text-sm font-medium text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Memuat nilai semester...
                          </div>
                        ) : detail?.error ? (
                          <div className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-3 text-sm font-medium text-rose-700">
                            <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0" />
                            {detail.error}
                          </div>
                        ) : detail?.grades?.length ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3 px-1">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nilai per mata pelajaran</p>
                              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">
                                Rata-rata {detail.average ?? s.value}
                              </span>
                            </div>
                            <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/60">
                              {detail.grades.map((item) => (
                                <div key={item.mapel} className="flex items-center justify-between gap-3 px-3 py-2.5">
                                  <span className="min-w-0 text-sm font-medium leading-snug text-slate-700">{item.mapel}</span>
                                  <span className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-sm font-bold text-slate-800 shadow-sm ring-1 ring-slate-100">
                                    {item.nilai}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-500">
                            Belum ada rincian nilai mata pelajaran untuk semester ini.
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
            <div className="flex justify-between items-center gap-3">
              <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                 <span className="p-1.5 bg-slate-100 rounded-md"><Wallet className="w-4 h-4 text-slate-600" /></span>
                 DSPT
              </span>
              {dsptSisa <= 0 && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                  Lunas
                </span>
              )}
            </div>
            
            <div>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">Sisa Tagihan</p>
              <p className={`text-2xl font-bold ${dsptSisa > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>Rp {rupiah(dsptSisa)}</p>
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
            {dsptSisa > 0 && (
              <Dialog
                open={paymentOpen}
                onOpenChange={(open) => {
                  setPaymentOpen(open)
                  if (!open) resetPaymentWizard()
                }}
              >
                <DialogTrigger asChild>
                  <button className="h-11 w-full rounded-xl bg-slate-900 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800">
                    Bayar DSPT
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md rounded-2xl p-0 border-0 overflow-hidden bg-white">
                  <DialogHeader className="border-b border-slate-100 bg-slate-950 p-5 text-left text-white">
                    <DialogTitle className="text-lg font-semibold">Pembayaran DSPT</DialogTitle>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {[1, 2, 3].map((step) => (
                        <div key={step} className={`h-1.5 rounded-full ${paymentStep >= step ? 'bg-emerald-400' : 'bg-white/15'}`} />
                      ))}
                    </div>
                  </DialogHeader>

                  <div className="p-5">
                    {paymentStep === 1 && (
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">Masukkan nominal pembayaran</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">Boleh membayar sebagian atau melunasi sesuai sisa DSPT.</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Sisa DSPT</p>
                          <p className="mt-1 text-2xl font-bold text-rose-600">Rp {rupiah(dsptSisa)}</p>
                        </div>
                        <div>
                          <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Nominal dibayar</label>
                          <div className="relative mt-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">Rp</span>
                            <input
                              inputMode="numeric"
                              value={paymentAmount ? rupiah(paymentAmountNumber) : ''}
                              onChange={(e) => setPaymentAmount(e.target.value.replace(/\D/g, ''))}
                              placeholder="0"
                              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-base font-bold text-slate-900 outline-none focus:border-emerald-600"
                            />
                          </div>
                          {paymentAmount && !isPaymentAmountValid && (
                            <p className="mt-2 text-xs font-medium text-rose-600">Nominal harus lebih dari 0 dan tidak boleh melebihi sisa DSPT.</p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {quickPaymentAmounts.map((item) => (
                            <button
                              key={item.label}
                              type="button"
                              onClick={() => setPaymentAmount(String(item.value))}
                              className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 hover:border-emerald-600 hover:text-emerald-700"
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          disabled={!isPaymentAmountValid}
                          onClick={() => setPaymentStep(2)}
                          className="h-11 w-full rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Lanjut ke Pembayaran
                        </button>
                      </div>
                    )}

                    {paymentStep === 2 && (
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">Scan QRIS atau transfer rekening</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">Setelah membayar, lanjutkan ke konfirmasi WhatsApp dan kirim bukti pembayaran.</p>
                        </div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <button type="button" className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100" aria-label="Perbesar QRIS Komite">
                              <img src="/QRISkomite.jpeg" alt="QRIS Komite MAN 1 Tasikmalaya" className="mx-auto max-h-[260px] w-full rounded-lg object-contain bg-white" />
                              <span className="mt-2 block text-center text-[11px] font-semibold text-slate-500">Ketuk gambar untuk memperbesar</span>
                            </button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-xl rounded-2xl border-0 bg-white p-0 overflow-hidden">
                            <DialogHeader className="border-b border-slate-100 p-5">
                              <DialogTitle className="text-lg font-semibold text-slate-800">QRIS Komite</DialogTitle>
                            </DialogHeader>
                            <div className="bg-slate-50 p-4">
                              <img src="/QRISkomite.jpeg" alt="QRIS Komite MAN 1 Tasikmalaya diperbesar" className="mx-auto max-h-[78vh] w-full rounded-xl object-contain bg-white" />
                            </div>
                          </DialogContent>
                        </Dialog>
                        <div>
                          <a
                            href="/QRISkomite.jpeg"
                            download="QRISkomite.jpeg"
                            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:border-emerald-600 hover:text-emerald-700"
                          >
                            <Download className="h-4 w-4" />
                            Download QRIS
                          </a>
                        </div>
                        <div className="grid gap-3">
                          <div className="rounded-xl border border-slate-200 p-4">
                            <div className="flex items-start gap-3">
                              <QrCode className="mt-0.5 h-5 w-5 text-emerald-600" />
                              <div>
                                <p className="text-sm font-bold text-slate-800">QRIS Komite</p>
                                <p className="text-xs text-slate-500">Gunakan QRIS di atas jika membayar dari e-wallet/mobile banking.</p>
                              </div>
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-200 p-4">
                            <div className="flex items-start gap-3">
                              <Landmark className="mt-0.5 h-5 w-5 text-sky-600" />
                              <div>
                                <p className="text-sm font-bold text-slate-800">{komiteAccount}</p>
                                <p className="mt-1 text-xs text-slate-500">Nominal DSPT: Rp {rupiah(paymentAmountNumber)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setPaymentStep(1)} className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700">
                            <ArrowLeft className="mr-1 inline h-4 w-4" />
                            Kembali
                          </button>
                          <button type="button" onClick={() => setPaymentStep(3)} className="h-11 flex-1 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white">
                            Saya Sudah Bayar
                          </button>
                        </div>
                      </div>
                    )}

                    {paymentStep === 3 && (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                          <p className="text-sm font-bold text-emerald-900">Konfirmasi pembayaran ke komite</p>
                          <p className="mt-2 text-xs leading-5 text-emerald-800">Pembayaran akan tercatat di riwayat setelah komite memverifikasi dan memasukkannya di menu keuangan.</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
                          <div className="flex justify-between gap-3">
                            <span className="text-slate-500">Nama siswa</span>
                            <span className="text-right font-semibold">{profil.nama_lengkap}</span>
                          </div>
                          <div className="mt-2 flex justify-between gap-3">
                            <span className="text-slate-500">Kelas</span>
                            <span className="text-right font-semibold">{kelasLabel}</span>
                          </div>
                          <div className="mt-2 flex justify-between gap-3">
                            <span className="text-slate-500">Nominal</span>
                            <span className="text-right font-semibold">Rp {rupiah(paymentAmountNumber)}</span>
                          </div>
                        </div>
                        <a href={dsptWaUrl} target="_blank" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white">
                          <Send className="h-4 w-4" />
                          Konfirmasi via WhatsApp
                        </a>
                        <button type="button" onClick={() => setPaymentOpen(false)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700">
                          Tutup
                        </button>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {sppSisa > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative overflow-hidden">
            <div className="relative z-10 flex flex-col h-full justify-between gap-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-semibold text-slate-800">Tunggakan SPP</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  SPP bulanan sudah tidak diberlakukan. Tunggakan ini hanya berlaku untuk siswa/angkatan sebelum kebijakan penghapusan kewajiban SPP. Penyelesaian dapat dilakukan via WhatsApp komite atau datang langsung ke sekolah.
                </p>
              </div>
              
              <div className="flex items-end justify-between bg-slate-50 border border-slate-100 p-4 rounded-xl">
                <div>
                  <p className="text-slate-500 text-[10px] font-medium uppercase tracking-wide mb-1">Total Tagihan Awal</p>
                  <p className="text-lg font-bold text-slate-800">Rp {rupiah(sppNominal)}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500 text-[10px] font-medium uppercase tracking-wide mb-1">Sisa Tunggakan</p>
                  <p className="text-xl font-bold text-rose-600">Rp {rupiah(sppSisa)}</p>
                </div>
              </div>

              <a
                href={sppWaUrl}
                target="_blank"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-bold text-emerald-700 hover:bg-emerald-100"
              >
                <MessageCircle className="h-4 w-4" />
                Hubungi Komite
              </a>
            </div>
          </div>
        )}
      </div>

      <div className="pt-2">
        <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide ml-1 mb-1">Riwayat Pembayaran Terkonfirmasi</h2>
        <p className="text-xs text-slate-500 leading-5 ml-1 mb-3">
          Pembayaran DSPT/SPP akan muncul di sini setelah diverifikasi dan dicatat oleh komite.
        </p>
        <div className="space-y-3">
          {(transaksiTerbaru.results || []).length === 0 ? (
            <div className="text-center py-6 bg-white border border-slate-200 border-dashed rounded-2xl">
              <p className="text-sm text-slate-500">Belum ada pembayaran terkonfirmasi.</p>
            </div>
          ) : (transaksiTerbaru.results || []).map((t: any, i: number) => (
            <StandardCard key={`${t.nomor_kuitansi}-${i}`} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-full text-emerald-500 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">{t.kategori}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">{t.nomor_kuitansi}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{t.created_at.split(' ')[0]} • {t.metode_bayar}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <p className="text-sm font-bold text-slate-800">Rp {rupiah(Number(t.jumlah_total || 0))}</p>
                <a
                  href={`/portal-ortu/kuitansi/${t.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                >
                  <Download className="h-3.5 w-3.5" />
                  Kuitansi
                </a>
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
