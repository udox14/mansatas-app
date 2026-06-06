'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, BookOpenCheck, CalendarDays, GraduationCap, House, MessageCircle, Wallet, AlertOctagon, Settings, LogOut, CheckCircle2, AlertTriangle, ShieldAlert, ChevronRight, MessageSquareText, Megaphone, QrCode, Landmark, ArrowLeft, Download, Loader2, UploadCloud, Image as ImageIcon, RefreshCw, CircleHelp } from 'lucide-react'
import { MobileBottomNav } from './mobile-bottom-nav'
import { ScheduleTabs } from './schedule-tabs'
import { ChangePasswordForm } from './change-password-form'
import { ParentWhatsAppForm } from './parent-whatsapp-form'
import { SummonResponseForm } from './summon-response-form'
import { PortalTour, type PortalTourStep } from './portal-tour'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { createParentDsptPaymentSubmission, createParentSuggestion, getParentSemesterGrades, markParentNotificationRead, uploadParentPaymentProof } from '../actions'
import { AvatarSiswa } from '@/components/ui/avatar-siswa'
import { PARENT_SUGGESTION_CATEGORIES } from '@/lib/parent-suggestions'
import { PushNotificationBanner } from '@/components/shared/PushNotificationBanner'

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

function StandardCard({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 ${className}`} {...props}>
      {children}
    </div>
  )
}

async function compressPaymentProofImage(file: File, targetKb = 80): Promise<File> {
  const imageUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = imageUrl
    })
    const maxSide = 1280
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.width * scale))
    canvas.height = Math.max(1, Math.round(img.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas tidak tersedia')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    let quality = 0.82
    let blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
    while (blob && blob.size > targetKb * 1024 && quality > 0.42) {
      quality -= 0.08
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
    }
    if (!blob) throw new Error('Gagal memproses gambar')
    return new File([blob], 'bukti-pembayaran.webp', { type: 'image/webp' })
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}

export function PortalOrtuClient({ data }: { data: any }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('beranda')
  const [hiddenNotifications, setHiddenNotifications] = useState<Set<string>>(new Set())
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentStep, setPaymentStep] = useState<1 | 2 | 3>(1)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'qris' | 'transfer'>('qris')
  const [currentSubmissionId, setCurrentSubmissionId] = useState('')
  const [paymentSubmitting, setPaymentSubmitting] = useState(false)
  const [paymentMessage, setPaymentMessage] = useState('')
  const [proofPreviewUrl, setProofPreviewUrl] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [expandedSemester, setExpandedSemester] = useState<number | null>(null)
  const [semesterDetails, setSemesterDetails] = useState<Record<number, SemesterDetailState>>({})
  const [suggestionCategory, setSuggestionCategory] = useState('')
  const [suggestionTitle, setSuggestionTitle] = useState('')
  const [suggestionMessage, setSuggestionMessage] = useState('')
  const [suggestionSubmitting, setSuggestionSubmitting] = useState(false)
  const [suggestionFeedback, setSuggestionFeedback] = useState('')
  const [tourOpen, setTourOpen] = useState(false)

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
    dsptStatus,
    dsptIsInput,
    dsptIsLunas,
    dsptNeedsInput,
    paymentSubmissions,
    parentSuggestions,
    komitePaymentSettings,
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
  const komiteWaNumber = komitePaymentSettings?.whatsapp || '6282215860650'
  const activePaymentAccounts = (komitePaymentSettings?.accounts || []).filter((account: any) => account?.isActive !== false)
  const primaryPaymentAccount = activePaymentAccounts[0]
  const komiteAccount = primaryPaymentAccount
    ? `${primaryPaymentAccount.bankLabel || 'Rekening'}: ${primaryPaymentAccount.accountNumber || '-'} a.n. ${primaryPaymentAccount.accountName || '-'}`
    : `${komitePaymentSettings?.bankLabel || 'BJB Syariah'}: ${komitePaymentSettings?.rekening || '5160256984318'} a.n. ${komitePaymentSettings?.atasNama || 'Komite MAN 1 Tasikmalaya'}`
  const qrisEnabled = komitePaymentSettings?.qrisEnabled !== false
  const komiteQrisUrl = komitePaymentSettings?.qrisUrl || '/QRISkomite.jpeg'
  const hasQrisMethod = qrisEnabled && Boolean(komiteQrisUrl)
  const hasTransferMethod = activePaymentAccounts.length > 0
  const getDefaultPaymentMethod = (): 'qris' | 'transfer' => hasQrisMethod ? 'qris' : 'transfer'

  const resetPaymentWizard = () => {
    setPaymentStep(1)
    setPaymentAmount('')
    setPaymentMethod(getDefaultPaymentMethod())
    setCurrentSubmissionId('')
    setPaymentSubmitting(false)
    setPaymentMessage('')
    setProofFile(null)
    if (proofPreviewUrl) URL.revokeObjectURL(proofPreviewUrl)
    setProofPreviewUrl('')
  }

  const buildWaUrl = (message: string) => `https://wa.me/${komiteWaNumber}?text=${encodeURIComponent(message)}`

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
  const suggestionRows = parentSuggestions?.results || []
  const hasDsptBill = Boolean(dsptIsInput) && Number(dsptSisa || 0) > 0
  const baseTourSteps: Record<string, PortalTourStep[]> = {
    beranda: [
      { target: 'beranda-profile', title: 'Profil siswa', description: 'Bagian ini menampilkan identitas anak, kelas, dan NISN yang sedang dipantau di portal orang tua.' },
      { target: 'beranda-wali', title: 'Kontak wali kelas', description: 'Gunakan tombol WhatsApp di kartu ini untuk menghubungi wali kelas jika perlu koordinasi cepat.' },
      { target: 'beranda-stats', title: 'Ringkasan cepat', description: 'Angka-angka ini memberi gambaran singkat tentang kehadiran dan status pendampingan anak.' },
      { target: 'beranda-alerts', title: 'Peringatan penting', description: 'Jika ada panggilan, notifikasi penting, atau tindak lanjut dari sekolah, informasinya muncul di sini.' },
      { target: 'beranda-announcements', title: 'Pengumuman sekolah', description: 'Pengumuman resmi yang ditujukan untuk orang tua dapat dibuka dari daftar ini.' },
    ],
    jadwal: [
      { target: 'jadwal-header', title: 'Jadwal pelajaran', description: 'Section ini membantu Bapak/Ibu melihat jadwal kelas anak dan status absensi per jam pelajaran.' },
      { target: 'jadwal-day-tabs', title: 'Pilih hari', description: 'Gunakan tab hari untuk berpindah dari Senin sampai Sabtu. Titik biru menandai hari ini.' },
      { target: 'jadwal-list', title: 'Daftar jam pelajaran', description: 'Setiap baris menampilkan jam, mata pelajaran, guru, dan status absensi bila sudah diinput.' },
    ],
    kehadiran: [
      { target: 'kehadiran-summary', title: 'Ringkasan kehadiran', description: 'Lihat total hadir, izin, sakit, dan tanpa keterangan dalam satu tampilan ringkas.' },
      { target: 'kehadiran-recent', title: 'Catatan terbaru', description: 'Daftar ini menampilkan catatan kehadiran terbaru beserta catatan guru jika ada.' },
      { target: 'kehadiran-discipline', title: 'Status pendampingan', description: 'Bagian ini memberi sinyal apakah ada catatan yang perlu didampingi bersama wali kelas atau BK.' },
      { target: 'kehadiran-contact', title: 'Koordinasi sekolah', description: 'Jika butuh penjelasan lanjutan, gunakan tombol ini untuk menghubungi wali kelas.' },
    ],
    nilai: [
      { target: 'nilai-average', title: 'Rata-rata akademik', description: 'Bagian ini menampilkan rata-rata nilai keseluruhan yang sudah tersedia di portal.' },
      { target: 'nilai-semesters', title: 'Nilai per semester', description: 'Ketuk semester yang memiliki nilai untuk membuka rincian nilai mata pelajaran.' },
      { target: 'nilai-detail', title: 'Rincian mata pelajaran', description: 'Setelah semester dibuka, nilai tiap mata pelajaran akan tampil di area rincian ini.' },
    ],
    saran: [
      { target: 'saran-hero', title: 'Kotak saran', description: 'Section ini dipakai untuk menyampaikan masukan atau kebutuhan orang tua kepada sekolah.' },
      { target: 'saran-form', title: 'Form saran', description: 'Pilih kategori, isi judul, lalu tuliskan saran secara singkat dan jelas.' },
      { target: 'saran-submit', title: 'Kirim saran', description: 'Tekan tombol ini setelah isi saran lengkap. Status tindak lanjut akan muncul di riwayat.' },
      { target: 'saran-history', title: 'Riwayat saran', description: 'Pantau saran yang pernah dikirim beserta statusnya: baru, dibaca, diproses, atau selesai.' },
    ],
  }
  const financeTourSteps: PortalTourStep[] = dsptNeedsInput
    ? [
        { target: 'keuangan-dspt-card', title: 'DSPT belum diinput', description: 'Data tagihan DSPT anak belum tersedia dari bendahara komite, sehingga belum bisa dibayar melalui portal ini.' },
        { target: 'keuangan-submissions', title: 'Riwayat pengajuan', description: 'Jika nanti ada pengajuan pembayaran DSPT, status dan bukti pembayaran akan tersimpan di bagian ini.' },
        { target: 'keuangan-receipts', title: 'Kuitansi pembayaran', description: 'Kuitansi baru muncul setelah pembayaran diverifikasi dan dicatat oleh komite.' },
      ]
    : hasDsptBill
      ? [
          { target: 'keuangan-dspt-card', title: 'Sisa tagihan DSPT', description: 'Lihat sisa DSPT, target, dan pembayaran yang sudah tercatat. Jika sudah lunas, statusnya akan berubah menjadi lunas.' },
          { target: 'keuangan-pay-button', title: 'Mulai bayar DSPT', description: 'Tekan Bayar DSPT untuk membuka panduan pembayaran. Tour ini akan ikut menunjukkan langkah di dalam modal.' },
          { target: 'payment-step-amount', title: 'Masukkan nominal', description: 'Isi nominal pembayaran. Boleh membayar sebagian atau memilih tombol Bayar Sisa untuk melunasi tagihan.' },
          { target: 'payment-step-method', title: 'Pilih metode pembayaran', description: 'Pilih QRIS atau Transfer sesuai metode yang tersedia dari pengaturan komite.' },
          { target: 'payment-qris', title: 'Bayar via QRIS', description: 'Jika memakai QRIS, ketuk gambar untuk memperbesar atau download QRIS lalu bayar dari aplikasi bank/e-wallet.' },
          { target: 'payment-transfer', title: 'Bayar via transfer', description: 'Jika memakai transfer, gunakan rekening aktif yang tampil di sini dan bayar sesuai nominal yang dimasukkan.' },
          { target: 'payment-paid-button', title: 'Catat pengajuan', description: 'Setelah benar-benar membayar di luar aplikasi, tekan Saya Sudah Bayar agar pengajuan tercatat. Tombol ini tidak otomatis menarik saldo.' },
          { target: 'payment-step-proof', title: 'Upload bukti pembayaran', description: 'Pilih foto atau screenshot bukti pembayaran. Gambar akan dikompres otomatis sebelum dikirim.' },
          { target: 'payment-upload-button', title: 'Kirim bukti', description: 'Tekan Upload Bukti setelah file dipilih. Bukti akan diperiksa bendahara komite sebelum kuitansi diterbitkan.' },
          { target: 'keuangan-submissions', title: 'Cek status pengajuan', description: 'Pantau status pengajuan: belum upload, menunggu konfirmasi, terkonfirmasi, atau ditolak.' },
          { target: 'keuangan-receipts', title: 'Kuitansi dan riwayat', description: 'Jika sudah terkonfirmasi, kuitansi bisa dibuka dari riwayat pembayaran atau kartu pengajuan terkait.' },
        ]
      : [
          { target: 'keuangan-dspt-card', title: 'DSPT sudah lunas', description: 'Kartu DSPT menampilkan status lunas saat tidak ada sisa tagihan yang perlu dibayar.' },
          { target: 'keuangan-submissions', title: 'Riwayat pengajuan', description: 'Bagian ini menyimpan riwayat pengajuan pembayaran dan bukti yang pernah dikirim.' },
          { target: 'keuangan-receipts', title: 'Kuitansi pembayaran', description: 'Pembayaran yang sudah diverifikasi bisa dicek di sini, termasuk tombol untuk membuka kuitansi.' },
        ]
  const activeTourSteps = activeTab === 'keuangan' ? financeTourSteps : (baseTourSteps[activeTab] || [])

  const startPortalTour = () => {
    if (activeTab === 'keuangan' && hasDsptBill) {
      setPaymentOpen(false)
      resetPaymentWizard()
    }
    setTourOpen(true)
  }

  const closePortalTour = () => {
    setTourOpen(false)
  }

  const changeTab = (id: string) => {
    setTourOpen(false)
    setActiveTab(id)
  }

  const handleTourStepChange = (_index: number, step: PortalTourStep) => {
    if (activeTab !== 'keuangan' || !hasDsptBill) return
    if (step.target.startsWith('payment-step-') || step.target.startsWith('payment-qris') || step.target.startsWith('payment-transfer') || step.target === 'payment-paid-button' || step.target === 'payment-upload-button') {
      setPaymentOpen(true)
    }
    if (step.target === 'payment-step-amount') {
      setPaymentStep(1)
    }
    if (step.target === 'payment-step-method' || step.target === 'payment-qris' || step.target === 'payment-transfer' || step.target === 'payment-paid-button') {
      setPaymentStep(2)
    }
    if (step.target === 'payment-qris' && hasQrisMethod) {
      setPaymentMethod('qris')
    }
    if (step.target === 'payment-transfer' && hasTransferMethod) {
      setPaymentMethod('transfer')
    }
    if (step.target === 'payment-step-proof' || step.target === 'payment-upload-button') {
      setPaymentStep(3)
    }
    if (step.target === 'keuangan-submissions' || step.target === 'keuangan-receipts') {
      setPaymentOpen(false)
    }
  }

  const startSubmission = async () => {
    if (!isPaymentAmountValid || paymentSubmitting) return
    if (paymentMethod === 'qris' && !hasQrisMethod) {
      setPaymentMessage('Metode QRIS sedang tidak aktif.')
      return
    }
    if (paymentMethod === 'transfer' && !hasTransferMethod) {
      setPaymentMessage('Metode transfer rekening sedang tidak aktif.')
      return
    }
    setPaymentSubmitting(true)
    setPaymentMessage('')
    const res = await createParentDsptPaymentSubmission({ amount: paymentAmountNumber, method: paymentMethod })
    setPaymentSubmitting(false)
    if (res.error || !res.submissionId) {
      setPaymentMessage(res.error || 'Gagal membuat pengajuan pembayaran')
      return
    }
    setCurrentSubmissionId(res.submissionId)
    setPaymentStep(3)
    router.refresh()
  }

  const handleProofFile = async (file?: File | null) => {
    if (!file) return
    setPaymentMessage('')
    if (!file.type.startsWith('image/')) {
      setPaymentMessage('File bukti harus berupa gambar.')
      return
    }
    try {
      const compressed = await compressPaymentProofImage(file)
      if (proofPreviewUrl) URL.revokeObjectURL(proofPreviewUrl)
      setProofFile(compressed)
      setProofPreviewUrl(URL.createObjectURL(compressed))
    } catch {
      setPaymentMessage('Gagal mengompres gambar bukti pembayaran.')
    }
  }

  const submitProof = async () => {
    if (!currentSubmissionId || !proofFile || paymentSubmitting) return
    setPaymentSubmitting(true)
    setPaymentMessage('')
    const fd = new FormData()
    fd.append('submissionId', currentSubmissionId)
    fd.append('bukti', proofFile)
    const res = await uploadParentPaymentProof(fd)
    setPaymentSubmitting(false)
    if (res.error) {
      setPaymentMessage(res.error)
      return
    }
    setPaymentMessage(res.success || 'Bukti pembayaran berhasil diupload')
    router.refresh()
  }

  const openProofUpload = (submission: any) => {
    setPaymentAmount(String(Number(submission.jumlah || 0)))
    setPaymentMethod(submission.metode_bayar === 'transfer' ? 'transfer' : getDefaultPaymentMethod())
    setCurrentSubmissionId(submission.id)
    setPaymentStep(3)
    setPaymentMessage('')
    setProofFile(null)
    if (proofPreviewUrl) URL.revokeObjectURL(proofPreviewUrl)
    setProofPreviewUrl('')
    setPaymentOpen(true)
  }

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

  const continueToPayment = () => {
    const nextMethod = paymentMethod === 'qris' && hasQrisMethod
      ? 'qris'
      : paymentMethod === 'transfer' && hasTransferMethod
        ? 'transfer'
        : getDefaultPaymentMethod()
    setPaymentMethod(nextMethod)
    setPaymentStep(2)
  }

  const submitSuggestion = async () => {
    if (suggestionSubmitting) return
    setSuggestionFeedback('')
    setSuggestionSubmitting(true)
    const res = await createParentSuggestion({
      category: suggestionCategory,
      title: suggestionTitle,
      message: suggestionMessage,
    })
    setSuggestionSubmitting(false)
    if (res.error) {
      setSuggestionFeedback(res.error)
      return
    }
    setSuggestionCategory('')
    setSuggestionTitle('')
    setSuggestionMessage('')
    setSuggestionFeedback(res.success || 'Terima kasih, saran Bapak/Ibu sudah kami terima.')
    router.refresh()
  }

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
        className="portal-tab-panel space-y-5"
      >
        {/* Social Media Style Hero Profile Section */}
        <div data-tour-id="beranda-profile" className="relative bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col items-center pb-6 text-center">
          {/* Cover Banner */}
          <div className="w-full h-28 sm:h-36 bg-gradient-to-r from-teal-900 via-teal-700 to-slate-900 relative">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <GraduationCap className="w-48 h-48 -mt-12 -mr-12 text-white" />
            </div>
            
            <Dialog>
              <DialogTrigger asChild>
                <button className="absolute top-4 right-4 w-9 h-9 bg-black/20 hover:bg-black/35 text-white backdrop-blur-sm rounded-full flex items-center justify-center transition-colors z-20 border border-white/10">
                  <Settings className="w-4 h-4 text-white" />
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md rounded-2xl p-0 border-0 overflow-hidden bg-white">
                <DialogHeader className="p-6 pb-4 border-b border-slate-100">
                  <DialogTitle className="text-lg font-semibold text-slate-800">Pengaturan Akun</DialogTitle>
                </DialogHeader>
                <div className="max-h-[78vh] space-y-6 overflow-y-auto bg-slate-50 p-6">
                  <ParentWhatsAppForm initialNumber={profil.nomor_whatsapp || ''} />
                  <div className="h-px bg-slate-200" />
                  <ChangePasswordForm />
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Overlapping 3:4 Portrait Avatar */}
          <div className="-mt-14 sm:-mt-16 relative z-10">
            <AvatarSiswa 
              fotoUrl={profil.foto_url} 
              nama={profil.nama_lengkap || initialLetter} 
              size="profile" 
              className="rounded-2xl border-4 border-white shadow-md bg-slate-800 text-white" 
            />
          </div>

          {/* Student Info with support for very long names */}
          <div className="mt-4 px-6 w-full flex flex-col items-center">
            <p className="text-teal-700 text-[10px] font-bold tracking-widest uppercase mb-1">Portal Orang Tua</p>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight max-w-lg break-words w-full">
              {profil.nama_lengkap}
            </h1>
            
            {/* Pills metadata */}
            <div className="flex flex-wrap gap-2 mt-3 justify-center">
              <span className="bg-teal-50 border border-teal-100 text-teal-800 px-3 py-1 rounded-full text-xs font-semibold shadow-sm">
                Kelas {kelasLabel}
              </span>
              <span className="bg-slate-50 border border-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-semibold shadow-sm">
                NISN {profil.nisn}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Wali Kelas */}
          <div data-tour-id="beranda-wali" className="col-span-2 sm:col-span-1">
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
          <div data-tour-id="beranda-stats" className="col-span-2 sm:col-span-1 grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl border border-teal-100 p-4 flex flex-col items-center justify-center text-center shadow-sm">
              <span className="text-2xl font-bold text-teal-700">{absensiRekap?.hadir || 0}</span>
              <span className="text-[11px] font-medium text-slate-500 mt-1">Kehadiran</span>
            </div>
            <div className={`bg-white rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-sm ${needsDisciplineAttention ? 'border border-amber-100' : 'border border-teal-100'}`}>
              <span className={`text-sm font-bold leading-tight ${needsDisciplineAttention ? 'text-amber-700' : 'text-teal-700'}`}>{disciplineLevelLabel}</span>
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
          <div data-tour-id="beranda-alerts" className="space-y-3">
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
        <div data-tour-id="beranda-announcements" className="pt-2">
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
      className="portal-tab-panel space-y-5"
    >
      <div data-tour-id="jadwal-header" className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center justify-between">
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
      className="portal-tab-panel space-y-5"
    >
      {/* Kehadiran Summary */}
      <div data-tour-id="kehadiran-summary" className="grid grid-cols-3 gap-3">
        <div className="col-span-3 bg-white rounded-2xl border border-teal-100 p-6 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Total Kehadiran</p>
            <h2 className="text-3xl font-bold text-teal-700">{absensiRekap?.hadir || 0} <span className="text-base font-medium text-teal-700/60">hari</span></h2>
          </div>
          <div className="w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-teal-600" />
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

      <div data-tour-id="kehadiran-recent" className="space-y-3">
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
                      isHadir ? 'bg-teal-50 text-teal-600' : 'bg-amber-50 text-amber-500'
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

      <div data-tour-id="kehadiran-discipline" className="pt-4 mt-4 border-t border-slate-200">
        <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide ml-1 mb-3">Ringkasan Perhatian Siswa</h2>
        
        <div className={`rounded-2xl p-6 shadow-md flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${
          needsDisciplineAttention ? 'bg-amber-50 border border-amber-100 text-amber-950' : 'bg-teal-50 border border-teal-100 text-teal-950'
        }`}>
          <div>
            <p className={`text-xs font-medium uppercase tracking-wide mb-1 ${needsDisciplineAttention ? 'text-amber-700' : 'text-teal-700'}`}>Status Pendampingan</p>
            <p className="text-2xl font-bold">{disciplineLevelLabel}</p>
            <p className={`mt-2 text-sm leading-6 ${needsDisciplineAttention ? 'text-amber-800' : 'text-teal-800'}`}>
              {needsDisciplineAttention
                ? 'Ada catatan yang perlu didampingi bersama wali kelas atau BK. Detail lengkap disampaikan melalui jalur resmi sekolah.'
                : 'Belum ada catatan kedisiplinan yang perlu tindak lanjut khusus.'}
            </p>
          </div>
          <div className="shrink-0 rounded-xl bg-white/70 px-4 py-3 text-left sm:text-right">
            <p className={`text-[10px] font-bold uppercase tracking-wide ${needsDisciplineAttention ? 'text-amber-700' : 'text-teal-700'}`}>Catatan Tercatat</p>
            <p className="mt-1 text-xl font-bold">{disciplineSummary?.totalKasus || 0}</p>
            {disciplineSummary?.lastDate && (
              <p className="mt-1 text-[11px] font-medium opacity-75">Terakhir {disciplineSummary.lastDate}</p>
            )}
          </div>
        </div>

        {needsDisciplineAttention && (
          <StandardCard className="mt-4 border-l-4 border-l-sky-500" data-tour-id="kehadiran-contact">
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
      className="portal-tab-panel space-y-5"
    >
      <div data-tour-id="nilai-average" className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 text-center">
        <div className="w-12 h-12 bg-indigo-50 text-indigo-500 mx-auto rounded-full flex items-center justify-center mb-4">
          <GraduationCap className="h-6 w-6" />
        </div>
        <p className="text-slate-500 text-sm font-medium mb-1">Rata-rata Nilai Keseluruhan</p>
        <h1 className="text-4xl font-bold text-slate-800">{semesterAvg ?? '-'}</h1>
        {semesterAvg === null && (
          <p className="mt-3 text-sm leading-6 text-slate-500">Rekap nilai semester belum tersedia di portal orang tua.</p>
        )}
      </div>

      <div data-tour-id="nilai-semesters" className="space-y-3">
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
                      data-tour-id="nilai-detail"
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
      className="portal-tab-panel space-y-5"
    >
      <div className="space-y-4">
        {/* Card for DSPT */}
        <div data-tour-id="keuangan-dspt-card" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Wallet className="w-32 h-32 -mr-8 -mt-8" />
          </div>
          <div className="relative z-10 flex flex-col h-full justify-between gap-6">
            <div className="flex justify-between items-center gap-3">
              <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                 <span className="p-1.5 bg-slate-100 rounded-md"><Wallet className="w-4 h-4 text-slate-600" /></span>
                 DSPT
              </span>
              {dsptNeedsInput ? (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                  Belum diinput
                </span>
              ) : dsptIsLunas ? (
                <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-teal-800">
                  Lunas
                </span>
              ) : null}
            </div>
            
            <div>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">
                {dsptNeedsInput ? 'Status Tagihan' : 'Sisa Tagihan'}
              </p>
              <p className={`text-2xl font-bold ${dsptNeedsInput ? 'text-amber-700' : dsptSisa > 0 ? 'text-rose-600' : 'text-teal-700'}`}>
                {dsptNeedsInput ? 'Belum diinput' : `Rp ${rupiah(dsptSisa)}`}
              </p>
              {dsptNeedsInput && (
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Nominal DSPT belum tersedia dari bendahara komite. Pembayaran portal akan aktif setelah data tagihan diinput.
                </p>
              )}
            </div>
            
            <div className="flex justify-between items-end border-t border-slate-100 pt-4 mt-2">
              <div>
                <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wide">Target</p>
                <p className="text-sm font-semibold text-slate-700 mt-0.5">{dsptNeedsInput ? '-' : `Rp ${rupiah(dsptTarget)}`}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wide">Lunas</p>
                <p className={`text-sm font-semibold mt-0.5 ${dsptNeedsInput ? 'text-slate-500' : 'text-teal-700'}`}>
                  {dsptNeedsInput ? '-' : `Rp ${rupiah(dsptBayar + dsptDiskon)}`}
                </p>
              </div>
            </div>
            {hasDsptBill && (
              <Dialog
                open={paymentOpen}
                onOpenChange={(open) => {
                  setPaymentOpen(open)
                  if (!open) resetPaymentWizard()
                }}
              >
                <DialogTrigger asChild>
                  <button data-tour-id="keuangan-pay-button" className="h-11 w-full rounded-xl bg-teal-700 px-4 text-sm font-bold text-white shadow-md shadow-teal-700/10 hover:bg-teal-800 transition-all hover:scale-[1.01] active:scale-[0.99]">
                    Bayar DSPT
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md max-h-[92vh] rounded-2xl p-0 border-0 overflow-hidden bg-white">
                  <DialogHeader className="border-b border-slate-100 bg-slate-950 p-5 text-left text-white">
                    <DialogTitle className="text-lg font-semibold">Pembayaran DSPT</DialogTitle>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {[1, 2, 3].map((step) => (
                        <div key={step} className={`h-1.5 rounded-full ${paymentStep >= step ? 'bg-teal-500' : 'bg-white/15'}`} />
                      ))}
                    </div>
                  </DialogHeader>

                  <div className="max-h-[calc(92vh-104px)] overflow-y-auto p-5">
                    {paymentStep === 1 && (
                      <div data-tour-id="payment-step-amount" className="space-y-4">
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
                              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-base font-bold text-slate-900 outline-none focus:border-teal-700"
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
                              className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 hover:border-teal-700 hover:text-teal-900"
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          disabled={!isPaymentAmountValid}
                          onClick={continueToPayment}
                          className="h-11 w-full rounded-xl bg-teal-700 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Lanjut ke Pembayaran
                        </button>
                      </div>
                    )}

                    {paymentStep === 2 && (
                      <div data-tour-id="payment-step-method" className="space-y-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">Pilih metode pembayaran</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">Metode yang nonaktif di pengaturan tidak akan muncul di sini.</p>
                        </div>
                        {(hasQrisMethod || hasTransferMethod) ? (
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              hasQrisMethod ? { value: 'qris', label: 'QRIS', icon: QrCode } : null,
                              hasTransferMethod ? { value: 'transfer', label: 'Transfer', icon: Landmark } : null,
                            ].filter(Boolean).map((item: any) => {
                              const Icon = item.icon
                              const active = paymentMethod === item.value
                              return (
                                <button
                                  key={item.value}
                                  type="button"
                                  onClick={() => setPaymentMethod(item.value as 'qris' | 'transfer')}
                                  className={`flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold ${active ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-slate-200 bg-white text-slate-600'}`}
                                >
                                  <Icon className="h-4 w-4" />
                                  {item.label}
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm font-medium text-rose-700">
                            Metode pembayaran portal sedang dinonaktifkan. Silakan hubungi komite.
                          </div>
                        )}
                        {paymentMethod === 'qris' && hasQrisMethod && (
                          <>
                            <Dialog>
                              <DialogTrigger asChild>
                                <button data-tour-id="payment-qris" type="button" className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100" aria-label="Perbesar QRIS Komite">
                                  <img src={komiteQrisUrl} alt="QRIS Komite MAN 1 Tasikmalaya" className="mx-auto max-h-[260px] w-full rounded-lg object-contain bg-white" />
                                  <span className="mt-2 block text-center text-[11px] font-semibold text-slate-500">Ketuk gambar untuk memperbesar</span>
                                </button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-xl rounded-2xl border-0 bg-white p-0 overflow-hidden">
                                <DialogHeader className="border-b border-slate-100 p-5">
                                  <DialogTitle className="text-lg font-semibold text-slate-800">QRIS Komite</DialogTitle>
                                </DialogHeader>
                                <div className="bg-slate-50 p-4">
                                  <img src={komiteQrisUrl} alt="QRIS Komite MAN 1 Tasikmalaya diperbesar" className="mx-auto max-h-[78vh] w-full rounded-xl object-contain bg-white" />
                                </div>
                              </DialogContent>
                            </Dialog>
                            <a
                              href={komiteQrisUrl}
                              download="QRISkomite.jpeg"
                              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:border-teal-700 hover:text-teal-900"
                            >
                              <Download className="h-4 w-4" />
                                Download QRIS
                            </a>
                          </>
                        )}
                        <div className="grid gap-3">
                          {paymentMethod === 'qris' && hasQrisMethod && (
                            <div className="rounded-xl border border-slate-200 p-4">
                              <div className="flex items-start gap-3">
                                <QrCode className="mt-0.5 h-5 w-5 text-teal-700" />
                                <div>
                                  <p className="text-sm font-bold text-slate-800">QRIS Komite</p>
                                  <p className="text-xs text-slate-500">Gunakan QRIS di atas jika membayar dari e-wallet/mobile banking.</p>
                                </div>
                              </div>
                            </div>
                          )}
                          {paymentMethod === 'transfer' && hasTransferMethod && activePaymentAccounts.map((account: any) => (
                            <div data-tour-id="payment-transfer" key={account.id || account.rekening} className="rounded-xl border border-slate-200 p-4">
                              <div className="flex items-start gap-3">
                                <Landmark className="mt-0.5 h-5 w-5 text-sky-600" />
                                <div>
                                  <p className="text-sm font-bold text-slate-800">{account.bankLabel}: {account.rekening}</p>
                                  <p className="mt-1 text-xs text-slate-500">a.n. {account.atasNama}</p>
                                  <p className="mt-1 text-xs text-slate-500">Nominal DSPT: Rp {rupiah(paymentAmountNumber)}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setPaymentStep(1)} className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700">
                            <ArrowLeft className="mr-1 inline h-4 w-4" />
                            Kembali
                          </button>
                          <button data-tour-id="payment-paid-button" type="button" onClick={startSubmission} disabled={paymentSubmitting || (!hasQrisMethod && !hasTransferMethod)} className="h-11 flex-1 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white disabled:opacity-50">
                            {paymentSubmitting ? 'Mencatat...' : 'Saya Sudah Bayar'}
                          </button>
                        </div>
                        {paymentMessage && <p className="text-xs font-medium text-rose-600">{paymentMessage}</p>}
                      </div>
                    )}

                    {paymentStep === 3 && (
                      <div data-tour-id="payment-step-proof" className="space-y-4">
                        <div className="rounded-xl border border-teal-100 bg-teal-50 p-4">
                          <p className="text-sm font-bold text-teal-900">Upload bukti pembayaran</p>
                          <p className="mt-2 text-xs leading-5 text-teal-800">Bukti akan masuk ke bendahara komite untuk dikonfirmasi. Transaksi resmi dibuat setelah bukti disetujui.</p>
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
                          <div className="mt-2 flex justify-between gap-3">
                            <span className="text-slate-500">Metode</span>
                            <span className="text-right font-semibold">{paymentMethod === 'qris' ? 'QRIS' : 'Transfer'}</span>
                          </div>
                        </div>
                        <label className="block cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center hover:border-teal-500">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleProofFile(e.target.files?.[0])}
                          />
                          {proofPreviewUrl ? (
                            <img src={proofPreviewUrl} alt="Preview bukti pembayaran" className="mx-auto max-h-56 w-full rounded-lg object-contain bg-white" />
                          ) : (
                            <div className="flex flex-col items-center gap-2 text-slate-500">
                              <ImageIcon className="h-8 w-8" />
                              <span className="text-xs font-semibold">Pilih foto/screenshot bukti transfer</span>
                              <span className="text-[11px]">Gambar otomatis dikompres menjadi WebP.</span>
                            </div>
                          )}
                        </label>
                        <button
                          data-tour-id="payment-upload-button"
                          type="button"
                          disabled={!proofFile || !currentSubmissionId || paymentSubmitting}
                          onClick={submitProof}
                          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {paymentSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                          {paymentSubmitting ? 'Mengupload...' : 'Upload Bukti'}
                        </button>
                        {paymentMessage && (
                          <p className={`rounded-xl px-3 py-2 text-xs font-medium ${paymentMessage.includes('berhasil') ? 'bg-teal-50 text-teal-800' : 'bg-rose-50 text-rose-600'}`}>
                            {paymentMessage}
                          </p>
                        )}
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
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 text-sm font-bold text-teal-850 hover:bg-teal-100"
              >
                <MessageCircle className="h-4 w-4" />
                Hubungi Komite
              </a>
            </div>
          </div>
        )}
      </div>

      <div data-tour-id="keuangan-submissions" className="pt-2">
        <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide ml-1 mb-1">Pengajuan Pembayaran DSPT</h2>
        <p className="text-xs text-slate-500 leading-5 ml-1 mb-3">
          Bukti yang sudah diupload akan diperiksa bendahara komite sebelum kuitansi diterbitkan.
        </p>
        <div className="space-y-3">
          {(paymentSubmissions?.results || []).length === 0 ? (
            <div className="text-center py-6 bg-white border border-slate-200 border-dashed rounded-2xl">
              <p className="text-sm text-slate-500">Belum ada pengajuan pembayaran.</p>
            </div>
          ) : (paymentSubmissions.results || []).map((s: any) => {
            const statusLabel: Record<string, string> = {
              belum_upload: 'Belum upload',
              menunggu_konfirmasi: 'Menunggu konfirmasi',
              terkonfirmasi: 'Terkonfirmasi',
              ditolak: 'Ditolak',
            }
            const statusClass: Record<string, string> = {
              belum_upload: 'bg-amber-50 text-amber-700',
              menunggu_konfirmasi: 'bg-sky-50 text-sky-700',
              terkonfirmasi: 'bg-teal-50 text-teal-800',
              ditolak: 'bg-rose-50 text-rose-700',
            }
            const canUpload = s.status === 'belum_upload' || s.status === 'ditolak' || s.status === 'menunggu_konfirmasi'
            return (
              <StandardCard key={s.id} className="space-y-3 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">DSPT - Rp {rupiah(Number(s.jumlah || 0))}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">{String(s.created_at || '').split(' ')[0]} - {s.metode_bayar === 'qris' ? 'QRIS' : 'Transfer'}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusClass[s.status] || 'bg-slate-100 text-slate-600'}`}>
                    {statusLabel[s.status] || s.status}
                  </span>
                </div>
                {s.status === 'ditolak' && s.reject_reason && (
                  <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">Alasan: {s.reject_reason}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {s.bukti_url && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <button type="button" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700">
                          <ImageIcon className="h-3.5 w-3.5" />
                          Lihat Bukti
                        </button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-xl rounded-2xl border-0 bg-white p-0 overflow-hidden">
                        <DialogHeader className="border-b border-slate-100 p-5">
                          <DialogTitle className="text-lg font-semibold text-slate-800">Bukti Pembayaran</DialogTitle>
                        </DialogHeader>
                        <div className="bg-slate-50 p-4">
                          <img src={s.bukti_url} alt="Bukti pembayaran DSPT" className="mx-auto max-h-[78vh] w-full rounded-xl object-contain bg-white" />
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                  {canUpload && (
                    <button
                      type="button"
                      onClick={() => openProofUpload(s)}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 text-xs font-bold text-teal-800"
                    >
                      {s.bukti_url ? <RefreshCw className="h-3.5 w-3.5" /> : <UploadCloud className="h-3.5 w-3.5" />}
                      {s.bukti_url ? 'Ganti Bukti' : 'Upload Bukti'}
                    </button>
                  )}
                  {s.status === 'terkonfirmasi' && s.transaksi_id && (
                    <a
                      href={`/portal-ortu/kuitansi/${s.transaksi_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 text-xs font-bold text-teal-800"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Kuitansi
                    </a>
                  )}
                </div>
              </StandardCard>
            )
          })}
        </div>
      </div>

      <div data-tour-id="keuangan-receipts" className="pt-2">
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
                <div className="w-10 h-10 bg-teal-50 rounded-full text-teal-600 flex items-center justify-center shrink-0">
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
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 text-xs font-bold text-teal-800 hover:bg-teal-100"
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

  const renderSaran = () => {
    const statusMeta: Record<string, { label: string; className: string }> = {
      baru: { label: 'Baru', className: 'bg-rose-50 text-rose-700 border-rose-100' },
      dibaca: { label: 'Dibaca', className: 'bg-sky-50 text-sky-700 border-sky-100' },
      diproses: { label: 'Diproses', className: 'bg-amber-50 text-amber-700 border-amber-100' },
      selesai: { label: 'Selesai', className: 'bg-teal-50 text-teal-800 border-teal-100' },
    }

    return (
      <motion.div
        key="saran"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        className="portal-tab-panel space-y-5"
      >
        <div data-tour-id="saran-hero" className="rounded-[28px] bg-gradient-to-br from-teal-900 to-slate-900 p-6 text-white shadow-md">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-white/10 p-3 text-white">
              <MessageSquareText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Kotak Saran</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">Sampaikan masukan untuk sekolah</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Saran Bapak/Ibu akan diterima oleh pimpinan madrasah dan Tata Usaha untuk ditindaklanjuti.
              </p>
            </div>
          </div>
        </div>

        <StandardCard data-tour-id="saran-form" className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Form Saran</h2>
            <p className="mt-1 text-xs text-slate-500">Isi kategori, judul, dan saran secara singkat namun jelas.</p>
          </div>
          <div className="grid gap-3">
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-600">Kategori</span>
              <select
                value={suggestionCategory}
                onChange={(event) => setSuggestionCategory(event.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-teal-500"
              >
                <option value="">Pilih kategori</option>
                {PARENT_SUGGESTION_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-600">Judul</span>
              <input
                value={suggestionTitle}
                onChange={(event) => setSuggestionTitle(event.target.value)}
                maxLength={120}
                placeholder="Contoh: Perbaikan fasilitas parkir"
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-teal-500"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-600">Isi saran</span>
              <textarea
                value={suggestionMessage}
                onChange={(event) => setSuggestionMessage(event.target.value)}
                maxLength={2000}
                rows={6}
                placeholder="Tuliskan saran Bapak/Ibu..."
                className="resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-teal-500"
              />
              <span className="text-right text-[11px] text-slate-400">{suggestionMessage.length}/2000</span>
            </label>
          </div>
          {suggestionFeedback && (
            <p className={`rounded-xl px-3 py-2 text-xs font-semibold ${suggestionFeedback.startsWith('Terima kasih') ? 'bg-teal-50 text-teal-800' : 'bg-rose-50 text-rose-700'}`}>
              {suggestionFeedback}
            </p>
          )}
          <button
            data-tour-id="saran-submit"
            type="button"
            onClick={submitSuggestion}
            disabled={suggestionSubmitting}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white transition-all hover:bg-teal-800 hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {suggestionSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Kirim Saran
          </button>
        </StandardCard>

        <div data-tour-id="saran-history" className="space-y-3">
          <div className="ml-1">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-800">Saran Saya</h2>
            <p className="mt-1 text-xs text-slate-500">Riwayat saran dan status tindak lanjut dari sekolah.</p>
          </div>
          {suggestionRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-8 text-center">
              <p className="text-sm text-slate-500">Belum ada saran yang dikirim.</p>
            </div>
          ) : suggestionRows.map((item: any) => {
            const meta = statusMeta[item.status] || statusMeta.baru
            return (
              <StandardCard key={item.id} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600">{item.category}</span>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${meta.className}`}>{meta.label}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">{String(item.created_at || '').slice(0, 16)}</span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">{item.title}</h3>
                  <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-600">{item.message}</p>
                </div>
              </StandardCard>
            )
          })}
        </div>
      </motion.div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fafcfa] text-slate-900 [font-family:'Plus_Jakarta_Sans',ui-sans-serif,system-ui] relative overflow-x-hidden">
      <PushNotificationBanner />
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
        .portal-sidebar { display: none; }
        .portal-main { margin-left: 0; }
        .portal-mobile-header { display: flex; }
        .portal-bottom-nav { display: block; }
        .portal-tab-panel { padding-bottom: 6rem; }
        @media (min-width: 768px) and (orientation: landscape) {
          .portal-sidebar { display: flex; }
          .portal-main { margin-left: 260px; }
          .portal-mobile-header { display: none; }
          .portal-bottom-nav { display: none; }
          .portal-tab-panel { padding-bottom: 2rem; }
        }
        h1, h2, h3, h4, .font-semibold, .font-bold { font-family: 'Plus Jakarta Sans', sans-serif; }
        .bg-dots {
          background-image: radial-gradient(rgba(13, 148, 136, 0.04) 1.5px, transparent 1.5px);
          background-size: 24px 24px;
        }
      `}} />
      
      {/* Decorative Dot Grid Overlay */}
      <div className="absolute inset-0 bg-dots pointer-events-none z-0" />
      
      {/* Desktop Sidebar */}
      <aside className="portal-sidebar fixed left-0 top-0 h-screen w-[260px] border-r border-slate-200 bg-white z-40 flex-col py-6 overflow-y-auto">
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
            { id: 'saran', label: 'Kotak Saran', Icon: MessageSquareText },
          ].map(({ id, label, Icon }) => {
            const isActive = activeTab === id
            return (
              <button
                key={id}
                onClick={() => changeTab(id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-teal-700 text-white shadow-sm shadow-teal-700/10' 
                    : 'text-slate-600 hover:bg-teal-50 hover:text-teal-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            )
          })}
        </nav>
        
        <div className="px-4 pt-6 mt-6 border-t border-slate-100 space-y-2">
          <button
            type="button"
            onClick={startPortalTour}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <CircleHelp className="h-4 w-4" />
            Panduan Halaman
          </button>
          <form action="/api/auth/sign-out" method="post">
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors">
              <LogOut className="h-4 w-4" />
              Keluar
            </button>
          </form>
        </div>
      </aside>

      <main className="portal-main min-h-screen flex flex-col">
        {/* Top Header Mobile */}
        <header className="portal-mobile-header sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-5 py-4 items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logokemenag.png" alt="Kemenag" className="h-7 w-auto object-contain" />
            <p className="text-lg text-slate-800 tracking-tight"><span className="font-bold">MANSATAS</span> <span className="font-medium text-slate-500">App</span></p>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={startPortalTour}
              aria-label="Buka panduan halaman"
              className="relative w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"
            >
              <CircleHelp className="h-5 w-5" />
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
            {activeTab === 'saran' && renderSaran()}
          </AnimatePresence>
        </div>
      </main>

      <MobileBottomNav activeTab={activeTab} onChange={changeTab} />
      <PortalTour
        open={tourOpen}
        steps={activeTourSteps}
        onClose={closePortalTour}
        onStepChange={handleTourStepChange}
      />
    </div>
  )
}
