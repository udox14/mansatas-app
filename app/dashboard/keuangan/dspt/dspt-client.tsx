'use client'

import { useState, useMemo, useTransition, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Search, CheckCircle2, Clock, XCircle, Minus, Plus, Upload, Settings2, Pencil, Check } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import {
  createDspt, searchSiswa, updateDsptTarget, updateDsptPembayaran,
  tandaiDsptLunas, setNominalDsptMassal, importDsptBulk, getDsptList,
  getSiswaTemplate,
} from '../actions'
import { DataPagination, usePagination } from '@/components/ui/data-pagination'

interface DsptRow {
  id: string | null
  siswa_id: string
  nama_lengkap: string
  nisn: string
  tahun_masuk: number
  nominal_target: number | null
  total_dibayar: number | null
  total_diskon: number | null
  status: 'belum_bayar' | 'nyicil' | 'lunas' | 'tidak_ada'
  tingkat: number | null
  nomor_kelas: string | null
  kelompok: string | null
  catatan?: string | null
}

const STATUS_MAP = {
  lunas:       { label: 'Lunas',          icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  nyicil:      { label: 'Nyicil',         icon: Clock,        cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  belum_bayar: { label: 'Belum Bayar',    icon: XCircle,      cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
  tidak_ada:   { label: 'Belum Diinput',  icon: Minus,        cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
}

async function parseExcelFile(file: File): Promise<any[]> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(ws, { defval: '' })
}

async function downloadDsptTemplate(angkatan?: number) {
  const XLSX = await import('xlsx')
  const { data } = await getSiswaTemplate(angkatan)
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
  // Lebar kolom
  ws['!cols'] = [{ wch: 16 }, { wch: 32 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 24 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'DSPT')
  const suffix = angkatan ? `_angkatan_${angkatan}` : '_semua'
  XLSX.writeFile(wb, `template_dspt${suffix}.xlsx`)
}

export function DsptClient({ initialData, angkatanList: initialAngkatanList }: {
  initialData: DsptRow[]
  angkatanList?: number[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('semua')
  const [filterAngkatan, setFilterAngkatan] = useState(searchParams.get('angkatan') ?? 'semua')
  const [filterKelas, setFilterKelas] = useState('semua')
  const [msg, setMsg] = useState('')

  // ── Data state ──────────────────────────────────────────────────────────────
  const [data, setData] = useState<DsptRow[]>(initialData)
  useEffect(() => { setData(initialData) }, [initialData])

  async function reloadData() {
    const fresh = await getDsptList()
    setData(fresh.data as DsptRow[])
  }

  // ── Modal: Input DSPT baru (siswa belum diinput) ────────────────────────────
  const [modalSiswa, setModalSiswa] = useState<DsptRow | null>(null)
  const [nominal, setNominal] = useState('')
  const [catatan, setCatatan] = useState('')
  const [modalMsg, setModalMsg] = useState('')

  // ── Modal: Edit DSPT (target + pembayaran) ──────────────────────────────────
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

  const { page, pageSize, setPage, setPageSize, paginate, reset } = usePagination(10)

  const angkatanList = useMemo(() => {
    if (initialAngkatanList?.length) return initialAngkatanList
    const years = [...new Set(data.map(d => d.tahun_masuk).filter(Boolean))].sort((a, b) => b - a)
    return years
  }, [data, initialAngkatanList])

  const kelasList = useMemo(() => {
    const set = new Set<string>()
    data.forEach(d => {
      if (d.tingkat && d.nomor_kelas) set.add(`${d.tingkat}-${d.nomor_kelas}${d.kelompok ? ' ' + d.kelompok : ''}`)
    })
    return [...set].sort()
  }, [data])

  const filtered = useMemo(() => {
    reset()
    return data.filter(row => {
      const matchSearch = !search || row.nama_lengkap.toLowerCase().includes(search.toLowerCase()) || row.nisn?.includes(search)
      const matchStatus = filterStatus === 'semua' || row.status === filterStatus
      const matchAngkatan = filterAngkatan === 'semua' || String(row.tahun_masuk) === filterAngkatan
      const matchKelas = filterKelas === 'semua' || `${row.tingkat}-${row.nomor_kelas}${row.kelompok ? ' ' + row.kelompok : ''}` === filterKelas
      return matchSearch && matchStatus && matchAngkatan && matchKelas
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, search, filterStatus, filterAngkatan, filterKelas])

  const paginated = paginate(filtered)
  const withDspt = filtered.filter(r => r.status !== 'tidak_ada')
  const totalTarget  = withDspt.reduce((s, r) => s + (r.nominal_target ?? 0), 0)
  const totalDibayar = withDspt.reduce((s, r) => s + (r.total_dibayar ?? 0), 0)
  const totalDiskon  = withDspt.reduce((s, r) => s + (r.total_diskon ?? 0), 0)
  const totalSisa    = totalTarget - totalDibayar - totalDiskon

  // ── Handlers ────────────────────────────────────────────────────────────────
  function openSetDspt(row: DsptRow) {
    setModalSiswa(row); setNominal(''); setCatatan(''); setModalMsg('')
  }

  function openEditDspt(row: DsptRow) {
    setEditModal(row)
    setEditNominal(String(row.nominal_target ?? ''))
    setEditDibayar(String(row.total_dibayar ?? ''))
    setEditCatatan(row.catatan as string ?? '')
    setEditMsg('')
  }

  async function handleSetDspt(e: React.FormEvent) {
    e.preventDefault()
    if (!modalSiswa || !nominal) return
    startTransition(async () => {
      const res = await createDspt(modalSiswa.siswa_id, parseInt(nominal), catatan)
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
      const r1 = await updateDsptTarget(editModal.id!, nominalVal, editCatatan)
      if (r1.error) { setEditMsg(r1.error); return }
      const r2 = await updateDsptPembayaran(editModal.id!, dibayarVal)
      if (r2.error) { setEditMsg(r2.error); return }
      setEditModal(null)
      await reloadData()
      setMsg('Data DSPT berhasil diperbarui')
    })
  }

  async function handleLunas(row: DsptRow, e: React.MouseEvent) {
    e.stopPropagation()
    if (!row.id) return
    startTransition(async () => {
      const res = await tandaiDsptLunas(row.id!)
      setMsg(res.error ?? res.success ?? '')
      if (!res.error) await reloadData()
    })
  }

  async function handleAddSearch() {
    if (addSearch.trim().length < 2) return
    const res = await searchSiswa(addSearch)
    setAddResults(res.data)
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!addSelected || !addNominal) { setAddMsg('Pilih siswa dan isi nominal'); return }
    startTransition(async () => {
      const res = await createDspt(addSelected.id, parseInt(addNominal), addCatatan)
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
      const res = await setNominalDsptMassal(parseInt(massalAngkatan), parseInt(massalNominal))
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
    // Mapping kolom fleksibel
    const mapped = importRows.map(r => ({
      nisn: String(r['NISN'] ?? r['nisn'] ?? r['Nisn'] ?? '').trim() || undefined,
      nama: String(r['Nama'] ?? r['NAMA'] ?? r['nama_lengkap'] ?? r['Nama Siswa'] ?? '').trim() || undefined,
      nominal_target: parseInt(String(r['Nominal Target'] ?? r['nominal_target'] ?? r['Target'] ?? 0)) || 0,
      total_dibayar: parseInt(String(r['Total Dibayar'] ?? r['total_dibayar'] ?? r['Dibayar'] ?? r['Terbayar'] ?? 0)) || 0,
      catatan: String(r['Catatan'] ?? r['catatan'] ?? '').trim() || undefined,
    })).filter(r => r.nisn || r.nama)

    const res = await importDsptBulk(mapped)
    setImportMsg((res.error ? res.error + ' — ' : '') + res.success)
    if (!res.error || res.sukses > 0) { await reloadData(); setImportRows([]) }
    setImportLoading(false)
  }

  return (
    <div className="space-y-3 pb-8">
      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input placeholder="Cari nama atau NISN..." value={search}
            onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm rounded-md" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-36 text-xs rounded-md"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua Status</SelectItem>
            <SelectItem value="lunas">Lunas</SelectItem>
            <SelectItem value="nyicil">Nyicil</SelectItem>
            <SelectItem value="belum_bayar">Belum Bayar</SelectItem>
            <SelectItem value="tidak_ada">Belum Diinput</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterAngkatan} onValueChange={setFilterAngkatan}>
          <SelectTrigger className="h-8 w-32 text-xs rounded-md"><SelectValue placeholder="Angkatan" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua Angkatan</SelectItem>
            {angkatanList.map(y => <SelectItem key={y} value={String(y)}>Angkatan {y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterKelas} onValueChange={setFilterKelas}>
          <SelectTrigger className="h-8 w-28 text-xs rounded-md"><SelectValue placeholder="Kelas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua Kelas</SelectItem>
            {kelasList.map(k => <SelectItem key={k} value={k}>Kelas {k}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
            onClick={() => { setMassalModal(true); setMassalMsg(''); setMassalAngkatan(angkatanList[0] ? String(angkatanList[0]) : ''); setMassalNominal('') }}>
            <Settings2 className="h-3.5 w-3.5" /> Set Nominal Massal
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
            onClick={() => { setImportModal('dspt'); setImportRows([]); setImportMsg('') }}>
            <Upload className="h-3.5 w-3.5" /> Import Excel
          </Button>
          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => { setAddModal(true); setAddMsg('') }}>
            <Plus className="h-3.5 w-3.5" /> Input Manual
          </Button>
        </div>
      </div>

      {msg && <p className={`text-xs px-3 py-2 rounded-md ${msg.includes('berhasil') ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>{msg}</p>}

      {/* Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Total Target', value: formatRupiah(totalTarget), color: 'text-slate-900 dark:text-slate-50' },
          { label: 'Terkumpul', value: formatRupiah(totalDibayar), color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Diskon', value: formatRupiah(totalDiskon), color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Sisa Tunggakan', value: formatRupiah(totalSisa), color: 'text-rose-600 dark:text-rose-400' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2">
            <p className="text-[11px] text-slate-500">{s.label}</p>
            <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-800/50">
              <TableHead className="text-xs font-semibold">Nama Siswa</TableHead>
              <TableHead className="text-xs font-semibold">Angkatan</TableHead>
              <TableHead className="text-xs font-semibold">Kelas</TableHead>
              <TableHead className="text-xs font-semibold text-right">Target</TableHead>
              <TableHead className="text-xs font-semibold text-right">Dibayar</TableHead>
              <TableHead className="text-xs font-semibold text-right">Sisa</TableHead>
              <TableHead className="text-xs font-semibold">Status</TableHead>
              <TableHead className="w-28 text-xs font-semibold text-center">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-slate-400 text-sm">Tidak ada data</TableCell>
              </TableRow>
            )}
            {paginated.map(row => {
              const sisa = (row.nominal_target ?? 0) - (row.total_dibayar ?? 0) - (row.total_diskon ?? 0)
              const s = STATUS_MAP[row.status] ?? STATUS_MAP.tidak_ada
              const Icon = s.icon
              const belumInput = row.status === 'tidak_ada'
              return (
                <TableRow
                  key={row.siswa_id}
                  className={`transition-colors ${!belumInput ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''}`}
                  onClick={() => !belumInput && router.push(`/dashboard/keuangan/siswa/${row.siswa_id}?tab=dspt`)}
                >
                  <TableCell>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{row.nama_lengkap}</p>
                    <p className="text-[11px] text-slate-400">{row.nisn ?? '-'}</p>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 dark:text-slate-300">{row.tahun_masuk}</TableCell>
                  <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                    {row.tingkat ? `${row.tingkat}-${row.nomor_kelas}${row.kelompok ? ' ' + row.kelompok : ''}` : '-'}
                  </TableCell>
                  <TableCell className="text-sm text-right font-medium">{belumInput ? '-' : formatRupiah(row.nominal_target ?? 0)}</TableCell>
                  <TableCell className="text-sm text-right text-emerald-600 font-medium">{belumInput ? '-' : formatRupiah(row.total_dibayar ?? 0)}</TableCell>
                  <TableCell className={`text-sm text-right font-medium ${sisa > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {belumInput ? '-' : formatRupiah(sisa)}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${s.cls}`}>
                      <Icon className="h-2.5 w-2.5" />{s.label}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      {belumInput ? (
                        <Button size="sm" variant="outline" className="h-6 text-[11px] px-2"
                          onClick={() => openSetDspt(row)}>Input</Button>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-slate-400 hover:text-slate-700"
                            onClick={e => { e.stopPropagation(); openEditDspt(row) }} title="Edit">
                            <Pencil className="h-3 w-3" />
                          </Button>
                          {row.status !== 'lunas' && (
                            <Button size="sm" variant="ghost"
                              className="h-6 text-[11px] px-2 gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              onClick={e => handleLunas(row, e)} disabled={isPending} title="Tandai Lunas">
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
        <DataPagination
          total={filtered.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          entityLabel="siswa"
        />
        <div className="px-4 py-1.5 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
          {withDspt.length} dari {filtered.length} sudah diinput DSPT
        </div>
      </div>

      {/* ── Modal: Input DSPT baru ─────────────────────────────────────────── */}
      <Dialog open={!!modalSiswa} onOpenChange={v => { if (!v) setModalSiswa(null) }}>
        <DialogContent className="sm:max-w-sm rounded-xl p-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-b">
            <DialogTitle className="text-sm font-semibold">Input Target DSPT</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSetDspt} className="p-5 space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{modalSiswa?.nama_lengkap}</p>
              <p className="text-[11px] text-slate-500">{modalSiswa?.nisn ?? '-'} · Angkatan {modalSiswa?.tahun_masuk}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nominal Target DSPT (Rp)</Label>
              <Input type="number" min={0} value={nominal} onChange={e => setNominal(e.target.value)}
                className="h-9 text-sm" placeholder="Contoh: 5000000" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Catatan (opsional)</Label>
              <Input value={catatan} onChange={e => setCatatan(e.target.value)} className="h-9 text-sm" placeholder="Anak guru, beasiswa, dll" />
            </div>
            {modalMsg && <p className="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-md">{modalMsg}</p>}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" className="flex-1 h-9 text-sm" onClick={() => setModalSiswa(null)}>Batal</Button>
              <Button type="submit" size="sm" className="flex-1 h-9 text-sm" disabled={isPending || !nominal}>
                {isPending ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Edit DSPT (target + pembayaran) ───────────────────────────── */}
      <Dialog open={!!editModal} onOpenChange={v => { if (!v) setEditModal(null) }}>
        <DialogContent className="sm:max-w-sm rounded-xl p-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-b">
            <DialogTitle className="text-sm font-semibold">Edit Data DSPT</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSave} className="p-5 space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{editModal?.nama_lengkap}</p>
              <p className="text-[11px] text-slate-500">{editModal?.nisn ?? '-'} · Angkatan {editModal?.tahun_masuk}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Nominal Target (Rp)</Label>
                <Input type="number" min={0} value={editNominal}
                  onChange={e => setEditNominal(e.target.value)} className="h-9 text-sm" placeholder="0" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Total Dibayar (Rp)</Label>
                <Input type="number" min={0} value={editDibayar}
                  onChange={e => setEditDibayar(e.target.value)} className="h-9 text-sm" placeholder="0" />
                <p className="text-[11px] text-slate-400">Set total keseluruhan yg sudah dibayar</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Catatan (opsional)</Label>
              <Input value={editCatatan} onChange={e => setEditCatatan(e.target.value)} className="h-9 text-sm" placeholder="Anak guru, beasiswa, dll" />
            </div>
            {editModal && (
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-[11px] text-slate-500 space-y-0.5">
                <p>Diskon: {formatRupiah(editModal.total_diskon ?? 0)}</p>
                <p>Sisa setelah simpan: {formatRupiah(Math.max(0, (parseInt(editNominal) || 0) - (parseInt(editDibayar) || 0) - (editModal.total_diskon ?? 0)))}</p>
              </div>
            )}
            {editMsg && <p className="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-md">{editMsg}</p>}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" className="flex-1 h-9 text-sm" onClick={() => setEditModal(null)}>Batal</Button>
              <Button type="submit" size="sm" className="flex-1 h-9 text-sm" disabled={isPending}>
                {isPending ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Set Nominal Massal ──────────────────────────────────────── */}
      <Dialog open={massalModal} onOpenChange={v => { if (!v) setMassalModal(false) }}>
        <DialogContent className="sm:max-w-sm rounded-xl p-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-b">
            <DialogTitle className="text-sm font-semibold">Set Nominal DSPT Massal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleMassal} className="p-5 space-y-4">
            <p className="text-xs text-slate-500">
              Menentukan nominal target DSPT untuk seluruh siswa dalam angkatan terpilih.
              Siswa yang sudah ada record DSPT-nya akan diupdate nominalnya; yang belum ada akan dibuatkan otomatis.
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
              <Label className="text-xs font-medium">Nominal Target DSPT (Rp)</Label>
              <Input type="number" min={0} value={massalNominal} onChange={e => setMassalNominal(e.target.value)}
                className="h-9 text-sm" placeholder="Contoh: 5000000" autoFocus />
            </div>
            {massalMsg && (
              <p className={`text-xs px-3 py-2 rounded-md ${massalMsg.includes('berhasil') ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                {massalMsg}
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" className="flex-1 h-9 text-sm" onClick={() => setMassalModal(false)}>Tutup</Button>
              <Button type="submit" size="sm" className="flex-1 h-9 text-sm" disabled={isPending || !massalAngkatan || !massalNominal}>
                {isPending ? 'Memproses...' : 'Terapkan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Import Excel ────────────────────────────────────────────── */}
      <Dialog open={importModal === 'dspt'} onOpenChange={v => { if (!v) { setImportModal(null); setImportRows([]) } }}>
        <DialogContent className="sm:max-w-2xl rounded-xl p-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-b">
            <DialogTitle className="text-sm font-semibold">Import Data DSPT dari Excel</DialogTitle>
          </DialogHeader>
          <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            {/* Download Template */}
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 space-y-2.5">
              <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Download Template Excel</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">Template sudah terisi nama & NISN semua siswa. Tinggal isi kolom nominalnya.</p>
              <div className="flex gap-2 items-center">
                <Select value={templateAngkatan} onValueChange={setTemplateAngkatan}>
                  <SelectTrigger className="h-8 text-xs flex-1 bg-white dark:bg-slate-900"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semua">Semua Angkatan</SelectItem>
                    {angkatanList.map(y => <SelectItem key={y} value={String(y)}>Angkatan {y}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 whitespace-nowrap"
                  disabled={templateLoading}
                  onClick={async () => {
                    setTemplateLoading(true)
                    await downloadDsptTemplate(templateAngkatan !== 'semua' ? parseInt(templateAngkatan) : undefined)
                    setTemplateLoading(false)
                  }}>
                  <Upload className="h-3.5 w-3.5 rotate-180" />
                  {templateLoading ? 'Menyiapkan...' : 'Download Template'}
                </Button>
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Upload File yang Sudah Diisi</p>
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-xs text-slate-500 space-y-0.5 mb-3">
                <p>Kolom yang dikenali: <strong>NISN</strong>, <strong>Nama Siswa</strong>, <strong>Nominal Target</strong>, <strong>Total Dibayar</strong>, <strong>Catatan</strong></p>
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Pilih File (.xlsx / .xls)</Label>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange}
                className="block w-full text-xs text-slate-600 file:mr-3 file:text-xs file:font-medium file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:rounded-md hover:file:bg-slate-200 cursor-pointer" />
            </div>
            {importLoading && <p className="text-xs text-slate-400 animate-pulse">Membaca file...</p>}
            {importRows.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-600 mb-2">{importRows.length} baris terdeteksi — preview 5 baris pertama:</p>
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden overflow-x-auto">
                  <table className="text-[11px] w-full">
                    <thead className="bg-slate-50 dark:bg-slate-800">
                      <tr>
                        {Object.keys(importRows[0]).map(k => (
                          <th key={k} className="px-2 py-1.5 text-left font-medium text-slate-600 whitespace-nowrap border-b border-slate-200 dark:border-slate-700">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.slice(0, 5).map((r, i) => (
                        <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                          {Object.values(r).map((v: any, j) => (
                            <td key={j} className="px-2 py-1.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">{String(v)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {importMsg && (
              <p className={`text-xs px-3 py-2 rounded-md ${importMsg.includes('berhasil') && !importMsg.startsWith('0') ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                {importMsg}
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="flex-1 h-9 text-sm" onClick={() => { setImportModal(null); setImportRows([]) }}>Tutup</Button>
              <Button size="sm" className="flex-1 h-9 text-sm gap-1.5" disabled={!importRows.length || importLoading || isPending} onClick={handleImportSubmit}>
                <Upload className="h-3.5 w-3.5" />
                {importLoading ? 'Mengimport...' : `Import ${importRows.length} Baris`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Tambah manual ───────────────────────────────────────────── */}
      <Dialog open={addModal} onOpenChange={v => { if (!v) setAddModal(false) }}>
        <DialogContent className="sm:max-w-md rounded-xl p-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-b">
            <DialogTitle className="text-sm font-semibold">Input Manual DSPT</DialogTitle>
          </DialogHeader>
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Cari Siswa</Label>
              <div className="flex gap-2">
                <Input value={addSearch} onChange={e => setAddSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSearch())}
                  className="h-9 text-sm flex-1" placeholder="Ketik nama atau NISN, tekan Enter..." />
                <Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={handleAddSearch}>Cari</Button>
              </div>
            </div>
            {addResults.length > 0 && (
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                {addResults.map((s: any) => (
                  <button key={s.id} type="button" onClick={() => setAddSelected(s)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 border-b last:border-b-0 border-slate-100 dark:border-slate-700 transition-colors ${addSelected?.id === s.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                    <p className="font-medium text-slate-900 dark:text-slate-50">{s.nama_lengkap}</p>
                    <p className="text-[11px] text-slate-400">{s.nisn ?? '-'} · {s.tingkat ? `Kelas ${s.tingkat}` : 'Kelas -'} · Angkatan {s.tahun_masuk}</p>
                  </button>
                ))}
              </div>
            )}
            {addSelected && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">Dipilih: {addSelected.nama_lengkap}</p>
              </div>
            )}
            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Nominal Target DSPT (Rp)</Label>
                <Input type="number" min={0} value={addNominal} onChange={e => setAddNominal(e.target.value)} className="h-9 text-sm" placeholder="5000000" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Catatan (opsional)</Label>
                <Input value={addCatatan} onChange={e => setAddCatatan(e.target.value)} className="h-9 text-sm" placeholder="Anak guru, beasiswa, dll" />
              </div>
              {addMsg && <p className="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-md">{addMsg}</p>}
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" className="flex-1 h-9 text-sm" onClick={() => setAddModal(false)}>Batal</Button>
                <Button type="submit" size="sm" className="flex-1 h-9 text-sm" disabled={isPending || !addSelected || !addNominal}>
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
