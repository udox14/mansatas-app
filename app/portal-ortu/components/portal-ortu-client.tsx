'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowsClockwise as RefreshCw,
  Bank as Landmark,
  Bell,
  BookOpenText as BookOpenCheck,
  CalendarBlank as CalendarDays,
  CalendarDots as CalendarRange,
  CaretRight as ChevronRight,
  ChatCircle as MessageCircle,
  ChatText as MessageSquareText,
  CheckCircle as CheckCircle2,
  Clock as Clock3,
  DownloadSimple as Download,
  Gear as Settings,
  House,
  ImageSquare as ImageIcon,
  Megaphone,
  QrCode,
  Question as CircleHelp,
  ShieldWarning as ShieldAlert,
  SignOut as LogOut,
  SpinnerGap as Loader2,
  Student as GraduationCap,
  TrendUp as TrendingUp,
  UploadSimple as UploadCloud,
  Wallet,
  Warning as AlertTriangle,
  WarningOctagon as AlertOctagon,
} from '@phosphor-icons/react'
import { MobileBottomNav } from './mobile-bottom-nav'
import { ScheduleTabs } from './schedule-tabs'
import { ChangePasswordForm } from './change-password-form'
import { ParentWhatsAppForm } from './parent-whatsapp-form'
import { SummonResponseForm } from './summon-response-form'
import { PortalTour, type PortalTourStep } from './portal-tour'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { createParentDsptPaymentSubmission, createParentSuggestion, getParentAttendanceByAcademicYear, getParentSemesterGrades, markParentNotificationRead, uploadParentPaymentProof } from '../actions'
import { AvatarSiswa } from '@/components/ui/avatar-siswa'
import { PARENT_SUGGESTION_CATEGORIES } from '@/lib/parent-suggestions'
import { PushNotificationBanner } from '@/components/shared/PushNotificationBanner'
import { MarkdownViewer } from '@/components/documentation/markdown-viewer'
import { currentTimeWIB, formatDateTimeWIB, formatDateWIB } from '@/lib/time'

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
    <div className={`rounded-2xl border border-[#D8D4CC] bg-white p-5 ${className}`} {...props}>
      {children}
    </div>
  )
}

function PortalPageHeader({
  title,
  description,
  Icon,
  tourId,
}: {
  title: string
  description: string
  Icon: React.ComponentType<{ className?: string }>
  tourId?: string
}) {
  return (
    <div data-tour-id={tourId} className="flex min-w-0 items-start justify-between gap-4 border-b border-[#D8D4CC] pb-5">
      <div className="min-w-0">
        <h1 className="text-[clamp(1.75rem,7vw,2.35rem)] font-medium leading-tight tracking-[-0.035em] text-[#1A1A18]">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6B6B63]">{description}</p>
      </div>
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[#D8D4CC] bg-[#F2F0EC] text-[#C2522D]">
        <Icon className="h-6 w-6" />
      </div>
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
  const [selectedBankId, setSelectedBankId] = useState('')
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
  const [selectedDocId, setSelectedDocId] = useState('')
  const [selectedAttendanceYearId, setSelectedAttendanceYearId] = useState(data.attendanceInitial?.tahunAjaran?.id || '')
  const [attendanceDetail, setAttendanceDetail] = useState<any>(data.attendanceInitial || null)
  const [attendanceLoading, setAttendanceLoading] = useState(false)

  const {
    profil,
    kelasLabel,
    waliKelasRow,
    waUrl,
    pengumumanRows,
    weeklyAttendanceSummary,
    weekRange,
    attendanceYears,
    attendanceInitial,
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
    documentationArticles,
  } = data

  const initialLetter = String(profil.nama_lengkap || 'S').slice(0, 1)
  const paymentAmountNumber = Number(paymentAmount || 0)
  const isPaymentAmountValid = paymentAmountNumber > 0
  const isPaymentOverSisa = paymentAmountNumber > Number(dsptSisa || 0)
  const paymentTargetAfterOverpay = Math.max(
    Number(dsptTarget || 0),
    Number(dsptBayar || 0) + paymentAmountNumber + Number(dsptDiskon || 0),
  )
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
  const recentAttendanceRows = attendanceDetail?.recent || []
  const suggestionRows = parentSuggestions?.results || []
  const docsRows = documentationArticles || []
  const selectedDoc = docsRows.find((article: any) => article.id === selectedDocId) || docsRows[0]
  const hasDsptBill = Boolean(dsptIsInput) && Number(dsptSisa || 0) > 0
  const currentHour = currentTimeWIB().hours
  const greeting = currentHour < 4
    ? 'Selamat malam'
    : currentHour < 11
      ? 'Selamat pagi'
      : currentHour < 15
        ? 'Selamat siang'
        : currentHour < 18
          ? 'Selamat sore'
          : 'Selamat malam'
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
    dokumentasi: [
      { target: 'docs-list', title: 'Daftar dokumentasi', description: 'Pilih topik bantuan yang ingin dibaca dari daftar dokumentasi portal orang tua.' },
      { target: 'docs-content', title: 'Isi panduan', description: 'Panduan berisi langkah penggunaan, catatan penting, dan tips agar fitur portal lebih mudah dipakai.' },
    ],
    account: [
      { target: 'account-contact', title: 'Nomor WhatsApp', description: 'Perbarui nomor WhatsApp yang dapat dipakai sekolah untuk menghubungi orang tua atau wali.' },
      { target: 'account-security', title: 'Keamanan akun', description: 'Ganti password portal secara berkala untuk menjaga kerahasiaan data anak.' },
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
          { target: 'payment-step-amount', title: 'Masukkan nominal', description: 'Isi nominal pembayaran. Boleh membayar sebagian, melunasi sisa, atau membayar lebih besar; jika lebih besar, target DSPT akan disesuaikan setelah bendahara mengonfirmasi.' },
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

  useEffect(() => {
    const resetScroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      document.scrollingElement?.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }

    resetScroll()
    const animationFrame = window.requestAnimationFrame(resetScroll)
    const afterTransition = window.setTimeout(resetScroll, 360)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.clearTimeout(afterTransition)
    }
  }, [activeTab])

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
    const bankAccountId = paymentMethod === 'transfer' ? (selectedBankId || activePaymentAccounts[0]?.id) : undefined
    if (paymentMethod === 'transfer' && !bankAccountId) {
      setPaymentMessage('Pilih bank tujuan transfer dulu.')
      return
    }
    setPaymentSubmitting(true)
    setPaymentMessage('')
    const res = await createParentDsptPaymentSubmission({ amount: paymentAmountNumber, method: paymentMethod, bankAccountId })
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

  const changeAttendanceYear = async (tahunAjaranId: string) => {
    setSelectedAttendanceYearId(tahunAjaranId)
    setAttendanceLoading(true)
    const result = await getParentAttendanceByAcademicYear(tahunAjaranId)
    if (!(result as any).error) setAttendanceDetail(result)
    setAttendanceLoading(false)
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
        className="portal-tab-panel flex flex-col gap-5"
      >
        <section
          data-tour-id="beranda-profile"
          className="order-1 overflow-hidden rounded-2xl border border-[#D8D4CC] bg-[#F2F0EC] p-4 sm:p-6"
        >
          <div className="grid min-w-0 grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-4 sm:grid-cols-[132px_minmax(0,1fr)] sm:gap-x-6 md:grid-cols-[156px_minmax(0,1fr)]">
            <div className="portal-student-photo aspect-[3/4] min-w-0 overflow-hidden rounded-xl border border-[#D8D4CC] bg-[#E8E5E0] sm:row-span-2">
              <AvatarSiswa
                fotoUrl={profil.foto_url}
                nama={profil.nama_lengkap || initialLetter}
                size="full"
                className="h-full w-full rounded-none border-0 bg-[#E8E5E0] text-[#6B6B63]"
              />
            </div>

            <div className="flex min-w-0 flex-col justify-end">
              <p className="mb-2 whitespace-nowrap text-[11px] font-semibold text-[#C2522D] sm:text-xs">{greeting}, orang tua,</p>
              <h1 className="line-clamp-3 max-w-2xl text-[clamp(1.2rem,5vw,2.35rem)] font-medium leading-[1.08] tracking-[-0.035em] text-[#1A1A18]">
                {profil.nama_lengkap}
              </h1>
            </div>

            <dl className="col-span-2 grid min-w-0 grid-cols-2 gap-x-4 gap-y-2 border-t border-[#D8D4CC] pt-3 text-xs sm:col-span-1 sm:col-start-2 sm:max-w-md sm:text-sm">
              <div className="min-w-0">
                <dt className="shrink-0 text-[#6B6B63]">Kelas</dt>
                <dd className="mt-0.5 truncate whitespace-nowrap font-semibold text-[#1A1A18]">{kelasLabel}</dd>
              </div>
              <div className="min-w-0">
                <dt className="shrink-0 text-[#6B6B63]">NISN</dt>
                <dd className="mt-0.5 truncate whitespace-nowrap font-semibold tabular-nums text-[#1A1A18]">{profil.nisn || '-'}</dd>
              </div>
            </dl>
          </div>
        </section>

        <StandardCard data-tour-id="beranda-stats" className="order-3 overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
            <div>
              <p className="text-sm font-bold text-slate-900">Kehadiran minggu ini</p>
              <p className="mt-0.5 text-[11px] text-slate-500">Senin–Sabtu · {formatDateWIB(weekRange.start)}–{formatDateWIB(weekRange.end)}</p>
            </div>
            <CalendarRange className="h-5 w-5 text-teal-700" />
          </div>
          <div className="grid grid-cols-4 divide-x divide-slate-100">
            {[
              { label: 'Hadir', value: weeklyAttendanceSummary?.hadir || 0, tone: 'text-[#246142]' },
              { label: 'Sakit', value: weeklyAttendanceSummary?.sakit || 0, tone: 'text-amber-600' },
              { label: 'Izin', value: weeklyAttendanceSummary?.izin || 0, tone: 'text-sky-600' },
              { label: 'Alfa', value: weeklyAttendanceSummary?.alfa || 0, tone: 'text-rose-600' },
            ].map((item) => (
              <div key={item.label} className="px-2 py-4 text-center">
                <p className={`text-2xl font-black tabular-nums ${item.tone}`}>{item.value}</p>
                <p className="mt-1 whitespace-nowrap text-[11px] font-semibold text-[#6B6B63]">{item.label}</p>
              </div>
            ))}
          </div>
        </StandardCard>

        <div className="order-4 grid gap-3 sm:grid-cols-2">
          <StandardCard data-tour-id="beranda-wali" className="flex items-center gap-3 p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700"><ShieldAlert className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Wali kelas</p>
              <p className="truncate text-sm font-bold text-slate-900">{waliKelasRow?.nama_lengkap || 'Belum diatur'}</p>
            </div>
            {waUrl && <a href={waUrl} target="_blank" aria-label="Hubungi wali kelas" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100"><MessageCircle className="h-4 w-4" /></a>}
          </StandardCard>
          <StandardCard className="flex items-center gap-3 p-4">
            <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${needsDisciplineAttention ? 'bg-amber-50 text-amber-700' : 'bg-teal-50 text-teal-700'}`}><ShieldAlert className="h-5 w-5" /></div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Pendampingan</p>
              <p className={`truncate text-sm font-bold ${needsDisciplineAttention ? 'text-amber-800' : 'text-teal-800'}`}>{disciplineLevelLabel}</p>
            </div>
          </StandardCard>
        </div>

        {/* Critical Notifications / Summons */}
        {(activeSummons.length > 0 || activeNotifications.length > 0) && (
          <div data-tour-id="beranda-alerts" className="order-2 space-y-3">
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
                <DialogContent className="portal-dialog overflow-hidden rounded-2xl border border-[#D8D4CC] bg-[#FAF9F7] p-0 sm:max-w-md">
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
                   <div className="min-w-0 flex-1 pr-2">
                     <h3 className="text-sm font-semibold text-slate-800">{n.title}</h3>
                     <p className="text-sm text-slate-600 mt-1">{n.message}</p>
                   </div>
                   <button 
                     type="button"
                     onClick={() => {
                       setHiddenNotifications(prev => new Set(prev).add(n.id))
                       markParentNotificationRead(n.id)
                     }}
                     className="shrink-0 whitespace-nowrap rounded-lg bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800"
                   >
                     Tandai Selesai
                   </button>
                 </div>
               </StandardCard>
            ))}
          </div>
        )}

        {/* Announcements */}
        <div data-tour-id="beranda-announcements" className="order-5 pt-2">
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
                          <p className="text-xs text-slate-500 mt-1">{formatDateWIB(item.publish_at)}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      </div>
                    </StandardCard>
                  </button>
                </DialogTrigger>
                <DialogContent className="portal-dialog overflow-hidden rounded-2xl border border-[#D8D4CC] bg-[#FAF9F7] p-0 sm:max-w-md">
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
          <div className="order-6 pt-2">
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
                    <p className="text-[11px] text-slate-400 mt-2">{formatDateTimeWIB(note.created_at)} WIB</p>
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
      <PortalPageHeader
        tourId="jadwal-header"
        title="Jadwal pelajaran"
        description="Lihat jadwal kelas dan status absensi anak per jam pelajaran berdasarkan input guru."
        Icon={CalendarDays}
      />

      <div>
        <ScheduleTabs jadwalByDay={jadwalObject as any} />
      </div>
    </motion.div>
  )

  const renderKehadiran = () => {
    const summary = attendanceDetail?.summary || {}
    const monthly = attendanceDetail?.monthly || []
    const statusMeta: Record<string, { label: string; className: string }> = {
      HADIR: { label: 'Hadir', className: 'bg-[#EEF7F1] text-[#246142]' },
      SAKIT: { label: 'Sakit', className: 'bg-amber-50 text-amber-700' },
      IZIN: { label: 'Izin', className: 'bg-sky-50 text-sky-700' },
      ALFA: { label: 'Tanpa keterangan', className: 'bg-rose-50 text-rose-700' },
      PARSIAL: { label: 'Parsial', className: 'bg-violet-50 text-violet-700' },
      PERLU_KONFIRMASI_WALI: { label: 'Perlu dicek walas', className: 'bg-violet-50 text-violet-700' },
      BELUM_ADA_INPUT: { label: 'Belum diinput', className: 'bg-slate-100 text-slate-600' },
      BELUM_ADA_DATA: { label: 'Data belum lengkap', className: 'bg-slate-100 text-slate-600' },
    }

    return (
      <motion.div key="kehadiran" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="portal-tab-panel space-y-5">
        <PortalPageHeader
          title="Rekap kehadiran"
          description="Bandingkan catatan anak per tahun ajaran dan semester."
          Icon={CalendarRange}
        />

        <div className="rounded-2xl border border-[#D8D4CC] bg-white p-3">
          <label className="relative block min-w-0">
            <span className="sr-only">Pilih tahun ajaran dan semester</span>
            <CalendarRange className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B6B63]" />
            <select value={selectedAttendanceYearId} onChange={(event) => changeAttendanceYear(event.target.value)} className="h-11 w-full appearance-none rounded-lg border border-[#D8D4CC] bg-[#F2F0EC] pl-9 pr-8 text-sm font-semibold text-[#1A1A18] outline-none transition-colors focus:border-[#C2522D] focus:ring-2 focus:ring-[#C2522D]/20">
              {(attendanceYears || []).map((item: any) => <option key={item.id} value={item.id}>{item.nama} · Semester {item.semester}</option>)}
            </select>
          </label>
        </div>

        {attendanceLoading ? (
          <div className="grid min-h-56 place-items-center rounded-2xl border border-slate-200 bg-white"><Loader2 className="h-6 w-6 animate-spin text-teal-700" /></div>
        ) : (
          <>
            <div data-tour-id="kehadiran-summary" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="col-span-2 rounded-2xl border border-[#D8D4CC] bg-[#E8E5E0] p-5 text-[#1A1A18] sm:col-span-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-[#6B6B63]">Tingkat kehadiran</p>
                    <p className="mt-1 text-4xl font-black tracking-tight">{summary.attendanceRate ?? '-'}{summary.attendanceRate !== null && summary.attendanceRate !== undefined ? '%' : ''}</p>
                  </div>
                  <TrendingUp className="h-5 w-5 text-[#C2522D]" />
                </div>
                <p className="mt-4 text-xs leading-5 text-[#6B6B63]">{summary.hadir || 0} hari hadir dari {summary.completedDays || 0} hari dengan status final.</p>
              </div>
              {[
                { label: 'Sakit', value: summary.sakit || 0, tone: 'text-amber-700', bg: 'bg-amber-50' },
                { label: 'Izin', value: summary.izin || 0, tone: 'text-sky-700', bg: 'bg-sky-50' },
                { label: 'Alfa', value: summary.alfa || 0, tone: 'text-rose-700', bg: 'bg-rose-50' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className={`grid h-8 w-8 place-items-center rounded-lg ${item.bg}`}><Clock3 className={`h-4 w-4 ${item.tone}`} /></div>
                  <p className={`mt-4 text-2xl font-black tabular-nums ${item.tone}`}>{item.value}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{item.label}</p>
                </div>
              ))}
            </div>

            <StandardCard className="space-y-4" data-tour-id="kehadiran-trend">
              <div>
                <p className="text-sm font-bold text-slate-900">Perubahan bulanan</p>
                <p className="mt-0.5 text-xs text-slate-500">Proporsi status final pada setiap bulan pembelajaran.</p>
              </div>
              {monthly.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">Belum ada data pada periode ini.</p> : (
                <div className="space-y-3">
                  {monthly.map((item: any) => {
                    const total = item.hadir + item.sakit + item.izin + item.alfa + item.perluKonfirmasi
                    return (
                      <div key={item.month} className="grid grid-cols-[74px_1fr_34px] items-center gap-3">
                        <span className="text-xs font-bold text-slate-600">{new Intl.DateTimeFormat('id-ID', { month: 'short', year: '2-digit' }).format(new Date(`${item.month}-01T00:00:00`))}</span>
                        <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
                          {total > 0 && <>
                            <span className="bg-teal-500" style={{ width: `${(item.hadir / total) * 100}%` }} />
                            <span className="bg-amber-400" style={{ width: `${(item.sakit / total) * 100}%` }} />
                            <span className="bg-sky-400" style={{ width: `${(item.izin / total) * 100}%` }} />
                            <span className="bg-rose-500" style={{ width: `${(item.alfa / total) * 100}%` }} />
                            <span className="bg-violet-400" style={{ width: `${(item.perluKonfirmasi / total) * 100}%` }} />
                          </>}
                        </div>
                        <span className="text-right text-xs font-bold text-slate-500">{total}</span>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-[10px] font-semibold text-slate-500">
                {[['bg-teal-500','Hadir'],['bg-amber-400','Sakit'],['bg-sky-400','Izin'],['bg-rose-500','Alfa'],['bg-violet-400','Perlu dicek walas']].map(([color,label]) => <span key={label} className="flex items-center gap-1.5"><i className={`h-2 w-2 rounded-full ${color}`} />{label}</span>)}
              </div>
            </StandardCard>

            <div data-tour-id="kehadiran-recent" className="space-y-3">
              <div className="ml-1"><h2 className="text-sm font-bold text-slate-900">Catatan yang perlu diketahui</h2><p className="mt-0.5 text-xs text-slate-500">Ketidakhadiran dan catatan khusus terbaru.</p></div>
              <StandardCard className="overflow-hidden p-0">
                {recentAttendanceRows.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">Tidak ada catatan khusus pada periode ini.</p> : (
                  <div className="divide-y divide-slate-100">
                    {recentAttendanceRows.map((row: any, index: number) => {
                      const meta = statusMeta[row.status_akhir] || statusMeta.BELUM_ADA_DATA
                      const note = row.keterangan_wali_kelas || row.detail_guru?.find((detail: any) => detail.catatan)?.catatan
                      return <div key={`${row.tanggal}-${index}`} className="flex items-start gap-3 p-4"><span className={`mt-0.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${meta.className}`}>{meta.label}</span><div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-800">{formatDateWIB(row.tanggal)}</p>{note && <p className="mt-1 text-xs leading-5 text-slate-500">{note}</p>}</div></div>
                    })}
                  </div>
                )}
              </StandardCard>
            </div>

            <StandardCard data-tour-id="kehadiran-discipline" className={`flex items-center gap-4 p-4 ${needsDisciplineAttention ? 'border-amber-200' : 'border-teal-100'}`}>
              <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${needsDisciplineAttention ? 'bg-amber-50 text-amber-700' : 'bg-teal-50 text-teal-700'}`}><ShieldAlert className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Status pendampingan</p><p className="text-sm font-bold text-slate-900">{disciplineLevelLabel}</p><p className="mt-0.5 text-xs text-slate-500">{disciplineSummary?.totalKasus || 0} catatan kedisiplinan tercatat.</p></div>
              {needsDisciplineAttention && waUrl && <a href={waUrl} target="_blank" aria-label="Hubungi wali kelas" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-700"><MessageCircle className="h-4 w-4" /></a>}
            </StandardCard>
          </>
        )}
      </motion.div>
    )
  }

  const renderNilai = () => (
    <motion.div
      key="nilai"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="portal-tab-panel space-y-5"
    >
      <PortalPageHeader
        title="Akademik"
        description="Pantau ringkasan nilai rapor dan rincian mata pelajaran pada setiap semester."
        Icon={GraduationCap}
      />

      <div data-tour-id="nilai-average" className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 text-center">
        <div className="w-12 h-12 bg-indigo-50 text-indigo-500 mx-auto rounded-full flex items-center justify-center mb-4">
          <GraduationCap className="h-6 w-6" />
        </div>
        <p className="text-slate-500 text-sm font-medium mb-1">Rata-rata Nilai Keseluruhan</p>
        <h1 className="text-4xl font-bold text-slate-800">{semesterAvg ?? '-'}</h1>
        {semesterAvg === null && (
          <p className="mt-3 text-sm leading-6 text-slate-500">Rekap nilai semester belum tersedia di portal orang tua.</p>
        )}
        <div className="mx-auto mt-4 flex max-w-md items-start gap-2 rounded-xl bg-indigo-50 px-3 py-2.5 text-left">
          <BookOpenCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
          <p className="text-xs leading-5 text-indigo-800">Data yang tampil adalah <strong>nilai rapor</strong> dan diperbarui oleh sekolah pada setiap akhir semester.</p>
        </div>
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
                    <span className="block truncate text-sm font-semibold text-slate-800">{s.label}</span>
                    <span className="mt-1 block text-xs text-slate-500">Nilai rapor semester</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <span className={`block whitespace-nowrap text-2xl font-bold tabular-nums ${isFilled ? 'text-indigo-600' : 'text-slate-300'}`}>
                        {s.value ?? '-'}
                      </span>
                      <span className="block whitespace-nowrap text-[10px] font-medium text-slate-400">rata-rata</span>
                    </div>
                    <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition-colors ${
                      isFilled ? 'border-indigo-100 bg-indigo-50 text-indigo-600' : 'border-slate-100 bg-white text-slate-300'
                    }`}>
                      <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
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
                <span className="whitespace-nowrap rounded-md bg-[#EEF7F1] px-2.5 py-1 text-[10px] font-bold text-[#246142]">
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
                  <button data-tour-id="keuangan-pay-button" className="h-11 w-full whitespace-nowrap rounded-lg bg-teal-700 px-4 text-sm font-bold text-white transition-colors hover:bg-teal-800">
                    Bayar DSPT
                  </button>
                </DialogTrigger>
                <DialogContent className="portal-dialog max-h-[92dvh] overflow-hidden rounded-2xl border border-[#D8D4CC] bg-[#FAF9F7] p-0 sm:max-w-md">
                  <DialogHeader className="border-b border-[#D8D4CC] bg-[#F2F0EC] p-5 text-left text-[#1A1A18]">
                    <DialogTitle className="text-lg font-medium tracking-[-0.02em]">Pembayaran DSPT</DialogTitle>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {[1, 2, 3].map((step) => (
                        <div key={step} className={`h-1.5 rounded-full ${paymentStep >= step ? 'bg-[#C2522D]' : 'bg-[#D8D4CC]'}`} />
                      ))}
                    </div>
                  </DialogHeader>

                  <div className="max-h-[calc(92vh-104px)] overflow-y-auto p-5">
                    {paymentStep === 1 && (
                      <div data-tour-id="payment-step-amount" className="space-y-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">Masukkan nominal pembayaran</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">Boleh membayar sebagian, melunasi sisa, atau membayar lebih besar dari sisa DSPT.</p>
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
                            <p className="mt-2 text-xs font-medium text-rose-600">Nominal harus lebih dari 0.</p>
                          )}
                          {paymentAmount && isPaymentOverSisa && (
                            <p className="mt-2 rounded-xl bg-teal-50 px-3 py-2 text-xs font-semibold leading-5 text-teal-800">
                              Nominal melebihi sisa DSPT. Setelah dikonfirmasi bendahara, target DSPT akan otomatis menjadi Rp {rupiah(paymentTargetAfterOverpay)}.
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {quickPaymentAmounts.map((item) => (
                            <button
                              key={item.label}
                              type="button"
                              onClick={() => setPaymentAmount(String(item.value))}
                              className="h-11 whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 hover:border-teal-700 hover:text-teal-900"
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          disabled={!isPaymentAmountValid}
                          onClick={continueToPayment}
                          className="h-11 w-full whitespace-nowrap rounded-lg bg-teal-700 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
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
                                  className={`flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-3 text-xs font-bold ${active ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-slate-200 bg-white text-slate-600'}`}
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
                              <DialogContent className="portal-dialog overflow-hidden rounded-2xl border border-[#D8D4CC] bg-[#FAF9F7] p-0 sm:max-w-xl">
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
                              className="inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:border-teal-700 hover:text-teal-900"
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
                          {paymentMethod === 'transfer' && hasTransferMethod && (
                            <p className="text-xs font-semibold text-slate-600">Pilih bank tujuan transfer:</p>
                          )}
                          {paymentMethod === 'transfer' && hasTransferMethod && activePaymentAccounts.map((account: any) => {
                            const isSelected = (selectedBankId || activePaymentAccounts[0]?.id) === account.id
                            return (
                            <button
                              type="button"
                              data-tour-id="payment-transfer"
                              key={account.id || account.rekening}
                              onClick={() => setSelectedBankId(account.id)}
                              className={`w-full rounded-xl border p-4 text-left transition ${isSelected ? 'border-sky-500 ring-2 ring-sky-200 bg-sky-50' : 'border-slate-200'}`}
                            >
                              <div className="flex items-start gap-3">
                                <Landmark className={`mt-0.5 h-5 w-5 ${isSelected ? 'text-sky-600' : 'text-slate-400'}`} />
                                <div>
                                  <p className="text-sm font-bold text-slate-800">{account.bankLabel}: {account.rekening}</p>
                                  <p className="mt-1 text-xs text-slate-500">a.n. {account.atasNama}</p>
                                  <p className="mt-1 text-xs text-slate-500">Nominal DSPT: Rp {rupiah(paymentAmountNumber)}</p>
                                </div>
                              </div>
                            </button>
                            )
                          })}
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setPaymentStep(1)} className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700">
                            <ArrowLeft className="mr-1 inline h-4 w-4" />
                            Kembali
                          </button>
                          <button data-tour-id="payment-paid-button" type="button" onClick={startSubmission} disabled={paymentSubmitting || (!hasQrisMethod && !hasTransferMethod)} className="h-11 flex-1 whitespace-nowrap rounded-lg bg-teal-700 px-3 text-sm font-bold text-white disabled:opacity-50">
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
                          className="flex h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-teal-700 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {paymentSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                          {paymentSubmitting ? 'Mengupload...' : 'Upload Bukti'}
                        </button>
                        {paymentMessage && (
                          <p className={`rounded-xl px-3 py-2 text-xs font-medium ${paymentMessage.includes('berhasil') ? 'bg-teal-50 text-teal-800' : 'bg-rose-50 text-rose-600'}`}>
                            {paymentMessage}
                          </p>
                        )}
                        <button type="button" onClick={() => setPaymentOpen(false)} className="h-11 w-full whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700">
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
                className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-teal-200 bg-teal-50 px-4 text-sm font-bold text-teal-850 hover:bg-teal-100"
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
              terkonfirmasi: 'bg-[#EEF7F1] text-[#246142]',
              ditolak: 'bg-rose-50 text-rose-700',
            }
            const canUpload = s.status === 'belum_upload' || s.status === 'ditolak' || s.status === 'menunggu_konfirmasi'
            return (
              <StandardCard key={s.id} className="space-y-3 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">DSPT - Rp {rupiah(Number(s.jumlah || 0))}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">{formatDateTimeWIB(s.created_at)} WIB - {s.metode_bayar === 'qris' ? 'QRIS' : 'Transfer'}</p>
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
                        <button type="button" className="inline-flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700">
                          <ImageIcon className="h-3.5 w-3.5" />
                          Lihat Bukti
                        </button>
                      </DialogTrigger>
                      <DialogContent className="portal-dialog overflow-hidden rounded-2xl border border-[#D8D4CC] bg-[#FAF9F7] p-0 sm:max-w-xl">
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
                      className="inline-flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-teal-200 bg-teal-50 px-3 text-xs font-bold text-teal-800"
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
                      className="inline-flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-teal-200 bg-teal-50 px-3 text-xs font-bold text-teal-800"
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
                  <p className="text-[11px] text-slate-500 mt-0.5">{formatDateTimeWIB(t.created_at)} WIB • {t.metode_bayar}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <p className="text-sm font-bold text-slate-800">Rp {rupiah(Number(t.jumlah_total || 0))}</p>
                <a
                  href={`/portal-ortu/kuitansi/${t.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-teal-200 bg-teal-50 px-3 text-xs font-bold text-teal-800 hover:bg-teal-100"
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
      selesai: { label: 'Selesai', className: 'border-[#BFD7C8] bg-[#EEF7F1] text-[#246142]' },
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
        <PortalPageHeader
          tourId="saran-hero"
          title="Kotak saran"
          description="Masukan diteruskan kepada pimpinan madrasah dan Tata Usaha untuk ditindaklanjuti."
          Icon={MessageSquareText}
        />

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
            className="inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-teal-700 px-4 text-sm font-bold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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
                  <span className="text-[11px] text-slate-400">{formatDateTimeWIB(item.created_at)} WIB</span>
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

  const renderDokumentasi = () => (
    <motion.div
      key="dokumentasi"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="portal-tab-panel space-y-5"
    >
      <PortalPageHeader
        title="Dokumentasi"
        description="Baca panduan penggunaan fitur portal sesuai layanan yang tersedia untuk orang tua."
        Icon={CircleHelp}
      />

      {docsRows.length > 0 && (
        <label data-tour-id="docs-list" className="grid gap-1.5 md:hidden">
          <span className="text-xs font-semibold text-[#6B6B63]">Pilih panduan</span>
          <select
            value={selectedDoc?.id || ''}
            onChange={(event) => setSelectedDocId(event.target.value)}
            className="h-11 w-full rounded-lg border border-[#D8D4CC] bg-white px-3 text-sm font-semibold text-[#1A1A18] outline-none focus:border-[#C2522D]"
          >
            {docsRows.map((article: any) => <option key={article.id} value={article.id}>{article.title}</option>)}
          </select>
        </label>
      )}

      <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
        <div data-tour-id="docs-list" className="hidden space-y-2 md:block">
          {docsRows.length === 0 ? (
            <StandardCard className="text-center text-sm text-slate-500">Belum ada dokumentasi yang tersedia.</StandardCard>
          ) : docsRows.map((article: any) => {
            const active = selectedDoc?.id === article.id
            return (
              <button
                key={article.id}
                type="button"
                onClick={() => setSelectedDocId(article.id)}
                className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                  active
                    ? 'border-teal-200 bg-teal-50 text-teal-950'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <p className="text-sm font-bold leading-snug">{article.title}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{article.summary}</p>
              </button>
            )
          })}
        </div>

        <StandardCard data-tour-id="docs-content" className="min-w-0">
          {selectedDoc ? (
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Panduan</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">{selectedDoc.title}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">{selectedDoc.summary}</p>
              </div>
              <MarkdownViewer content={selectedDoc.content_md} compact />
            </div>
          ) : (
            <p className="text-sm text-slate-500">Pilih dokumentasi untuk dibaca.</p>
          )}
        </StandardCard>
      </div>
    </motion.div>
  )

  const renderAccount = () => (
    <motion.div
      key="account"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="portal-tab-panel space-y-5"
    >
      <PortalPageHeader
        title="Pengaturan akun"
        description="Kelola nomor WhatsApp orang tua dan keamanan akun portal."
        Icon={Settings}
      />

      <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:items-start">
        <section data-tour-id="account-contact" className="min-w-0 rounded-2xl border border-[#D8D4CC] bg-[#F2F0EC] p-4 sm:p-5">
          <ParentWhatsAppForm initialNumber={profil.nomor_whatsapp || ''} />
        </section>
        <section data-tour-id="account-security" className="min-w-0 rounded-2xl border border-[#D8D4CC] bg-[#F2F0EC] p-4 sm:p-5">
          <ChangePasswordForm />
        </section>
      </div>
    </motion.div>
  )

  return (
    <div className="portal-root relative min-h-[100dvh] overflow-x-hidden bg-[#FAF9F7] text-[#1A1A18] [color-scheme:light]">
      <PushNotificationBanner />
      <style dangerouslySetInnerHTML={{__html: `
        .portal-root,
        .portal-dialog {
          font-family: 'Styrene A', 'Styrene B', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color-scheme: light;
          --portal-canvas: #FAF9F7;
          --portal-surface: #F2F0EC;
          --portal-surface-strong: #E8E5E0;
          --portal-border: #D8D4CC;
          --portal-ink: #1A1A18;
          --portal-muted: #6B6B63;
          --portal-primary: #C2522D;
          --portal-primary-hover: #A8421F;
        }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
        .portal-sidebar { display: none; }
        .portal-main { margin-left: 0; }
        .portal-mobile-header { display: flex; }
        .portal-bottom-nav { display: block; }
        .portal-tab-panel { padding-bottom: 6rem; }
        .portal-student-photo img { object-position: center 18%; }
        .portal-root :focus-visible,
        .portal-dialog :focus-visible { outline-color: #C2522D; }
        :is(.portal-root,.portal-dialog) .bg-slate-50,
        :is(.portal-root,.portal-dialog) .bg-slate-100 { background-color: #F2F0EC; }
        :is(.portal-root,.portal-dialog) .border-slate-100,
        :is(.portal-root,.portal-dialog) .border-slate-200,
        :is(.portal-root,.portal-dialog) .border-slate-300 { border-color: #D8D4CC; }
        :is(.portal-root,.portal-dialog) .text-slate-900,
        :is(.portal-root,.portal-dialog) .text-slate-800,
        :is(.portal-root,.portal-dialog) .text-slate-700 { color: #1A1A18; }
        :is(.portal-root,.portal-dialog) .text-slate-600,
        :is(.portal-root,.portal-dialog) .text-slate-500,
        :is(.portal-root,.portal-dialog) .text-slate-400 { color: #6B6B63; }
        :is(.portal-root,.portal-dialog) .bg-teal-700 { background-color: #C2522D; }
        :is(.portal-root,.portal-dialog) .hover\\:bg-teal-800:hover { background-color: #A8421F; }
        :is(.portal-root,.portal-dialog) .bg-teal-50,
        :is(.portal-root,.portal-dialog) .bg-teal-100 { background-color: #F2F0EC; }
        :is(.portal-root,.portal-dialog) .text-teal-700,
        :is(.portal-root,.portal-dialog) .text-teal-800,
        :is(.portal-root,.portal-dialog) .text-teal-850,
        :is(.portal-root,.portal-dialog) .text-teal-900,
        :is(.portal-root,.portal-dialog) .text-teal-950 { color: #C2522D; }
        :is(.portal-root,.portal-dialog) .border-teal-100,
        :is(.portal-root,.portal-dialog) .border-teal-200 { border-color: #D8D4CC; }
        :is(.portal-root,.portal-dialog) .bg-indigo-50 { background-color: #F2F0EC; }
        :is(.portal-root,.portal-dialog) .text-indigo-500,
        :is(.portal-root,.portal-dialog) .text-indigo-600,
        :is(.portal-root,.portal-dialog) .text-indigo-700,
        :is(.portal-root,.portal-dialog) .text-indigo-800 { color: #C2522D; }
        :is(.portal-root,.portal-dialog) .border-indigo-100 { border-color: #D8D4CC; }
        @media (min-width: 1024px) {
          .portal-sidebar { display: flex; }
          .portal-main { margin-left: 264px; }
          .portal-mobile-header { display: none; }
          .portal-bottom-nav { display: none; }
          .portal-tab-panel { padding-bottom: 2rem; }
        }
        @media (prefers-reduced-motion: reduce) {
          .portal-root *, .portal-root *::before, .portal-root *::after,
          .portal-dialog *, .portal-dialog *::before, .portal-dialog *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}} />

      {/* Desktop Sidebar */}
      <aside className="portal-sidebar fixed left-0 top-0 z-40 h-[100dvh] w-[264px] flex-col overflow-y-auto border-r border-[#D8D4CC] bg-[#F2F0EC] py-6">
        <div className="mb-8 flex items-center gap-3 px-6">
          <img src="/logokemenag.png" alt="Kemenag" className="h-8 w-auto object-contain" />
          <h2 className="whitespace-nowrap text-lg font-medium tracking-[-0.025em] text-[#1A1A18]">MANSATAS <span className="text-[#6B6B63]">App</span></h2>
        </div>
        
        <nav className="flex flex-col gap-1 px-4 flex-1">
          <p className="mb-2 mt-4 px-3 text-xs font-semibold text-[#6B6B63]">Menu orang tua</p>
          {[
            { id: 'beranda', label: 'Beranda', Icon: House },
            { id: 'jadwal', label: 'Jadwal Kelas', Icon: CalendarDays },
            { id: 'kehadiran', label: 'Kehadiran', Icon: BookOpenCheck },
            { id: 'nilai', label: 'Akademik', Icon: GraduationCap },
            { id: 'keuangan', label: 'Keuangan', Icon: Wallet },
            { id: 'saran', label: 'Kotak Saran', Icon: MessageSquareText },
            { id: 'dokumentasi', label: 'Dokumentasi', Icon: CircleHelp },
          ].map(({ id, label, Icon }) => {
            const isActive = activeTab === id
            return (
              <button
                key={id}
                onClick={() => changeTab(id)}
                className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#C2522D] ${
                  isActive 
                    ? 'bg-white text-[#C2522D] shadow-sm'
                    : 'text-[#6B6B63] hover:bg-white hover:text-[#1A1A18]'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate whitespace-nowrap">{label}</span>
              </button>
            )
          })}
        </nav>
        
        <div className="mt-6 space-y-2 border-t border-[#D8D4CC] px-4 pt-6">
          <button
            type="button"
            onClick={() => changeTab('account')}
            aria-current={activeTab === 'account' ? 'page' : undefined}
            className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === 'account'
                ? 'bg-white text-[#C2522D] shadow-sm'
                : 'text-[#6B6B63] hover:bg-white hover:text-[#1A1A18]'
            }`}
          >
            <Settings className="h-4 w-4" />
            Pengaturan akun
          </button>
          <button
            type="button"
            onClick={startPortalTour}
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#6B6B63] transition-colors hover:bg-white hover:text-[#1A1A18]"
          >
            <CircleHelp className="h-4 w-4" />
            Panduan Halaman
          </button>
          <form action="/api/auth/sign-out" method="post">
            <button className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#A63D32] transition-colors hover:bg-[#FFF1EF]">
              <LogOut className="h-4 w-4" />
              Keluar
            </button>
          </form>
        </div>
      </aside>

      <main className="portal-main flex min-h-[100dvh] flex-col">
        {/* Top Header Mobile */}
        <header className="portal-mobile-header sticky top-0 z-30 items-center justify-between border-b border-[#D8D4CC] bg-[#FAF9F7]/94 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <img src="/logokemenag.png" alt="Kemenag" className="h-7 w-auto object-contain" />
            <p className="whitespace-nowrap text-base font-medium tracking-[-0.02em] text-[#1A1A18]">MANSATAS <span className="text-[#6B6B63]">App</span></p>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={startPortalTour}
              aria-label="Buka panduan halaman"
              className="relative grid h-11 w-11 place-items-center rounded-lg text-[#6B6B63] transition-colors hover:bg-[#F2F0EC] hover:text-[#C2522D]"
            >
              <CircleHelp className="h-5 w-5" />
            </button>
            <form action="/api/auth/sign-out" method="post">
              <button className="grid h-11 w-11 place-items-center rounded-lg text-[#A63D32] transition-colors hover:bg-[#FFF1EF]">
                <LogOut className="h-5 w-5" />
              </button>
            </form>
          </div>
        </header>

        {/* Content Box */}
        <div className="mx-auto w-full max-w-[1100px] flex-1 px-4 pb-4 pt-5 sm:px-6 sm:pt-7 lg:px-8 lg:py-8">
          <AnimatePresence mode="wait">
            {activeTab === 'beranda' && renderBeranda()}
            {activeTab === 'jadwal' && renderJadwal()}
            {activeTab === 'kehadiran' && renderKehadiran()}
            {activeTab === 'nilai' && renderNilai()}
            {activeTab === 'keuangan' && renderKeuangan()}
            {activeTab === 'saran' && renderSaran()}
            {activeTab === 'dokumentasi' && renderDokumentasi()}
            {activeTab === 'account' && renderAccount()}
          </AnimatePresence>
        </div>
      </main>

      <MobileBottomNav
        activeTab={activeTab}
        onChange={changeTab}
        onStartTour={startPortalTour}
      />
      <PortalTour
        open={tourOpen}
        steps={activeTourSteps}
        onClose={closePortalTour}
        onStepChange={handleTourStepChange}
      />
    </div>
  )
}
