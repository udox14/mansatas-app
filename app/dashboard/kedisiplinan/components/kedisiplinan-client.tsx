// Lokasi: app/dashboard/kedisiplinan/components/kedisiplinan-client.tsx
'use client'

import { useState, useMemo } from 'react'
import Script from 'next/script'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  Search, PlusCircle, Trash2, Pencil, Image as ImageIcon, AlertTriangle,
  ShieldCheck, BookOpen, FileSpreadsheet, Download, Loader2, ChevronLeft,
  ChevronRight, User, X, ExternalLink
} from 'lucide-react'
import { FormModal } from './form-modal'
import { MasterModal } from './master-modal'
import { hapusPelanggaran, hapusMasterPelanggaran, importMasterPelanggaranMassal, type SanksiConfig } from '../actions'
import { cn } from '@/lib/utils'

// ── Sanksi helpers ──────────────────────────────────────────
function getSanksiForPoin(poin: number, sanksiList: SanksiConfig[]): SanksiConfig | null {
  return [...sanksiList].sort((a, b) => b.poin_minimal - a.poin_minimal).find(s => poin >= s.poin_minimal) || null
}

function getSanksiStyle(urutan: number) {
  if (urutan === 1) return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
  if (urutan === 2) return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800'
  if (urutan === 3) return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
  return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800'
}

const AMAN_STYLE = 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'

// ─── Modal Detail Kasus per Siswa ──────────────────────────────
function DetailKasusModal({
  group, lifetimePoin, sanksiList, isSuperAdmin, currentUser, isPending,
  onEdit, onHapus, onClose
}: {
  group: { siswa: any; kasus: any[]; totalPoin: number; siswaId: string } | null
  lifetimePoin: Record<string, number>
  sanksiList: SanksiConfig[]
  isSuperAdmin: boolean
  currentUser: any
  isPending: boolean
  onEdit: (k: any) => void
  onHapus: (id: string) => void
  onClose: () => void
}) {
  if (!group) return null
  const totalPoinLifetime = lifetimePoin[group.siswaId] ?? group.totalPoin
  const sanksi = getSanksiForPoin(totalPoinLifetime, sanksiList)
  const badgeStyle = sanksi ? getSanksiStyle(sanksi.urutan) : AMAN_STYLE
  const kelas = group.siswa.kelas
    ? `${group.siswa.kelas.tingkat}-${group.siswa.kelas.nomor_kelas}`
    : '-'

  const sortedKasus = [...group.kasus].sort(
    (a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()
  )

  return (
    <Dialog open={!!group} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-lg rounded-xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center text-white font-black text-base shrink-0">
              {group.siswa.nama_lengkap?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug">
                {group.siswa.nama_lengkap}
              </DialogTitle>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Kelas {kelas}</p>
            </div>
            <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wide">Kasus (TA ini)</p>
              <p className="text-xl font-black text-slate-700 dark:text-slate-200">{group.kasus.length}</p>
            </div>
            <div className="bg-rose-50 dark:bg-rose-900/20 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-rose-500 font-medium uppercase tracking-wide">Poin Seumur</p>
              <p className="text-xl font-black text-rose-600">{totalPoinLifetime}</p>
            </div>
            <div className={cn('rounded-lg p-2.5 text-center border', badgeStyle)}>
              <p className="text-[10px] font-medium uppercase tracking-wide opacity-70">Sanksi</p>
              <p className="text-base font-black">{sanksi?.nama || 'Baik'}</p>
              {sanksi?.deskripsi && <p className="text-[9px] font-medium mt-0.5 opacity-70 truncate">{sanksi.deskripsi}</p>}
            </div>
          </div>
        </DialogHeader>

        {/* Kasus list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {sortedKasus.map((k, i) => {
            const isOwner = k.diinput_oleh === currentUser.id
            const canEditThis = isOwner || isSuperAdmin
            return (
              <div key={k.id} className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-white dark:bg-slate-900 hover:border-rose-200 dark:hover:border-rose-800 transition-colors">
                <div className="flex items-start gap-2.5">
                  {/* Nomor + poin */}
                  <div className="h-8 w-8 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center font-black text-rose-600 dark:text-rose-400 text-[11px] border border-rose-200 dark:border-rose-800 shrink-0">
                    +{k.master_pelanggaran?.poin}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-rose-700 dark:text-rose-400 leading-snug">
                      {k.master_pelanggaran?.nama_pelanggaran}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {new Date(k.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    {k.keterangan && (
                      <p className="text-[11px] italic text-slate-500 dark:text-slate-400 mt-1.5 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700">
                        "{k.keterangan}"
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        Pelapor: <span className="font-semibold text-slate-600 dark:text-slate-300">{isOwner ? 'Anda' : (k.pelapor?.nama_lengkap || 'Sistem')}</span>
                      </span>
                      {k.foto_url && (
                        <a href={k.foto_url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 transition-colors">
                          <ImageIcon className="h-3 w-3" /> Bukti Foto
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                  {/* Aksi */}
                  <div className="flex gap-1 shrink-0">
                    {canEditThis && (
                      <button onClick={() => { onEdit(k); onClose() }}
                        disabled={isPending}
                        className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                        title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {isSuperAdmin && (
                      <button onClick={() => onHapus(k.id)}
                        disabled={isPending}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                        title="Hapus">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Component ──────────────────────────────────────────
export function KedisiplinanClient({
  currentUser, kasusList, masterList, taAktifId, sanksiList = [], lifetimePoin = {}
}: {
  currentUser: { id: string, role: string, nama: string }
  kasusList: any[]
  masterList: any[]
  taAktifId?: string
  sanksiList?: SanksiConfig[]
  lifetimePoin?: Record<string, number>
}) {
  const isSuperAdmin = currentUser.role === 'super_admin'
  const canInput = ['super_admin', 'admin_tu', 'wakamad', 'guru_bk', 'guru_piket', 'resepsionis', 'guru'].includes(currentUser.role)
  const canManageMaster = ['super_admin', 'wakamad', 'guru_bk'].includes(currentUser.role)

  const [allKasus, setAllKasus] = useState(kasusList)
  const [isPending, setIsPending] = useState(false)

  // Filter & pagination
  const [search, setSearch] = useState('')
  const [filterTingkat, setFilterTingkat] = useState('ALL')
  const [filterLevel, setFilterLevel] = useState('ALL')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [editKasusData, setEditKasusData] = useState<any>(null)
  const [detailGroup, setDetailGroup] = useState<{ siswa: any; kasus: any[]; totalPoin: number; siswaId: string } | null>(null)

  // Master
  const [searchMaster, setSearchMaster] = useState('')
  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false)
  const [editMasterData, setEditMasterData] = useState<any>(null)
  const [isImportingKamus, setIsImportingKamus] = useState(false)

  // ── Group kasus per siswa ─────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<string, { siswa: any; kasus: any[]; totalPoin: number; siswaId: string }>()
    for (const k of allKasus) {
      if (!map.has(k.siswa_id)) map.set(k.siswa_id, { siswa: k.siswa, kasus: [], totalPoin: 0, siswaId: k.siswa_id })
      const entry = map.get(k.siswa_id)!
      entry.kasus.push(k)
      entry.totalPoin += k.master_pelanggaran?.poin || 0
    }
    return Array.from(map.values())
  }, [allKasus])

  const filteredGrouped = useMemo(() => {
    let result = grouped
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(g =>
        g.siswa.nama_lengkap.toLowerCase().includes(q) ||
        (g.siswa.kelas && `${g.siswa.kelas.tingkat}-${g.siswa.kelas.nomor_kelas}`.toLowerCase().includes(q))
      )
    }
    if (filterTingkat !== 'ALL') result = result.filter(g => g.siswa.kelas?.tingkat?.toString() === filterTingkat)
    if (filterLevel !== 'ALL') {
      result = result.filter(g => {
        const lt = lifetimePoin[g.siswaId] ?? g.totalPoin
        const sanksi = getSanksiForPoin(lt, sanksiList)
        if (filterLevel === 'baik') return !sanksi
        return sanksi?.id === filterLevel
      })
    }
    result.sort((a, b) => b.totalPoin - a.totalPoin)
    return result
  }, [grouped, search, filterTingkat, filterLevel, sanksiList, lifetimePoin])

  const totalPages = Math.max(1, Math.ceil(filteredGrouped.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedGroups = filteredGrouped.slice((safePage - 1) * pageSize, safePage * pageSize)

  const resetPage = () => setPage(1)

  // ── Hapus ────────────────────────────────────────────────
  const handleHapusKasus = async (id: string) => {
    if (!confirm('Yakin ingin menghapus catatan pelanggaran ini?')) return
    setIsPending(true)
    const res = await hapusPelanggaran(id)
    if (res.error) alert(res.error)
    else {
      setAllKasus(prev => prev.filter((k: any) => k.id !== id))
      // Update detailGroup jika sedang terbuka
      if (detailGroup) {
        const newKasus = detailGroup.kasus.filter(k => k.id !== id)
        if (newKasus.length === 0) setDetailGroup(null)
        else {
          const removedPoin = detailGroup.kasus.find(k => k.id === id)?.master_pelanggaran?.poin || 0
          setDetailGroup({ ...detailGroup, kasus: newKasus, totalPoin: detailGroup.totalPoin - removedPoin, siswaId: detailGroup.siswaId })
        }
      }
    }
    setIsPending(false)
  }

  const handleHapusMaster = async (id: string) => {
    if (!confirm('Yakin ingin menghapus kamus pelanggaran ini?')) return
    setIsPending(true)
    const res = await hapusMasterPelanggaran(id)
    if (res.error) alert(res.error)
    setIsPending(false)
  }

  // ── Import Kamus ─────────────────────────────────────────
  const handleDownloadTemplateKamus = () => {
    const XLSX = (window as any).XLSX
    if (!XLSX) return alert('Library belum siap.')
    const data = [
      { NAMA_PELANGGARAN: 'Terlambat hadir lebih dari 15 menit', KATEGORI: 'Ringan', POIN: 5 },
      { NAMA_PELANGGARAN: 'Berambut panjang/gondrong (Putra)', KATEGORI: 'Sedang', POIN: 10 },
      { NAMA_PELANGGARAN: 'Membawa senjata tajam', KATEGORI: 'Berat', POIN: 100 },
    ]
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Kamus_Pelanggaran')
    XLSX.writeFile(wb, 'Template_Kamus_Pelanggaran.xlsx')
  }

  const handleFileUploadKamus = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsImportingKamus(true)
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const XLSX = (window as any).XLSX
        if (!XLSX) throw new Error('Library belum dimuat.')
        const workbook = XLSX.read(event.target?.result, { type: 'binary' })
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])
        const result = await importMasterPelanggaranMassal(jsonData)
        if (result.error) alert(result.error)
        else alert(result.success)
      } catch { alert('Gagal membaca file Excel.') }
      finally { setIsImportingKamus(false); e.target.value = '' }
    }
    reader.readAsBinaryString(file)
  }

  const filteredMaster = masterList.filter(m =>
    m.nama_pelanggaran.toLowerCase().includes(searchMaster.toLowerCase())
  )
  const kategoriColor = (k: string) => {
    if (k === 'Ringan') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    if (k === 'Sedang') return 'bg-amber-50 text-amber-700 border-amber-200'
    return 'bg-rose-50 text-rose-700 border-rose-200'
  }

  return (
    <>
      <Script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js" strategy="lazyOnload" />
      <div className="space-y-3">
        <Tabs defaultValue="riwayat" className="space-y-3">
          <TabsList className={cn("bg-surface border border-surface rounded-lg w-full grid p-0.5 gap-0.5 h-auto", canManageMaster ? 'grid-cols-2' : 'grid-cols-1')}>
            <TabsTrigger value="riwayat" className="py-2 rounded-md data-[state=active]:bg-rose-600 data-[state=active]:text-white text-xs sm:text-sm font-medium">
              Riwayat Pelanggaran
            </TabsTrigger>
            {canManageMaster && (
              <TabsTrigger value="kamus" className="py-2 rounded-md data-[state=active]:bg-slate-800 data-[state=active]:text-white text-xs sm:text-sm font-medium">
                Kamus &amp; Poin
              </TabsTrigger>
            )}
          </TabsList>

          {/* ── TAB RIWAYAT ── */}
          <TabsContent value="riwayat" className="space-y-3 m-0">
            {/* TOOLBAR */}
            <div className="bg-surface border border-surface rounded-lg p-3 space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                  <Input
                    placeholder="Cari nama siswa / kelas..."
                    value={search}
                    onChange={e => { setSearch(e.target.value); resetPage() }}
                    className="pl-8 h-8 text-sm rounded-md"
                  />
                </div>
                {canInput && (
                  <Button
                    onClick={() => { setEditKasusData(null); setIsFormModalOpen(true) }}
                    size="sm"
                    className="h-8 px-3 text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-md shrink-0"
                  >
                    <PlusCircle className="h-3.5 w-3.5 mr-1" /> Lapor
                  </Button>
                )}
              </div>

              {/* Filter row */}
              <div className="flex gap-2 flex-wrap">
                <Select value={filterTingkat} onValueChange={v => { setFilterTingkat(v); resetPage() }}>
                  <SelectTrigger className="h-7 text-xs rounded flex-1 min-w-[90px]"><SelectValue placeholder="Tingkat" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua Kelas</SelectItem>
                    <SelectItem value="7">Kelas 7</SelectItem>
                    <SelectItem value="8">Kelas 8</SelectItem>
                    <SelectItem value="9">Kelas 9</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterLevel} onValueChange={v => { setFilterLevel(v); resetPage() }}>
                  <SelectTrigger className="h-7 text-xs rounded flex-1 min-w-[90px]"><SelectValue placeholder="Sanksi" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua Level</SelectItem>
                    <SelectItem value="baik">Belum Ada Sanksi</SelectItem>
                    {sanksiList.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); resetPage() }}>
                  <SelectTrigger className="h-7 text-xs rounded w-[70px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 / hal</SelectItem>
                    <SelectItem value="20">20 / hal</SelectItem>
                    <SelectItem value="50">50 / hal</SelectItem>
                    <SelectItem value="100">100 / hal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* LIST */}
            {filteredGrouped.length === 0 ? (
              <div className="bg-surface py-12 rounded-xl border border-surface text-center">
                <ShieldCheck className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-slate-400 dark:text-slate-500">Belum ada catatan pelanggaran.</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {pagedGroups.map(group => {
                    const lt = lifetimePoin[group.siswaId] ?? group.totalPoin
                    const sanksi = getSanksiForPoin(lt, sanksiList)
                    const badgeStyle = sanksi ? getSanksiStyle(sanksi.urutan) : AMAN_STYLE
                    const kelas = group.siswa.kelas
                      ? `${group.siswa.kelas.tingkat}-${group.siswa.kelas.nomor_kelas}`
                      : '-'

                    return (
                      <button
                        key={group.siswaId}
                        type="button"
                        onClick={() => setDetailGroup(group)}
                        className="w-full bg-surface border border-surface rounded-xl px-4 py-3 flex items-center gap-3 hover:border-rose-200 dark:hover:border-rose-800 hover:bg-rose-50/20 dark:hover:bg-rose-900/10 transition-all text-left group"
                      >
                        {/* Avatar */}
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center text-white font-black text-sm shrink-0">
                          {group.siswa.nama_lengkap?.charAt(0)?.toUpperCase() || '?'}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-rose-700 dark:group-hover:text-rose-400 transition-colors">
                              {group.siswa.nama_lengkap}
                            </p>
                            <span className={cn('text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full border', badgeStyle)}>
                              {sanksi?.nama || 'Baik'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500">
                            Kelas {kelas} · <span className="font-semibold">{group.kasus.length} kasus</span>
                          </p>
                        </div>

                        {/* Poin TA ini */}
                        <div className="text-right shrink-0 hidden sm:block">
                          <p className="text-[9px] text-slate-400 dark:text-slate-500 uppercase font-medium">Poin (TA)</p>
                          <p className="text-base font-black text-rose-600">{group.totalPoin}</p>
                        </div>

                        {/* Poin Lifetime */}
                        <div className="text-right shrink-0">
                          <p className="text-[9px] text-slate-400 dark:text-slate-500 uppercase font-medium">Seumur</p>
                          <p className="text-base font-black text-rose-700">{lt}</p>
                        </div>

                        <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600 group-hover:text-rose-400 dark:group-hover:text-rose-500 transition-colors shrink-0" />
                      </button>
                    )
                  })}
                </div>

                {/* PAGINATION */}
                <div className="flex items-center justify-between bg-surface border border-surface rounded-lg px-3 py-2 mt-1">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {filteredGrouped.length} siswa · hal <span className="font-semibold">{safePage}</span>/{totalPages}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm"
                      onClick={() => setPage(1)}
                      disabled={safePage === 1}
                      className="h-7 w-7 p-0 text-xs rounded hidden sm:flex items-center justify-center">
                      «
                    </Button>
                    <Button variant="outline" size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={safePage === 1}
                      className="h-7 px-2.5 text-xs rounded flex items-center gap-1">
                      <ChevronLeft className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Prev</span>
                    </Button>

                    {/* Page numbers */}
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number
                        if (totalPages <= 5) pageNum = i + 1
                        else if (safePage <= 3) pageNum = i + 1
                        else if (safePage >= totalPages - 2) pageNum = totalPages - 4 + i
                        else pageNum = safePage - 2 + i
                        return (
                          <button key={pageNum} onClick={() => setPage(pageNum)}
                            className={cn(
                              'h-7 w-7 text-xs rounded-md font-medium transition-colors',
                              pageNum === safePage
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                            )}>
                            {pageNum}
                          </button>
                        )
                      })}
                    </div>

                    <Button variant="outline" size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={safePage >= totalPages}
                      className="h-7 px-2.5 text-xs rounded flex items-center gap-1">
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="sm"
                      onClick={() => setPage(totalPages)}
                      disabled={safePage >= totalPages}
                      className="h-7 w-7 p-0 text-xs rounded hidden sm:flex items-center justify-center">
                      »
                    </Button>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* ── TAB KAMUS ── */}
          {canManageMaster && (
            <TabsContent value="kamus" className="space-y-3 m-0">
              <div className="bg-surface border border-surface rounded-lg p-3 flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-0" style={{ minWidth: '140px' }}>
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                  <Input placeholder="Cari pelanggaran..." value={searchMaster} onChange={e => setSearchMaster(e.target.value)} className="pl-8 h-8 text-sm rounded-md" />
                </div>
                <div className="flex gap-2 ml-auto">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 text-xs rounded-md">
                        <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Import
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md rounded-xl">
                      <DialogHeader><DialogTitle className="text-base font-semibold">Import Kamus Pelanggaran</DialogTitle></DialogHeader>
                      <div className="space-y-3 py-3">
                        <div className="flex justify-between items-center bg-surface-2 p-2.5 rounded-lg border border-surface">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Download format:</span>
                          <Button size="sm" variant="outline" onClick={handleDownloadTemplateKamus} className="h-7 text-xs gap-1">
                            <Download className="h-3 w-3" />Template
                          </Button>
                        </div>
                        <div className="bg-surface-3 p-3 rounded-lg text-xs font-mono text-slate-600 dark:text-slate-300 space-y-0.5">
                          <p className="font-bold mb-1">Kolom:</p>
                          <p>1. NAMA_PELANGGARAN</p>
                          <p>2. KATEGORI (Ringan/Sedang/Berat)</p>
                          <p>3. POIN (angka)</p>
                        </div>
                        <Input type="file" accept=".xlsx,.xls" onChange={handleFileUploadKamus} disabled={isImportingKamus} className="h-9 text-xs rounded-lg cursor-pointer" />
                        {isImportingKamus && (
                          <div className="flex items-center text-xs font-medium text-slate-600 dark:text-slate-300 bg-surface-3 p-2.5 rounded-lg animate-pulse">
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Mengimport...
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button onClick={() => { setEditMasterData(null); setIsMasterModalOpen(true) }} size="sm" className="h-8 text-xs rounded-md bg-slate-800 hover:bg-slate-700 text-white">
                    <BookOpen className="h-3.5 w-3.5 mr-1" /> Tambah
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {filteredMaster.map(m => (
                  <div key={m.id} className="bg-surface border border-surface rounded-lg p-3 flex flex-col justify-between group hover:border-slate-300 transition-colors">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className={cn("text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border", kategoriColor(m.kategori))}>
                          {m.kategori}
                        </span>
                        <span className="text-base font-black text-slate-800 dark:text-slate-100">+{m.poin}</span>
                      </div>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-200 leading-snug">{m.nama_pelanggaran}</p>
                    </div>
                    <div className="flex justify-end gap-1 mt-2.5 pt-2 border-t border-surface-2 opacity-30 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditMasterData(m); setIsMasterModalOpen(true) }} className="p-1.5 rounded text-blue-600 hover:bg-blue-50">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleHapusMaster(m.id)} className="p-1.5 rounded text-rose-500 hover:bg-rose-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>

        {/* Modal: Form lapor/edit */}
        <FormModal
          isOpen={isFormModalOpen}
          onClose={() => { setIsFormModalOpen(false); setEditKasusData(null) }}
          editData={editKasusData}
          masterList={masterList}
        />

        {/* Modal: Detail kasus per siswa */}
        <DetailKasusModal
          group={detailGroup}
          lifetimePoin={lifetimePoin}
          sanksiList={sanksiList}
          isSuperAdmin={isSuperAdmin}
          currentUser={currentUser}
          isPending={isPending}
          onEdit={(k) => { setEditKasusData(k); setIsFormModalOpen(true) }}
          onHapus={handleHapusKasus}
          onClose={() => setDetailGroup(null)}
        />

        {/* Modal: Master kamus */}
        <MasterModal isOpen={isMasterModalOpen} onClose={() => setIsMasterModalOpen(false)} editData={editMasterData} />
      </div>
    </>
  )
}