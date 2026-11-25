'use client'

import { useState, useMemo, useTransition, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import NextImage from 'next/image'
import { Input } from '@/components/ui/input'
import { RupiahInput } from '@/components/ui/rupiah-input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Search, CheckCircle2, Clock, XCircle, Minus, Plus, Upload, Settings2,
  Pencil, Check, Image as ImageIcon, Eye, ZoomIn, ZoomOut, RotateCcw,
  ChevronDown, SlidersHorizontal, AlertTriangle,
} from 'lucide-react'
import { cn, formatRupiah } from '@/lib/utils'
import {
  createDspt, searchSiswa, updateDsptTarget, updateDsptPembayaran,
  tandaiDsptLunas, setNominalDsptMassal, importDsptBulk, getDsptList,
  getSiswaTemplate, getPendingDsptPaymentSubmissions, konfirmasiDsptPaymentSubmission, tolakDsptPaymentSubmission,
  getDsptPaymentProofSubmissions,
} from '../actions'
import type { StudentFinanceScope } from '../actions'
import { DataPagination, usePagination } from '@/components/ui/data-pagination'
import { CohortCards } from '@/components/dashboard/cohort-cards'
import { FinanceExportExcelDialog, type FinanceExportRow } from '../components/export-excel-dialog'
import { filterBillingRows, mergeBillingRows, type BillingRow } from './billing-list'

interface DsptRow {
  source?: 'DSPT' | 'SPP'
  id: string | null
  siswa_id: string
  nama_lengkap: string
  nisn: string
  siswa_status: string
  tahun_masuk: number
  nominal_target: number | null
  total_dibayar: number | null
  total_diskon: number | null
  status: 'belum_bayar' | 'nyicil' | 'lunas' | 'tidak_ada'
  tingkat: number | null
  nomor_kelas: string | null
  kelompok: string | null
  catatan?: string | null
  metode_bayar_set?: string | null
  bulan_bayar_set?: string | null
}

interface SppTunggakanRow {
  id: string
  siswa_id: string
  nama_lengkap: string
  nisn: string | null
  siswa_status: string
  tahun_masuk: number | null
  tingkat: number | null
  nomor_kelas: number | null
  kelompok: string | null
  jumlah: number
  total_dibayar: number
  status: 'belum_bayar' | 'nyicil'
  keterangan: string | null
  metode_bayar_set?: string | null
  bulan_bayar_set?: string | null
}

interface PaymentProofSubmission {
  id: string
  siswa_id: string
  dspt_id: string
  tahun_masuk?: number
  metode_bayar: string
  bank_tujuan?: string | null
  jumlah: number
  status: string
  bukti_url: string
  bukti_uploaded_at: string | null
  created_at: string
  updated_at?: string | null
  confirmed_at?: string | null
  rejected_at?: string | null
  reject_reason?: string | null
  transaksi_id?: string | null
  nama_lengkap: string
  nisn?: string
  tingkat?: number
  nomor_kelas?: number
  kelompok?: string
  nominal_target: number
  total_dibayar: number
  total_diskon: number
}

const STATUS_MAP = {
  lunas:       { label: 'Lunas',          icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  nyicil:      { label: 'Nyicil',         icon: Clock,        cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  belum_bayar: { label: 'Belum Bayar',    icon: XCircle,      cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
  tidak_ada:   { label: 'Belum Diinput',  icon: Minus,        cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
}

async function parseExcelFile(file: File): Promise<any[]> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(ws, { defval: '' })
}

async function downloadDsptTemplate(scope: StudentFinanceScope, angkatan?: number) {
  const XLSX = await import('xlsx')
  const { data } = await getSiswaTemplate(scope, angkatan)
  const rows = data.map((s: any) => ({
    'NISN': s.nisn ?? '',
    'Nama Siswa': s.nama_lengkap,
    'Angkatan': s.tahun_masuk ?? '',
    'Kelas': s.tingkat ? `${s.tingkat}-${s.nomor_kelas}${s.kelompok ? ' ' + s.kelompok : ''}` : '',
    'Nominal Target': '',
    'Total Dibayar': '',
    'Catatan': '',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{ wch: 16 }, { wch: 32 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 24 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'DSPT')
  const suffix = angkatan ? `_angkatan_${angkatan}` : '_semua'
  XLSX.writeFile(wb, `template_dspt${suffix}.xlsx`)
}

export function DsptClient({ initialData, initialSppData, angkatanList: initialAngkatanList, studentScope, activeYears, historicalYears = [] }: {
  initialData: DsptRow[]
  initialSppData: SppTunggakanRow[]
  angkatanList?: number[]
  activeYears?: number[]
  historicalYears?: number[]
  studentScope: StudentFinanceScope
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [filterJenis, setFilterJenis] = useState<'semua' | 'DSPT' | 'SPP'>(() => {
    const kind = searchParams.get('jenis')
    return kind === 'DSPT' || kind === 'SPP' ? kind : 'semua'
  })
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') ?? 'semua')
  const [filterMetode, setFilterMetode] = useState(searchParams.get('metode') ?? 'semua')
  const [filterAngkatan, setFilterAngkatan] = useState(searchParams.get('angkatan') ?? 'semua')
  const [filterKelas, setFilterKelas] = useState(searchParams.get('kelas') ?? 'semua')
  const [filterBulan, setFilterBulan] = useState(searchParams.get('bulan') ?? 'semua')
  const [showMoreFilters, setShowMoreFilters] = useState(() => Boolean(
    (searchParams.get('metode') && searchParams.get('metode') !== 'semua') ||
    (searchParams.get('bulan') && searchParams.get('bulan') !== 'semua')
  ))
  const [msg, setMsg] = useState('')

  // ── Data state ──────────────────────────────────────────────────────────────
  const [data, setData] = useState<DsptRow[]>(initialData.map(row => ({ ...row, source: 'DSPT' })))
  useEffect(() => { setData(initialData) }, [initialData])
  const combinedData = useMemo(() => mergeBillingRows(data as Omit<BillingRow, 'source'>[], initialSppData), [data, initialSppData])
  const [allPendingPayments, setPendingPayments] = useState<PaymentProofSubmission[]>([])
  const pendingPayments = allPendingPayments.filter(row => filterAngkatan === 'semua' || String(row.tahun_masuk) === filterAngkatan)
  const [proofHistory, setProofHistory] = useState<PaymentProofSubmission[]>([])
  const [proofModal, setProofModal] = useState<PaymentProofSubmission | null>(null)
  const [pendingModalOpen, setPendingModalOpen] = useState(false)
  const [proofSearch, setProofSearch] = useState('')
  const [proofStatus, setProofStatus] = useState('semua')
  const [proofMetode, setProofMetode] = useState('semua')
  const [proofZoom, setProofZoom] = useState(1)

  // ── Dialog: Tolak Bukti Pembayaran (mengganti window.prompt) ────────────────
  const [rejectSubmission, setRejectSubmission] = useState<PaymentProofSubmission | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectMsg, setRejectMsg] = useState('')

  // ── Dialog: Konfirmasi Tandai Lunas ─────────────────────────────────────────
  const [lunasTargetRow, setLunasTargetRow] = useState<DsptRow | null>(null)

  async function reloadData() {
    const [fresh, pending, history] = await Promise.all([
      getDsptList(studentScope),
      getPendingDsptPaymentSubmissions(studentScope),
      getDsptPaymentProofSubmissions(studentScope),
    ])
    setData(fresh.data as DsptRow[])
    setPendingPayments(pending.data as PaymentProofSubmission[])
    setProofHistory(history.data as PaymentProofSubmission[])
  }

  useEffect(() => {
    Promise.all([getPendingDsptPaymentSubmissions(studentScope), getDsptPaymentProofSubmissions(studentScope)])
      .then(([pending, history]) => {
        setPendingPayments(pending.data as PaymentProofSubmission[])
        setProofHistory(history.data as PaymentProofSubmission[])
      })
      .catch(() => {})
  }, [studentScope])

  // ── Modal: Input DSPT baru ──────────────────────────────────────────────────
  const [modalSiswa, setModalSiswa] = useState<DsptRow | null>(null)
  const [nominal, setNominal] = useState('')
  const [catatan, setCatatan] = useState('')
  const [modalMsg, setModalMsg] = useState('')

  // ── Modal: Edit DSPT ────────────────────────────────────────────────────────
  const [editModal, setEditModal] = useState<DsptRow | null>(null)
  const [editNominal, setEditNominal] = useState('')
  const [editDibayar, setEditDibayar] = useState('')
  const [editCatatan, setEditCatatan] = useState('')
  const [editMsg, setEditMsg] = useState('')

  // ── Modal: Tambah manual (cari siswa) ──────────────────────────────────────
  const [addModal, setAddModal] = useState(false)
  const [addSearch, setAddSearch] = useState('')
  const [addResults, setAddResults] = useState<any[]>([])
  const [addNominal, setAddNominal] = useState('')
  const [addCatatan, setAddCatatan] = useState('')
  const [addSelected, setAddSelected] = useState<any | null>(null)
  const [addMsg, setAddMsg] = useState('')

  // ── Modal: Set Nominal Massal ───────────────────────────────────────────────
  const [massalModal, setMassalModal] = useState(false)
  const [massalAngkatan, setMassalAngkatan] = useState('')
  const [massalNominal, setMassalNominal] = useState('')
  const [massalMsg, setMassalMsg] = useState('')

  // ── Modal: Import Excel ─────────────────────────────────────────────────────
  const [importModal, setImportModal] = useState<'dspt' | null>(null)
  const [importRows, setImportRows] = useState<any[]>([])
  const [importMsg, setImportMsg] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const [templateLoading, setTemplateLoading] = useState(false)
  const [templateAngkatan, setTemplateAngkatan] = useState('semua')
  const fileRef = useRef<HTMLInputElement>(null)

  const { page, pageSize, setPage, setPageSize, paginate, reset } = usePagination(15)

  const angkatanList = useMemo(() => {
    if (initialAngkatanList?.length) return initialAngkatanList
    const years = [...new Set(data.map(d => d.tahun_masuk).filter(Boolean))].sort((a, b) => b - a)
    return years
  }, [data, initialAngkatanList])

  const kelasList = useMemo(() => {
    const set = new Set<string>()
    combinedData.forEach(d => {
      if (d.tingkat && d.nomor_kelas) set.add(`${d.tingkat}-${d.nomor_kelas}${d.kelompok ? ' ' + d.kelompok : ''}`)
    })
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
  }, [combinedData])

  const bulanList = useMemo(() => {
    const set = new Set<string>()
    combinedData.forEach(d => {
      if (d.bulan_bayar_set) {
        d.bulan_bayar_set.split(',').forEach(b => set.add(b.trim()))
      }
    })
    return [...set].sort((a, b) => b.localeCompare(a))
  }, [combinedData])

  const matchingRows = useMemo(() => filterBillingRows(combinedData, {
    jenis: filterJenis, search, siswaStatus: 'semua', status: filterStatus,
    metode: filterMetode, angkatan: 'semua', kelas: filterKelas, bulan: filterBulan,
  }), [combinedData, search, filterJenis, filterStatus, filterMetode, filterKelas, filterBulan])

  const filtered = useMemo(() => {
    reset()
    return filterAngkatan === 'semua' ? matchingRows : matchingRows.filter(row => String(row.tahun_masuk) === filterAngkatan)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchingRows, filterAngkatan])

  const cohortMetrics = Object.fromEntries(['all', ...(activeYears ?? []).map(String)].map(scope => {
    const rows = matchingRows.filter(row => row.source === 'DSPT' && row.status !== 'tidak_ada' && (scope === 'all' || String(row.tahun_masuk) === scope))
    const target = rows.reduce((sum, row) => sum + (row.nominal_target ?? 0) - (row.total_diskon ?? 0), 0)
    const paid = rows.reduce((sum, row) => sum + (row.total_dibayar ?? 0), 0)
    return [scope, {
      label: 'Sisa tagihan DSPT',
      value: formatRupiah(target - paid),
      details: [{ label: 'Target bersih', value: formatRupiah(target) }, { label: 'Dibayar', value: formatRupiah(paid) }],
    }]
  }))

  const filteredProofHistory = useMemo(() => {
    const term = proofSearch.trim().toLowerCase()
    return proofHistory.filter(row => {
      const matchSearch = !term
        || row.nama_lengkap.toLowerCase().includes(term)
        || (row.nisn ?? '').toLowerCase().includes(term)
      const matchAngkatan = filterAngkatan === 'semua' || String(row.tahun_masuk) === filterAngkatan
      const matchStatus = proofStatus === 'semua' || row.status === proofStatus
      const matchMetode = proofMetode === 'semua'
        || (proofMetode === 'tunai'
          ? row.metode_bayar === 'tunai'
          : row.metode_bayar === 'transfer' || row.metode_bayar === 'qris')
      return matchSearch && matchStatus && matchMetode && matchAngkatan
    })
  }, [proofHistory, proofMetode, proofSearch, proofStatus, filterAngkatan])

  const paginated = paginate(filtered)
  const withDspt = filtered.filter(r => r.source === 'DSPT' && r.status !== 'tidak_ada')
  const withSpp = filtered.filter(r => r.source === 'SPP')
  const totalTarget  = withDspt.reduce((s, r) => s + (r.nominal_target ?? 0), 0)
  const totalDibayar = withDspt.reduce((s, r) => s + (r.total_dibayar ?? 0), 0)
  const totalDiskon  = withDspt.reduce((s, r) => s + (r.total_diskon ?? 0), 0)
  const totalSisa    = totalTarget - totalDibayar - totalDiskon
  const totalSppTarget = withSpp.reduce((s, r) => s + (r.nominal_target ?? 0), 0)
  const totalSppDibayar = withSpp.reduce((s, r) => s + (r.total_dibayar ?? 0), 0)
  const totalSppSisa = Math.max(0, totalSppTarget - totalSppDibayar)

  const extraFilterCount = (filterMetode !== 'semua' ? 1 : 0) + (filterBulan !== 'semua' ? 1 : 0)
  const hasAnyFilter = Boolean(
    search.trim() || filterJenis !== 'semua' || filterStatus !== 'semua' ||
    filterKelas !== 'semua' || filterMetode !== 'semua' || filterBulan !== 'semua' || filterAngkatan !== 'semua'
  )

  function resetAllFilters() {
    setSearch('')
    setFilterJenis('semua')
    setFilterStatus('semua')
    setFilterKelas('semua')
    setFilterMetode('semua')
    setFilterBulan('semua')
    setFilterAngkatan('semua')
  }

  const exportRows = useMemo<FinanceExportRow[]>(() => combinedData.map(row => {
    const kelas = row.tingkat && row.nomor_kelas
      ? `${row.tingkat}-${row.nomor_kelas}${row.kelompok ? ' ' + row.kelompok : ''}`
      : '-'
    const target = row.nominal_target ?? 0
    const dibayar = row.total_dibayar ?? 0
    const diskon = row.total_diskon ?? 0
    return row.source === 'SPP' ? {
      source: 'SPP', siswa_id: row.siswa_id, nama_lengkap: row.nama_lengkap, nisn: row.nisn,
      siswa_status: row.siswa_status, tahun_masuk: row.tahun_masuk, kelas,
      spp_tunggakan: target, spp_dibayar: dibayar, spp_sisa: Math.max(0, target - dibayar),
      spp_status: row.status, spp_keterangan: row.catatan, metode_bayar: row.metode_bayar_set,
    } : {
      source: 'DSPT',
      siswa_id: row.siswa_id,
      nama_lengkap: row.nama_lengkap,
      nisn: row.nisn,
      siswa_status: row.siswa_status,
      tahun_masuk: row.tahun_masuk,
      kelas,
      dspt_target: target,
      dspt_dibayar: dibayar,
      dspt_diskon: diskon,
      dspt_sisa: Math.max(0, target - dibayar - diskon),
      dspt_status: row.status,
      dspt_catatan: row.catatan,
      metode_bayar: row.metode_bayar_set,
    }
  }), [combinedData])

  const currentExportRows = useMemo<FinanceExportRow[]>(() => filtered.map(row => {
    const kelas = row.tingkat && row.nomor_kelas
      ? `${row.tingkat}-${row.nomor_kelas}${row.kelompok ? ' ' + row.kelompok : ''}`
      : '-'
    const target = row.nominal_target ?? 0
    const dibayar = row.total_dibayar ?? 0
    const diskon = row.total_diskon ?? 0
    return row.source === 'SPP' ? {
      source: 'SPP', siswa_id: row.siswa_id, nama_lengkap: row.nama_lengkap, nisn: row.nisn,
      siswa_status: row.siswa_status, tahun_masuk: row.tahun_masuk, kelas,
      spp_tunggakan: target, spp_dibayar: dibayar, spp_sisa: Math.max(0, target - dibayar),
      spp_status: row.status, spp_keterangan: row.catatan, metode_bayar: row.metode_bayar_set,
    } : {
      source: 'DSPT',
      siswa_id: row.siswa_id,
      nama_lengkap: row.nama_lengkap,
      nisn: row.nisn,
      siswa_status: row.siswa_status,
      tahun_masuk: row.tahun_masuk,
      kelas,
      dspt_target: target,
      dspt_dibayar: dibayar,
      dspt_diskon: diskon,
      dspt_sisa: Math.max(0, target - dibayar - diskon),
      dspt_status: row.status,
      dspt_catatan: row.catatan,
      metode_bayar: row.metode_bayar_set,
    }
  }), [filtered])

  // ── Handlers ────────────────────────────────────────────────────────────────
  function openSetDspt(row: DsptRow) {
    setModalSiswa(row); setNominal(''); setCatatan(''); setModalMsg('')
  }

  function openEditDspt(row: DsptRow) {
    setEditModal(row)
    setEditNominal(String(row.nominal_target ?? ''))
    setEditDibayar(String(row.total_dibayar ?? ''))
    setEditCatatan((row.catatan as string) ?? '')
    setEditMsg('')
  }

  async function handleSetDspt(e: React.FormEvent) {
    e.preventDefault()
    if (!modalSiswa || !nominal) return
    startTransition(async () => {
      const res = await createDspt(modalSiswa.siswa_id, parseInt(nominal), catatan, studentScope)
      if (res.error) { setModalMsg(res.error); return }
      setModalSiswa(null)
      await reloadData()
      setMsg(res.success ?? '')
    })
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editModal?.id) return
    const nominalVal = parseInt(editNominal) || 0
    const dibayarVal = parseInt(editDibayar) || 0
    startTransition(async () => {
      const r1 = await updateDsptTarget(editModal.id!, nominalVal, editCatatan, studentScope)
      if (r1.error) { setEditMsg(r1.error); return }
      if (dibayarVal !== (editModal.total_dibayar ?? 0)) {
        const r2 = await updateDsptPembayaran(editModal.id!, dibayarVal, studentScope)
        if (r2.error) { setEditMsg(r2.error); return }
      }
      setEditModal(null)
      await reloadData()
      setMsg('Data DSPT berhasil diperbarui')
    })
  }

  function requestLunas(row: DsptRow, e: React.MouseEvent) {
    e.stopPropagation()
    if (!row.id) return
    setLunasTargetRow(row)
  }

  function confirmLunas() {
    if (!lunasTargetRow?.id) return
    const targetId = lunasTargetRow.id
    startTransition(async () => {
      const res = await tandaiDsptLunas(targetId, studentScope)
      setMsg(res.error ?? res.success ?? '')
      setLunasTargetRow(null)
      if (!res.error) await reloadData()
    })
  }

  async function handleConfirmPayment(submissionId: string) {
    startTransition(async () => {
      const res = await konfirmasiDsptPaymentSubmission(submissionId, studentScope)
      setMsg(res.error ?? res.success ?? '')
      if (!res.error) {
        setProofModal(null)
        await reloadData()
      }
    })
  }

  function openRejectDialog(submission: PaymentProofSubmission) {
    setRejectSubmission(submission)
    setRejectReason('')
    setRejectMsg('')
  }

  function submitRejectPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!rejectSubmission) return
    const trimmed = rejectReason.trim()
    if (trimmed.length < 3) {
      setRejectMsg('Alasan penolakan minimal 3 karakter.')
      return
    }
    startTransition(async () => {
      const res = await tolakDsptPaymentSubmission(rejectSubmission.id, trimmed, studentScope)
      if (res.error) {
        setRejectMsg(res.error)
        return
      }
      setMsg(res.success ?? 'Bukti pembayaran ditolak.')
      setRejectSubmission(null)
      setProofModal(null)
      await reloadData()
    })
  }

  async function handleAddSearch() {
    if (addSearch.trim().length < 2) return
    const res = await searchSiswa(addSearch, studentScope)
    setAddResults(res.data)
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!addSelected || !addNominal) { setAddMsg('Pilih siswa dan isi nominal'); return }
    startTransition(async () => {
      const res = await createDspt(addSelected.id, parseInt(addNominal), addCatatan, studentScope)
      if (res.error) { setAddMsg(res.error); return }
      setAddModal(false); setAddSelected(null); setAddSearch(''); setAddNominal(''); setAddCatatan(''); setAddResults([])
      await reloadData()
      setMsg(res.success ?? '')
    })
  }

  async function handleMassal(e: React.FormEvent) {
    e.preventDefault()
    if (!massalAngkatan || !massalNominal) { setMassalMsg('Pilih angkatan dan isi nominal'); return }
    startTransition(async () => {
      const res = await setNominalDsptMassal(parseInt(massalAngkatan), parseInt(massalNominal), studentScope)
      setMassalMsg(res.error ?? res.success ?? '')
      if (!res.error) { await reloadData() }
    })
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportLoading(true); setImportMsg('')
    try {
      const rows = await parseExcelFile(file)
      setImportRows(rows)
    } catch {
      setImportMsg('Gagal membaca file. Pastikan format .xlsx/.xls')
    } finally {
      setImportLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleImportSubmit() {
    if (!importRows.length) return
    setImportLoading(true); setImportMsg('')
    const mapped = importRows.map(r => ({
      nisn: String(r['NISN'] ?? r['nisn'] ?? r['Nisn'] ?? '').trim() || undefined,
      nama: String(r['Nama'] ?? r['NAMA'] ?? r['nama_lengkap'] ?? r['Nama Siswa'] ?? '').trim() || undefined,
      nominal_target: parseInt(String(r['Nominal Target'] ?? r['nominal_target'] ?? r['Target'] ?? 0).replace(/\D/g, '')) || 0,
      total_dibayar: parseInt(String(r['Total Dibayar'] ?? r['total_dibayar'] ?? r['Dibayar'] ?? r['Terbayar'] ?? 0).replace(/\D/g, '')) || 0,
      catatan: String(r['Catatan'] ?? r['catatan'] ?? '').trim() || undefined,
    })).filter(r => r.nisn || r.nama)

    const res = await importDsptBulk(mapped, studentScope)
    setImportMsg((res.error ? res.error + ' — ' : '') + res.success)
    if (!res.error || res.sukses > 0) { await reloadData(); setImportRows([]) }
    setImportLoading(false)
  }

  return (
    <div className="space-y-3 pb-8">
      {/* Scope Nav + Primary Actions */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <nav
          aria-label="Cakupan status siswa"
          className="inline-flex w-fit items-center rounded-lg border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-900"
        >
          <Link
            href="/dashboard/keuangan/dspt"
            aria-current={studentScope === 'active' ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
              studentScope === 'active'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
            )}
          >
            Siswa Aktif
          </Link>
          <Link
            href="/dashboard/keuangan/dspt/nonaktif"
            aria-current={studentScope === 'inactive' ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
              studentScope === 'inactive'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
            )}
          >
            Siswa Nonaktif / Alumni
          </Link>
        </nav>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={pendingPayments.length ? 'default' : 'outline'}
            className={cn(
              'h-8 gap-1.5 text-xs',
              pendingPayments.length > 0 && 'bg-amber-600 text-white hover:bg-amber-700',
            )}
            onClick={() => setPendingModalOpen(true)}
          >
            <ImageIcon className="h-3.5 w-3.5" /> Bukti Masuk
            {pendingPayments.length > 0 && (
              <span className="ml-0.5 rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
                {pendingPayments.length}
              </span>
            )}
          </Button>

          <FinanceExportExcelDialog
            rows={exportRows}
            currentRows={currentExportRows}
            sources={['DSPT', 'SPP']}
            defaultSources={filterJenis === 'semua' ? ['DSPT', 'SPP'] : [filterJenis]}
            triggerLabel="Export Excel"
            filePrefix={studentScope === 'active' ? 'MANSATAS_DSPT_SPP_AKTIF' : 'MANSATAS_DSPT_SPP_NONAKTIF'}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                <Settings2 className="h-3.5 w-3.5" /> Kelola Massal <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onSelect={() => {
                  setMassalModal(true)
                  setMassalMsg('')
                  setMassalAngkatan(angkatanList[0] ? String(angkatanList[0]) : '')
                  setMassalNominal('')
                }}
              >
                <Settings2 className="h-4 w-4" /> Set Nominal per Angkatan
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setImportModal('dspt')
                  setImportRows([])
                  setImportMsg('')
                }}
              >
                <Upload className="h-4 w-4" /> Import dari Excel (.xlsx)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => { setAddModal(true); setAddMsg('') }}>
            <Plus className="h-3.5 w-3.5" /> Input Manual
          </Button>
        </div>
      </div>

      {activeYears && (
        <CohortCards
          compact
          activeYears={activeYears}
          years={[...new Set([...angkatanList, ...historicalYears])].sort((a, b) => b - a)}
          metrics={cohortMetrics}
          value={filterAngkatan === 'semua' ? 'all' : filterAngkatan}
          onChange={scope => {
            if (scope !== 'all' && !angkatanList.includes(Number(scope)) && historicalYears.includes(Number(scope))) {
              const params = new URLSearchParams({ angkatan: scope, jenis: filterJenis, status: filterStatus, metode: filterMetode, kelas: filterKelas, bulan: filterBulan, q: search })
              router.push(`/dashboard/keuangan/dspt/nonaktif?${params}`)
            } else {
              setFilterAngkatan(scope === 'all' ? 'semua' : scope)
            }
          }}
        />
      )}

      {pendingPayments.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3.5 py-2.5 dark:border-amber-900/60 dark:bg-amber-950/30">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                {pendingPayments.length} bukti pembayaran menunggu konfirmasi
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Periksa bukti transfer/QRIS untuk menerbitkan kuitansi atau menolak pengajuan.
              </p>
            </div>
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setPendingModalOpen(true)}>
              <Eye className="h-3.5 w-3.5" /> Periksa Bukti
            </Button>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <search
        aria-label="Filter daftar tagihan siswa"
        className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Cari nama siswa atau NISN..."
              value={search}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              onChange={e => setSearch(e.target.value)}
              className="h-8 rounded-md pl-8 text-sm"
            />
          </div>
          <Select value={filterJenis} onValueChange={value => setFilterJenis(value as typeof filterJenis)}>
            <SelectTrigger aria-label="Jenis tagihan" className="h-8 w-36 rounded-md text-xs"><SelectValue placeholder="Jenis Tagihan" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">DSPT & SPP</SelectItem>
              <SelectItem value="DSPT">DSPT</SelectItem>
              <SelectItem value="SPP">SPP Lama</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger aria-label="Status pembayaran" className="h-8 w-36 rounded-md text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua Status</SelectItem>
              <SelectItem value="lunas">Lunas</SelectItem>
              <SelectItem value="nyicil">Nyicil</SelectItem>
              <SelectItem value="belum_bayar">Belum Bayar</SelectItem>
              <SelectItem value="tidak_ada">Belum Diinput</SelectItem>
            </SelectContent>
          </Select>
          {!activeYears && (
            <Select value={filterAngkatan} onValueChange={setFilterAngkatan}>
              <SelectTrigger aria-label="Angkatan" className="h-8 w-36 rounded-md text-xs"><SelectValue placeholder="Angkatan" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua Angkatan</SelectItem>
                {angkatanList.map(y => <SelectItem key={y} value={String(y)}>Angkatan {y}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={filterKelas} onValueChange={setFilterKelas}>
            <SelectTrigger aria-label="Kelas" className="h-8 w-32 rounded-md text-xs"><SelectValue placeholder="Kelas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua Kelas</SelectItem>
              {kelasList.map(k => <SelectItem key={k} value={k}>Kelas {k}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            variant={showMoreFilters || extraFilterCount > 0 ? 'secondary' : 'ghost'}
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={() => setShowMoreFilters(prev => !prev)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filter Lainnya
            {extraFilterCount > 0 && (
              <span className="rounded-full bg-emerald-600 px-1.5 text-[10px] font-bold text-white">{extraFilterCount}</span>
            )}
          </Button>
          {hasAnyFilter && (
            <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs text-slate-500" onClick={resetAllFilters}>
              Reset
            </Button>
          )}
        </div>

        {(showMoreFilters || extraFilterCount > 0) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
            <span className="text-xs font-medium text-slate-500">Filter pembayaran:</span>
            <Select value={filterMetode} onValueChange={setFilterMetode}>
              <SelectTrigger aria-label="Metode pembayaran" className="h-8 w-36 rounded-md text-xs"><SelectValue placeholder="Metode" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua Metode</SelectItem>
                <SelectItem value="tunai">Tunai</SelectItem>
                <SelectItem value="transfer">Transfer / QRIS</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterBulan} onValueChange={setFilterBulan}>
              <SelectTrigger aria-label="Bulan pembayaran" className="h-8 w-44 rounded-md text-xs"><SelectValue placeholder="Bulan Bayar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua Bulan Bayar</SelectItem>
                {bulanList.map(b => (
                  <SelectItem key={b} value={b}>
                    {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(parseInt(b.split('-')[0]), parseInt(b.split('-')[1]) - 1))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </search>

      {msg && (
        <p role="status" className={`rounded-md px-3 py-2 text-xs ${msg.includes('berhasil') || msg.includes('ditolak') ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300'}`}>
          {msg}
        </p>
      )}

      {/* Compact Summary Strip */}
      <div className="grid grid-cols-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        {[
          { label: 'Target DSPT', value: formatRupiah(totalTarget), color: 'text-slate-900 dark:text-slate-50' },
          { label: 'Sisa DSPT', value: formatRupiah(totalSisa), color: 'text-rose-600 dark:text-rose-400' },
          { label: 'Tunggakan SPP Lama', value: formatRupiah(totalSppTarget), color: 'text-slate-900 dark:text-slate-50' },
          { label: 'Sisa SPP Lama', value: formatRupiah(totalSppSisa), color: 'text-rose-600 dark:text-rose-400' },
        ].map(s => (
          <div key={s.label} className="px-3.5 py-2.5">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{s.label}</p>
            <p className={`mt-0.5 text-sm font-bold tabular-nums ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Data Container: Mobile Cards + Desktop Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {/* Mobile Card View */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
          {paginated.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-400">
              {studentScope === 'active' ? 'Tidak ada tagihan siswa aktif sesuai filter.' : 'Tidak ada tagihan siswa nonaktif sesuai filter.'}
            </div>
          ) : (
            paginated.map(row => {
              const sisa = (row.nominal_target ?? 0) - (row.total_dibayar ?? 0) - (row.total_diskon ?? 0)
              const s = STATUS_MAP[row.status] ?? STATUS_MAP.tidak_ada
              const Icon = s.icon
              const belumInput = row.status === 'tidak_ada'
              const kelas = row.tingkat ? `${row.tingkat}-${row.nomor_kelas}${row.kelompok ? ' ' + row.kelompok : ''}` : '-'
              return (
                <div
                  key={`m-${row.source}-${row.id ?? row.siswa_id}`}
                  onClick={() => router.push(`/dashboard/keuangan/siswa/${row.siswa_id}?tab=${row.source === 'SPP' ? 'spp' : 'dspt'}&scope=${studentScope}`)}
                  className="cursor-pointer space-y-2 p-3.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${row.source === 'SPP' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'}`}>
                          {row.source === 'SPP' ? 'SPP Lama' : 'DSPT'}
                        </span>
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">{row.nama_lengkap}</p>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {row.nisn ?? '-'} · Angkatan {row.tahun_masuk} · Kelas {kelas}
                      </p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>
                      <Icon className="h-2.5 w-2.5" />{s.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="text-slate-500">Sisa: </span>
                      <span className={`font-bold tabular-nums ${belumInput ? 'text-slate-400' : sisa > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'}`}>
                        {belumInput ? 'Belum diatur' : formatRupiah(sisa)}
                      </span>
                      {!belumInput && (
                        <span className="ml-2 text-slate-400 tabular-nums">
                          (Dibayar {formatRupiah(row.total_dibayar ?? 0)})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      {row.source === 'SPP' ? (
                        <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs"
                          onClick={() => router.push(`/dashboard/keuangan/siswa/${row.siswa_id}?tab=spp&scope=${studentScope}`)}>
                          Detail
                        </Button>
                      ) : belumInput ? (
                        <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => openSetDspt(row)}>
                          Atur Target
                        </Button>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => openEditDspt(row)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          {row.status !== 'lunas' && (
                            <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs text-emerald-700" onClick={e => requestLunas(row, e)}>
                              <Check className="h-3 w-3" /> Lunas
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Desktop Table View */}
        <div role="region" aria-label="Tabel tagihan DSPT dan SPP" tabIndex={0} className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                <TableHead className="text-xs font-semibold">Jenis</TableHead>
                <TableHead className="text-xs font-semibold">Nama Siswa</TableHead>
                <TableHead className="text-xs font-semibold">Angkatan</TableHead>
                <TableHead className="text-xs font-semibold">Kelas</TableHead>
                <TableHead className="text-right text-xs font-semibold">Target</TableHead>
                <TableHead className="text-right text-xs font-semibold">Dibayar</TableHead>
                <TableHead className="text-right text-xs font-semibold">Keringanan</TableHead>
                <TableHead className="text-right text-xs font-semibold">Sisa</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="w-32 text-center text-xs font-semibold">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-sm text-slate-400">
                    {studentScope === 'active' ? 'Tidak ada tagihan siswa aktif sesuai filter.' : 'Tidak ada tagihan siswa nonaktif sesuai filter.'}
                  </TableCell>
                </TableRow>
              )}
              {paginated.map(row => {
                const sisa = (row.nominal_target ?? 0) - (row.total_dibayar ?? 0) - (row.total_diskon ?? 0)
                const s = STATUS_MAP[row.status] ?? STATUS_MAP.tidak_ada
                const Icon = s.icon
                const belumInput = row.status === 'tidak_ada'
                return (
                  <TableRow
                    key={`${row.source}-${row.id ?? row.siswa_id}`}
                    className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    onClick={() => router.push(`/dashboard/keuangan/siswa/${row.siswa_id}?tab=${row.source === 'SPP' ? 'spp' : 'dspt'}&scope=${studentScope}`)}
                  >
                    <TableCell>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${row.source === 'SPP' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'}`}>
                        {row.source === 'SPP' ? 'SPP Lama' : 'DSPT'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{row.nama_lengkap}</p>
                      <p className="text-[11px] text-slate-400">{row.nisn ?? '-'}</p>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-slate-600 dark:text-slate-300">{row.tahun_masuk}</TableCell>
                    <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                      {row.tingkat ? `${row.tingkat}-${row.nomor_kelas}${row.kelompok ? ' ' + row.kelompok : ''}` : '-'}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium tabular-nums">{belumInput ? '-' : formatRupiah(row.nominal_target ?? 0)}</TableCell>
                    <TableCell className="text-right text-sm font-medium tabular-nums text-emerald-600 dark:text-emerald-400">{belumInput ? '-' : formatRupiah(row.total_dibayar ?? 0)}</TableCell>
                    <TableCell className="text-right text-sm font-medium tabular-nums text-blue-600 dark:text-blue-400">
                      {belumInput || row.source === 'SPP' ? '-' : formatRupiah(row.total_diskon ?? 0)}
                    </TableCell>
                    <TableCell className={`text-right text-sm font-medium tabular-nums ${sisa > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {belumInput ? '-' : formatRupiah(sisa)}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>
                        <Icon className="h-2.5 w-2.5" />{s.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        {row.source === 'SPP' ? (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]"
                            onClick={e => { e.stopPropagation(); router.push(`/dashboard/keuangan/siswa/${row.siswa_id}?tab=spp&scope=${studentScope}`) }}>
                            Detail
                          </Button>
                        ) : belumInput ? (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]"
                            onClick={e => { e.stopPropagation(); openSetDspt(row) }}>
                            Atur Target
                          </Button>
                        ) : (
                          <>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                              onClick={e => { e.stopPropagation(); openEditDspt(row) }} title="Ubah target / catatan">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {row.status !== 'lunas' && (
                              <Button size="sm" variant="ghost"
                                className="h-7 gap-1 px-2 text-[11px] text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-400"
                                onClick={e => requestLunas(row, e)} disabled={isPending} title="Tandai Lunas">
                                <Check className="h-3 w-3" /> Lunas
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        <DataPagination
          total={filtered.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          entityLabel="tagihan"
        />
        <div className="border-t border-slate-100 px-4 py-1.5 text-[11px] text-slate-400 dark:border-slate-800">
          {withDspt.length} item DSPT · {withSpp.length} item tunggakan SPP lama
        </div>
      </div>

      {/* ── Modal: Daftar Bukti Pembayaran ──────────────────────────────────── */}
      <Dialog open={pendingModalOpen} onOpenChange={setPendingModalOpen}>
        <DialogContent className="overflow-hidden rounded-xl p-0 sm:max-w-5xl">
          <DialogHeader className="border-b bg-slate-50 px-5 py-4 dark:bg-slate-800/50">
            <DialogTitle className="text-sm font-semibold">Bukti Pembayaran DSPT</DialogTitle>
          </DialogHeader>
          <search aria-label="Filter bukti pembayaran" className="border-b border-slate-200 p-3 dark:border-slate-800">
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-[200px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  value={proofSearch}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={event => setProofSearch(event.target.value)}
                  placeholder="Cari nama atau NISN..."
                  className="h-8 rounded-md pl-8 text-sm"
                />
              </div>
              <Select value={proofStatus} onValueChange={setProofStatus}>
                <SelectTrigger className="h-8 w-40 rounded-md text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua Status</SelectItem>
                  <SelectItem value="menunggu_konfirmasi">Menunggu</SelectItem>
                  <SelectItem value="terkonfirmasi">Terkonfirmasi</SelectItem>
                  <SelectItem value="ditolak">Ditolak</SelectItem>
                </SelectContent>
              </Select>
              <Select value={proofMetode} onValueChange={setProofMetode}>
                <SelectTrigger className="h-8 w-32 rounded-md text-xs"><SelectValue placeholder="Metode" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua Metode</SelectItem>
                  <SelectItem value="tunai">Tunai</SelectItem>
                  <SelectItem value="transfer">Transfer / QRIS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </search>
          <div className="max-h-[72vh] space-y-3 overflow-y-auto p-5">
            {filteredProofHistory.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
                Belum ada bukti pembayaran sesuai filter.
              </div>
            ) : filteredProofHistory.map(p => {
              const kelas = p.tingkat && p.nomor_kelas ? `${p.tingkat}-${p.nomor_kelas}${p.kelompok ? ' ' + p.kelompok : ''}` : '-'
              const sisa = Math.max(0, (p.nominal_target ?? 0) - (p.total_dibayar ?? 0) - (p.total_diskon ?? 0))
              const jumlah = Number(p.jumlah || 0)
              const targetBaru = Math.max(Number(p.nominal_target || 0), Number(p.total_dibayar || 0) + jumlah + Number(p.total_diskon || 0))
              const overpay = jumlah > sisa
              const statusLabel = p.status === 'terkonfirmasi' ? 'Terkonfirmasi' : p.status === 'ditolak' ? 'Ditolak' : 'Menunggu'
              const statusClass = p.status === 'terkonfirmasi'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : p.status === 'ditolak'
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              return (
                <div key={p.id} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{p.nama_lengkap}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass}`}>{statusLabel}</span>
                      </div>
                      <p className="text-[11px] text-slate-500">{p.nisn ?? '-'} · Kelas {kelas}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Bukti: {p.bukti_uploaded_at ? String(p.bukti_uploaded_at).replace('T', ' ') : '-'} · {p.metode_bayar === 'qris' ? 'QRIS' : 'Transfer'}
                      </p>
                      {p.metode_bayar === 'transfer' && p.bank_tujuan && (
                        <p className="mt-1 text-xs font-medium text-sky-700 dark:text-sky-400">Bank tujuan: {p.bank_tujuan}</p>
                      )}
                      {p.reject_reason && <p className="mt-1 text-xs text-rose-600">Ditolak: {p.reject_reason}</p>}
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-50">{formatRupiah(jumlah)}</p>
                      <p className="text-[11px] tabular-nums text-slate-500">Sisa DSPT: {formatRupiah(sisa)}</p>
                    </div>
                  </div>
                  {p.status === 'menunggu_konfirmasi' && overpay && (
                    <p className="mt-3 rounded-md bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                      Nominal bukti melebihi sisa DSPT. Jika dikonfirmasi, target DSPT otomatis disesuaikan menjadi {formatRupiah(targetBaru)}.
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => { setProofZoom(1); setProofModal(p) }}>
                      <ImageIcon className="h-3.5 w-3.5" /> Lihat Bukti
                    </Button>
                    {p.status === 'menunggu_konfirmasi' && (
                      <>
                        <Button size="sm" className="h-8 gap-1.5 text-xs" disabled={isPending} onClick={() => handleConfirmPayment(p.id)}>
                          <Check className="h-3.5 w-3.5" /> Konfirmasi
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 gap-1.5 border-rose-200 text-xs text-rose-600 hover:bg-rose-50" disabled={isPending} onClick={() => openRejectDialog(p)}>
                          <XCircle className="h-3.5 w-3.5" /> Tolak
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Zoom Gambar Bukti Pembayaran ────────────────────────────── */}
      <Dialog open={!!proofModal} onOpenChange={v => { if (!v) setProofModal(null) }}>
        <DialogContent className="overflow-hidden rounded-xl p-0 sm:max-w-5xl">
          <DialogHeader className="border-b bg-slate-50 px-5 py-4 dark:bg-slate-800/50">
            <DialogTitle className="text-sm font-semibold">Bukti Pembayaran</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-800">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">{proofModal?.nama_lengkap ?? '-'}</p>
              <p className="text-xs tabular-nums text-slate-500">
                {formatRupiah(Number(proofModal?.jumlah || 0))} · {proofModal?.metode_bayar === 'qris' ? 'QRIS' : 'Transfer'}
              </p>
              {proofModal?.metode_bayar === 'transfer' && proofModal?.bank_tujuan && (
                <p className="text-xs font-medium text-sky-700 dark:text-sky-400">Bank tujuan: {proofModal.bank_tujuan}</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button type="button" variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setProofZoom(value => Math.max(0.5, value - 0.25))} title="Perkecil">
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs tabular-nums" onClick={() => setProofZoom(1)} title="Reset zoom">
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> {Math.round(proofZoom * 100)}%
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setProofZoom(value => Math.min(4, value + 0.25))} title="Perbesar">
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="max-h-[72vh] overflow-auto bg-slate-50 p-4 dark:bg-slate-950">
            {proofModal?.bukti_url && (
              <NextImage
                src={proofModal.bukti_url}
                alt="Bukti pembayaran DSPT"
                width={1200}
                height={1600}
                unoptimized
                className="mx-auto rounded-lg bg-white object-contain transition-transform"
                style={{ width: `${proofZoom * 100}%`, maxWidth: 'none' }}
              />
            )}
          </div>
          {proofModal?.status === 'menunggu_konfirmasi' && (
            <div className="flex flex-wrap gap-2 border-t border-slate-200 p-4 dark:border-slate-800">
              <Button size="sm" className="h-8 gap-1.5 text-xs" disabled={!proofModal || isPending} onClick={() => proofModal && handleConfirmPayment(proofModal.id)}>
                <Check className="h-3.5 w-3.5" /> Konfirmasi
              </Button>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 border-rose-200 text-xs text-rose-600 hover:bg-rose-50" disabled={!proofModal || isPending} onClick={() => proofModal && openRejectDialog(proofModal)}>
                <XCircle className="h-3.5 w-3.5" /> Tolak
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Modal: Alasan Penolakan Bukti Pembayaran ───────────────────────── */}
      <Dialog open={!!rejectSubmission} onOpenChange={v => { if (!v) setRejectSubmission(null) }}>
        <DialogContent className="overflow-hidden rounded-xl p-0 sm:max-w-sm">
          <DialogHeader className="border-b bg-rose-50 px-5 py-4 dark:bg-rose-950/30">
            <DialogTitle className="text-sm font-semibold text-rose-800 dark:text-rose-200">Tolak Bukti Pembayaran</DialogTitle>
            <DialogDescription className="text-xs text-rose-700/80 dark:text-rose-300/80">
              {rejectSubmission?.nama_lengkap} · {formatRupiah(Number(rejectSubmission?.jumlah || 0))}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitRejectPayment} className="space-y-4 p-5">
            <div className="space-y-1.5">
              <Label htmlFor="reject-proof-reason" className="text-xs font-medium">
                Alasan Penolakan <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="reject-proof-reason"
                value={rejectReason}
                onChange={e => { setRejectReason(e.target.value); setRejectMsg('') }}
                placeholder="Misal: Bukti buram / nominal tidak sesuai mutasi"
                minLength={3}
                required
                autoFocus
                className="h-9 text-sm"
              />
              <p className="text-[11px] text-slate-500">Alasan ini akan tampil pada Portal Orang Tua agar wali siswa dapat mengunggah ulang bukti yang benar.</p>
            </div>
            {rejectMsg && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-600">{rejectMsg}</p>}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" className="h-9 flex-1 text-sm" onClick={() => setRejectSubmission(null)}>
                Batal
              </Button>
              <Button type="submit" variant="destructive" size="sm" className="h-9 flex-1 text-sm" disabled={isPending || rejectReason.trim().length < 3}>
                {isPending ? 'Memproses...' : 'Tolak Bukti'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Konfirmasi Tandai Lunas ─────────────────────────────────── */}
      <Dialog open={!!lunasTargetRow} onOpenChange={v => { if (!v) setLunasTargetRow(null) }}>
        <DialogContent className="overflow-hidden rounded-xl p-0 sm:max-w-sm">
          <DialogHeader className="border-b bg-slate-50 px-5 py-4 dark:bg-slate-800/50">
            <DialogTitle className="text-sm font-semibold">Tandai DSPT Lunas?</DialogTitle>
            <DialogDescription className="text-xs">
              Pastikan tindakan pelunasan sesuai dengan pencatatan kas.
            </DialogDescription>
          </DialogHeader>
          {lunasTargetRow && (
            <div className="space-y-4 p-5">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-900">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{lunasTargetRow.nama_lengkap}</p>
                <p className="mt-0.5 text-slate-500">Target: {formatRupiah(lunasTargetRow.nominal_target ?? 0)} · Sudah dibayar: {formatRupiah(lunasTargetRow.total_dibayar ?? 0)}</p>
                <p className="mt-1 font-semibold text-emerald-700 dark:text-emerald-400">
                  Sisa yang dilunaskan: {formatRupiah(Math.max(0, (lunasTargetRow.nominal_target ?? 0) - (lunasTargetRow.total_dibayar ?? 0) - (lunasTargetRow.total_diskon ?? 0)))}
                </p>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Jika siswa baru saja menyetor uang dan membutuhkan <strong>kuitansi resmi</strong>, buka halaman detail siswa lalu pilih <strong>Catat Bayar</strong>.
                </span>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="h-9 flex-1 text-xs" onClick={() => setLunasTargetRow(null)}>
                  Batal
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 flex-1 text-xs"
                  onClick={() => {
                    const id = lunasTargetRow.siswa_id
                    setLunasTargetRow(null)
                    router.push(`/dashboard/keuangan/siswa/${id}?tab=dspt&scope=${studentScope}`)
                  }}
                >
                  Buka Catat Bayar
                </Button>
                <Button type="button" size="sm" className="h-9 flex-1 text-xs" disabled={isPending} onClick={confirmLunas}>
                  {isPending ? 'Memproses...' : 'Ya, Lunas'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Modal: Input DSPT baru ─────────────────────────────────────────── */}
      <Dialog open={!!modalSiswa} onOpenChange={v => { if (!v) setModalSiswa(null) }}>
        <DialogContent className="overflow-hidden rounded-xl p-0 sm:max-w-sm">
          <DialogHeader className="border-b bg-slate-50 px-5 py-4 dark:bg-slate-800/50">
            <DialogTitle className="text-sm font-semibold">Input Target DSPT</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSetDspt} className="space-y-4 p-5">
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-800 dark:bg-blue-900/20">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{modalSiswa?.nama_lengkap}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{modalSiswa?.nisn ?? '-'} · Angkatan {modalSiswa?.tahun_masuk}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-dspt-nominal" className="text-xs font-medium">Nominal Target DSPT</Label>
              <RupiahInput id="set-dspt-nominal" min={0} value={nominal} onValueChange={raw => setNominal(raw)} placeholder="5.000.000" autoFocus required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-dspt-catatan" className="text-xs font-medium">Catatan (opsional)</Label>
              <Input id="set-dspt-catatan" value={catatan} onChange={e => setCatatan(e.target.value)} className="h-9 text-sm" placeholder="Anak guru, beasiswa, dll" />
            </div>
            {modalMsg && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-600">{modalMsg}</p>}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" className="h-9 flex-1 text-sm" onClick={() => setModalSiswa(null)}>Batal</Button>
              <Button type="submit" size="sm" className="h-9 flex-1 text-sm" disabled={isPending || !nominal}>
                {isPending ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Edit DSPT (target + koreksi awal bertahap) ────────────────── */}
      <Dialog open={!!editModal} onOpenChange={v => { if (!v) setEditModal(null) }}>
        <DialogContent className="overflow-hidden rounded-xl p-0 sm:max-w-md">
          <DialogHeader className="border-b bg-slate-50 px-5 py-4 dark:bg-slate-800/50">
            <DialogTitle className="text-sm font-semibold">Ubah Target & Catatan DSPT</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSave} className="space-y-4 p-5">
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-800 dark:bg-blue-900/20">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{editModal?.nama_lengkap}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{editModal?.nisn ?? '-'} · Angkatan {editModal?.tahun_masuk}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-dspt-nominal" className="text-xs font-medium">Nominal Target DSPT</Label>
              <RupiahInput id="edit-dspt-nominal" min={0} value={editNominal} onValueChange={raw => setEditNominal(raw)} placeholder="0" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-dspt-catatan" className="text-xs font-medium">Catatan (opsional)</Label>
              <Input id="edit-dspt-catatan" value={editCatatan} onChange={e => setEditCatatan(e.target.value)} className="h-9 text-sm" placeholder="Anak guru, beasiswa, dll" />
            </div>

            <details className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-900">
              <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                Koreksi Total Terbayar Awal (Migrasi Data)
              </summary>
              <div className="mt-3 space-y-2">
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Untuk pembayaran cicilan baru yang menerbitkan nomor kuitansi & masuk ke Buku Kas, gunakan tombol <strong>Catat Bayar</strong> pada halaman detail siswa. Gunakan kolom ini hanya untuk koreksi saldo awal migrasi.
                </p>
                <div className="space-y-1">
                  <Label htmlFor="edit-dspt-dibayar" className="text-xs font-medium">Total Terbayar Tercatat</Label>
                  <RupiahInput id="edit-dspt-dibayar" min={0} value={editDibayar} onValueChange={raw => setEditDibayar(raw)} placeholder="0" />
                </div>
              </div>
            </details>

            {editModal && (
              <div className="space-y-0.5 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <p className="tabular-nums">Keringanan aktif: {formatRupiah(editModal.total_diskon ?? 0)}</p>
                <p className="font-medium tabular-nums text-slate-700 dark:text-slate-200">
                  Sisa setelah simpan: {formatRupiah(Math.max(0, (parseInt(editNominal) || 0) - (parseInt(editDibayar) || 0) - (editModal.total_diskon ?? 0)))}
                </p>
              </div>
            )}
            {editMsg && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-600">{editMsg}</p>}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" className="h-9 flex-1 text-sm" onClick={() => setEditModal(null)}>Batal</Button>
              <Button type="submit" size="sm" className="h-9 flex-1 text-sm" disabled={isPending}>
                {isPending ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Set Nominal Massal ──────────────────────────────────────── */}
      <Dialog open={massalModal} onOpenChange={v => { if (!v) setMassalModal(false) }}>
        <DialogContent className="overflow-hidden rounded-xl p-0 sm:max-w-sm">
          <DialogHeader className="border-b bg-slate-50 px-5 py-4 dark:bg-slate-800/50">
            <DialogTitle className="text-sm font-semibold">Set Nominal DSPT Massal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleMassal} className="space-y-4 p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Menentukan nominal target DSPT untuk seluruh siswa dalam angkatan terpilih. Siswa yang sudah memiliki data DSPT akan diperbarui targetnya; yang belum ada akan dibuatkan otomatis.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Pilih Angkatan</Label>
              <Select value={massalAngkatan} onValueChange={setMassalAngkatan}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Pilih angkatan..." /></SelectTrigger>
                <SelectContent>
                  {angkatanList.map(y => <SelectItem key={y} value={String(y)}>Angkatan {y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="massal-dspt-nominal" className="text-xs font-medium">Nominal Target DSPT</Label>
              <RupiahInput id="massal-dspt-nominal" min={0} value={massalNominal} onValueChange={raw => setMassalNominal(raw)} placeholder="5.000.000" autoFocus required />
            </div>
            {massalMsg && (
              <p className={`rounded-md px-3 py-2 text-xs ${massalMsg.includes('berhasil') ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50' : 'bg-rose-50 text-rose-600'}`}>
                {massalMsg}
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" className="h-9 flex-1 text-sm" onClick={() => setMassalModal(false)}>Tutup</Button>
              <Button type="submit" size="sm" className="h-9 flex-1 text-sm" disabled={isPending || !massalAngkatan || !massalNominal}>
                {isPending ? 'Memproses...' : 'Terapkan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Import Excel ────────────────────────────────────────────── */}
      <Dialog open={importModal === 'dspt'} onOpenChange={v => { if (!v) { setImportModal(null); setImportRows([]) } }}>
        <DialogContent className="overflow-hidden rounded-xl p-0 sm:max-w-2xl">
          <DialogHeader className="border-b bg-slate-50 px-5 py-4 dark:bg-slate-800/50">
            <DialogTitle className="text-sm font-semibold">Import Data DSPT dari Excel</DialogTitle>
          </DialogHeader>
          <div className="max-h-[80vh] space-y-4 overflow-y-auto p-5">
            <div className="space-y-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
              <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Download Template Excel</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">Template sudah terisi nama & NISN semua siswa. Tinggal isi kolom nominalnya.</p>
              <div className="flex items-center gap-2">
                <Select value={templateAngkatan} onValueChange={setTemplateAngkatan}>
                  <SelectTrigger className="h-8 flex-1 bg-white text-xs dark:bg-slate-900"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semua">Semua Angkatan</SelectItem>
                    {angkatanList.map(y => <SelectItem key={y} value={String(y)}>Angkatan {y}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" className="h-8 gap-1.5 whitespace-nowrap border-emerald-300 text-xs text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                  disabled={templateLoading}
                  onClick={async () => {
                    setTemplateLoading(true)
                    await downloadDsptTemplate(studentScope, templateAngkatan !== 'semua' ? parseInt(templateAngkatan) : undefined)
                    setTemplateLoading(false)
                  }}>
                  <Upload className="h-3.5 w-3.5 rotate-180" />
                  {templateLoading ? 'Menyiapkan...' : 'Download Template'}
                </Button>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
              <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">Upload File yang Sudah Diisi</p>
              <div className="mb-3 space-y-0.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
                <p>Kolom yang dikenali: <strong>NISN</strong>, <strong>Nama Siswa</strong>, <strong>Nominal Target</strong>, <strong>Total Dibayar</strong>, <strong>Catatan</strong></p>
              </div>
            </div>
            <div>
              <Label htmlFor="import-dspt-file" className="mb-1.5 block text-xs font-medium">Pilih File (.xlsx / .xls)</Label>
              <input id="import-dspt-file" ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange}
                className="block w-full cursor-pointer text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-slate-200 dark:text-slate-400 dark:file:bg-slate-800/80" />
            </div>
            {importLoading && <p className="animate-pulse text-xs text-slate-400">Membaca file...</p>}
            {importRows.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">{importRows.length} baris terdeteksi — pratinjau 5 baris pertama:</p>
                <div role="region" aria-label="Pratinjau import Excel" tabIndex={0} className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-[11px]">
                    <thead className="bg-slate-50 dark:bg-slate-800">
                      <tr>
                        {Object.keys(importRows[0]).map(k => (
                          <th key={k} className="whitespace-nowrap border-b border-slate-200 px-2 py-1.5 text-left font-medium text-slate-600 dark:border-slate-700 dark:text-slate-400">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.slice(0, 5).map((r, i) => (
                        <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                          {Object.values(r).map((v: any, j) => (
                            <td key={j} className="whitespace-nowrap px-2 py-1.5 text-slate-700 dark:text-slate-300">{String(v)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {importMsg && (
              <p className={`rounded-md px-3 py-2 text-xs ${importMsg.includes('berhasil') && !importMsg.startsWith('0') ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50' : 'bg-rose-50 text-rose-600'}`}>
                {importMsg}
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="h-9 flex-1 text-sm" onClick={() => { setImportModal(null); setImportRows([]) }}>Tutup</Button>
              <Button size="sm" className="h-9 flex-1 gap-1.5 text-sm" disabled={!importRows.length || importLoading || isPending} onClick={handleImportSubmit}>
                <Upload className="h-3.5 w-3.5" />
                {importLoading ? 'Mengimport...' : `Import ${importRows.length} Baris`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Tambah manual ───────────────────────────────────────────── */}
      <Dialog open={addModal} onOpenChange={v => { if (!v) setAddModal(false) }}>
        <DialogContent className="overflow-hidden rounded-xl p-0 sm:max-w-md">
          <DialogHeader className="border-b bg-slate-50 px-5 py-4 dark:bg-slate-800/50">
            <DialogTitle className="text-sm font-semibold">Input Manual DSPT</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 p-5">
            <div className="space-y-1.5">
              <Label htmlFor="add-dspt-search" className="text-xs font-medium">Cari Siswa</Label>
              <div className="flex gap-2">
                <Input id="add-dspt-search" value={addSearch} autoComplete="off" autoCorrect="off" spellCheck={false} onChange={e => setAddSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSearch())}
                  className="h-9 flex-1 text-sm" placeholder="Ketik nama atau NISN, tekan Enter..." />
                <Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={handleAddSearch}>Cari</Button>
              </div>
            </div>
            {addResults.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                {addResults.map((s: any) => (
                  <button key={s.id} type="button" onClick={() => setAddSelected(s)}
                    className={`w-full border-b border-slate-100 px-3 py-2 text-left text-sm transition-colors last:border-b-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 ${addSelected?.id === s.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                    <p className="font-medium text-slate-900 dark:text-slate-50">{s.nama_lengkap}</p>
                    <p className="text-[11px] text-slate-400">{s.nisn ?? '-'} · {s.tingkat ? `Kelas ${s.tingkat}` : 'Kelas -'} · Angkatan {s.tahun_masuk}</p>
                  </button>
                ))}
              </div>
            )}
            {addSelected && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-800 dark:bg-blue-900/20">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">Dipilih: {addSelected.nama_lengkap}</p>
              </div>
            )}
            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="add-dspt-nominal" className="text-xs font-medium">Nominal Target DSPT</Label>
                <RupiahInput id="add-dspt-nominal" min={0} value={addNominal} onValueChange={raw => setAddNominal(raw)} placeholder="5.000.000" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-dspt-catatan" className="text-xs font-medium">Catatan (opsional)</Label>
                <Input id="add-dspt-catatan" value={addCatatan} onChange={e => setAddCatatan(e.target.value)} className="h-9 text-sm" placeholder="Anak guru, beasiswa, dll" />
              </div>
              {addMsg && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-600">{addMsg}</p>}
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" className="h-9 flex-1 text-sm" onClick={() => setAddModal(false)}>Batal</Button>
                <Button type="submit" size="sm" className="h-9 flex-1 text-sm" disabled={isPending || !addSelected || !addNominal}>
                  {isPending ? 'Menyimpan...' : 'Simpan'}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
