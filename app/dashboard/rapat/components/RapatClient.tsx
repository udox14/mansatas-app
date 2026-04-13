'use client'

import { useState, useActionState, useRef, useCallback, useTransition, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import {
  Calendar, Clock, MapPin, Users, CheckCircle2, XCircle, AlertCircle,
  Plus, Send, Loader2, Search, Printer, Trash2, RotateCcw, Eye,
  ChevronDown, ChevronUp, Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  buatUndanganRapat, konfirmasiKehadiran,
  getPesertaRapat, kirimUlangUndangan, hapusUndanganExpired,
} from '../actions'
import { cn } from '@/lib/utils'
import { useReactToPrint } from 'react-to-print'
import { todayWIB } from '@/lib/time'

// ============================================================
// Types
// ============================================================
type UserItem = { id: string; nama_lengkap: string; role: string; all_roles: string[] }
type RoleOption = { value: string; label: string }

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin', admin_tu: 'Admin TU', kepsek: 'Kepala Madrasah',
  wakamad: 'Wakamad', guru: 'Guru', guru_bk: 'Guru BK', guru_piket: 'Guru Piket',
  wali_kelas: 'Wali Kelas', resepsionis: 'Resepsionis', guru_ppl: 'Guru PPL', guru_tahfidz: 'Guru Tahfidz',
}
const getRoleLabel = (r: string) => ROLE_LABEL[r] || r

const STATUS_BADGE: Record<string, string> = {
  BELUM_RESPOND: 'bg-amber-50 text-amber-700 border-amber-200',
  HADIR: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  TIDAK_HADIR: 'bg-rose-50 text-rose-700 border-rose-200',
}
const STATUS_LABEL: Record<string, string> = {
  BELUM_RESPOND: 'Pending', HADIR: 'Hadir', TIDAK_HADIR: 'Tidak Hadir',
}

function SubmitBuatRapatBtn() {
  const { pending } = useFormStatus()
  return (
    <Button disabled={pending} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg h-10">
      {pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
      Buat & Kirim Undangan
    </Button>
  )
}

// ============================================================
// CHECKBOX PESERTA — scrollable list + search
// ============================================================
function CheckboxPeserta({
  allUsers, roles, selectedIds, setSelectedIds,
}: {
  allUsers: UserItem[]
  roles: RoleOption[]
  selectedIds: Set<string>
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>
}) {
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('_all')

  const filtered = allUsers.filter(u => {
    const matchRole = filterRole === '_all' || u.all_roles.includes(filterRole)
    const q = search.toLowerCase()
    const matchQ = !q || u.nama_lengkap.toLowerCase().includes(q) || u.role.toLowerCase().includes(q)
    return matchRole && matchQ
  })

  const allFilteredIds = filtered.map(u => u.id)
  const allChecked = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.has(id))
  const someChecked = allFilteredIds.some(id => selectedIds.has(id))

  const toggleAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allChecked) { allFilteredIds.forEach(id => next.delete(id)) }
      else { allFilteredIds.forEach(id => next.add(id)) }
      return next
    })
  }

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-2">
      {/* Search + Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama..."
            className="h-8 pl-8 text-xs rounded-lg"
          />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="h-8 w-36 text-xs rounded-lg">
            <Filter className="h-3 w-3 mr-1.5 text-slate-400" />
            <SelectValue placeholder="Semua Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all" className="text-xs">Semua Role</SelectItem>
            {roles.map(r => (
              <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Select All */}
      <div className="flex items-center justify-between px-1">
        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-600">
          <input
            type="checkbox"
            checked={allChecked}
            ref={el => { if (el) el.indeterminate = !allChecked && someChecked }}
            onChange={toggleAll}
            className="rounded"
          />
          Pilih Semua ({filtered.length} tampil dari {allUsers.length})
        </label>
        <span className="text-[10px] text-slate-400 font-medium">{selectedIds.size} dipilih</span>
      </div>

      {/* Scrollable List */}
      <div className="border border-slate-200 rounded-lg overflow-y-auto max-h-52 divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">Tidak ada pengguna ditemukan.</div>
        ) : (
          filtered.map(u => (
            <label key={u.id} className={cn(
              'flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors',
              selectedIds.has(u.id) && 'bg-blue-50/60'
            )}>
              <input
                type="checkbox"
                checked={selectedIds.has(u.id)}
                onChange={() => toggle(u.id)}
                className="rounded shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-800 truncate">{u.nama_lengkap}</p>
                <p className="text-[10px] text-slate-400">{getRoleLabel(u.role)}</p>
              </div>
            </label>
          ))
        )}
      </div>
    </div>
  )
}

// ============================================================
// DIALOG LIHAT PESERTA
// ============================================================
function DialogPeserta({ rapat }: { rapat: any }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await getPesertaRapat(rapat.id)
    if (!res.error) setData(res.data)
    setLoading(false)
  }

  const handleOpen = (o: boolean) => {
    setOpen(o)
    if (o) load()
  }

  const handleKirimUlang = async (pesertaId: string, nama: string) => {
    setSendingId(pesertaId)
    const res = await kirimUlangUndangan(rapat.id, pesertaId, nama)
    setPesan({ ok: !res.error, teks: res.success || res.error || '' })
    setSendingId(null)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 rounded-lg">
          <Eye className="h-3.5 w-3.5" /> Lihat Peserta
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm">Peserta — {rapat.agenda}</DialogTitle>
        </DialogHeader>
        {pesan && (
          <div className={cn('text-xs px-3 py-2 rounded-lg border', pesan.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700')}>
            {pesan.teks}
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 -mx-6 px-6 divide-y divide-slate-100">
            {data.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">Tidak ada peserta.</p>
            ) : data.map((p) => (
              <div key={p.peserta_id} className="flex items-center gap-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-800 truncate">{p.nama_lengkap}</p>
                  <p className="text-[10px] text-slate-400">{getRoleLabel(p.role)}</p>
                  {p.alasan_tidak_hadir && (
                    <p className="text-[10px] text-rose-500 mt-0.5 italic">"{p.alasan_tidak_hadir}"</p>
                  )}
                </div>
                <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase shrink-0', STATUS_BADGE[p.status_kehadiran])}>
                  {STATUS_LABEL[p.status_kehadiran]}
                </span>
                {p.status_kehadiran === 'BELUM_RESPOND' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={sendingId === p.peserta_id}
                    onClick={() => handleKirimUlang(p.peserta_id, p.nama_lengkap)}
                    className="h-7 text-[10px] px-2 text-blue-600 hover:bg-blue-50 shrink-0"
                    title="Kirim ulang undangan"
                  >
                    {sendingId === p.peserta_id
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <><RotateCcw className="h-3 w-3 mr-1" /> Kirim Ulang</>
                    }
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// DIALOG CETAK ABSENSI RAPAT
// ============================================================
function DialogCetak({ rapat }: { rapat: any }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Opsi cetak
  const [showStatus, setShowStatus] = useState(false)
  const [showTtd, setShowTtd] = useState(true)
  const [ttdKiri, setTtdKiri] = useState('Kepala Madrasah')
  const [namaKiri, setNamaKiri] = useState('')
  const [ttdKanan, setTtdKanan] = useState('Notulen')
  const [namaKanan, setNamaKanan] = useState('')

  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({ contentRef: printRef })

  const load = async () => {
    setLoading(true)
    const res = await getPesertaRapat(rapat.id)
    if (!res.error) setData(res.data)
    setLoading(false)
  }

  const handleOpen = (o: boolean) => {
    setOpen(o)
    if (o && data.length === 0) load()
  }

  const colCount = 3 + (showStatus ? 1 : 0) + (showTtd ? 1 : 0)

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 rounded-lg">
          <Printer className="h-3.5 w-3.5" /> Cetak Absensi
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm">Cetak Absensi — {rapat.agenda}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1">
          {/* Opsi */}
          <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 space-y-3">
            <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Opsi Tampilan</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                <input type="checkbox" checked={showStatus} onChange={e => setShowStatus(e.target.checked)} className="rounded" />
                Tampilkan Kolom Status
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                <input type="checkbox" checked={showTtd} onChange={e => setShowTtd(e.target.checked)} className="rounded" />
                Tampilkan Kolom Tanda Tangan
              </label>
            </div>

            {showTtd && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-500">Jabatan Kiri</Label>
                  <Input value={ttdKiri} onChange={e => setTtdKiri(e.target.value)} className="h-7 text-xs rounded" />
                  <Label className="text-[10px] text-slate-500">Nama Kiri</Label>
                  <Input value={namaKiri} onChange={e => setNamaKiri(e.target.value)} placeholder="(kosongkan jika tidak perlu)" className="h-7 text-xs rounded" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-500">Jabatan Kanan</Label>
                  <Input value={ttdKanan} onChange={e => setTtdKanan(e.target.value)} className="h-7 text-xs rounded" />
                  <Label className="text-[10px] text-slate-500">Nama Kanan</Label>
                  <Input value={namaKanan} onChange={e => setNamaKanan(e.target.value)} placeholder="(kosongkan jika tidak perlu)" className="h-7 text-xs rounded" />
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <Button
              onClick={() => handlePrint()}
              disabled={data.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              <Printer className="h-4 w-4" /> Cetak Sekarang ({data.length} peserta)
            </Button>
          )}
        </div>

        {/* ===== HIDDEN PRINT AREA ===== */}
        <div className="hidden">
          <style>{`
            @media print {
              @page {
                size: 215mm 330mm;
                margin: 20mm;
              }
              body { -webkit-print-color-adjust: exact; }
            }
          `}</style>
          <div ref={printRef} style={{ fontFamily: 'Times New Roman, serif', fontSize: '11pt', color: '#000', background: '#fff' }}>
            {/* Kop Surat — mentok kiri kanan */}
            <img
              src="/kopsurat.png"
              alt="Kop Surat"
              style={{
                display: 'block',
                width: '100%',
                marginBottom: '5px'
              }}
            />

            {/* Judul */}
            <div style={{ textAlign: 'center', marginTop: '10px', marginBottom: '8px' }}>
              <h2 style={{ fontSize: '12pt', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                Daftar Hadir Rapat
              </h2>
              <p style={{ fontSize: '11pt', fontWeight: 'bold', margin: '3px 0 0' }}>{rapat.agenda}</p>
            </div>

            {/* Info Rapat */}
            <table style={{ fontSize: '10pt', marginBottom: '10px', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ paddingRight: '8px', paddingBottom: '1px', width: '60px' }}>Tanggal</td>
                  <td style={{ paddingBottom: '1px' }}>: {rapat.tanggalFmt}</td>
                </tr>
                <tr>
                  <td style={{ paddingBottom: '1px' }}>Waktu</td>
                  <td style={{ paddingBottom: '1px' }}>: {rapat.waktu} WIB</td>
                </tr>
                <tr>
                  <td>Tempat</td>
                  <td>: {rapat.tempat}</td>
                </tr>
              </tbody>
            </table>

            {/* Tabel Peserta */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt', marginBottom: '16px' }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid black', padding: '3px 6px', width: '24px', textAlign: 'center' }}>No</th>
                  <th style={{ border: '1px solid black', padding: '3px 6px', textAlign: 'left' }}>Nama</th>
                  <th style={{ border: '1px solid black', padding: '3px 6px', textAlign: 'left', width: '130px' }}>Jabatan/Role</th>
                  {showStatus && <th style={{ border: '1px solid black', padding: '3px 6px', textAlign: 'center', width: '70px' }}>Status</th>}
                  {showTtd && <th style={{ border: '1px solid black', padding: '3px 6px', textAlign: 'center', width: '110px' }}>Tanda Tangan</th>}
                </tr>
              </thead>
              <tbody>
                {data.map((p, i) => (
                  <tr key={p.peserta_id}>
                    <td style={{ border: '1px solid black', padding: '3px 6px', textAlign: 'center' }}>{i + 1}</td>
                    <td style={{ border: '1px solid black', padding: '3px 6px' }}>{p.nama_lengkap}</td>
                    <td style={{ border: '1px solid black', padding: '3px 6px' }}>{getRoleLabel(p.role)}</td>
                    {showStatus && (
                      <td style={{ border: '1px solid black', padding: '3px 6px', textAlign: 'center' }}>
                        {STATUS_LABEL[p.status_kehadiran] || p.status_kehadiran}
                      </td>
                    )}
                    {showTtd && <td style={{ border: '1px solid black', padding: '3px 6px', height: '28px' }}></td>}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Tanda Tangan Bawah */}
            {showTtd && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                {/* Kiri */}
                <div style={{ textAlign: 'center', minWidth: '170px' }}>
                  <p style={{ margin: '0 0 1px' }}>Mengetahui,</p>
                  <p style={{ fontWeight: 'bold', margin: '0 0 44px' }}>{ttdKiri}</p>
                  <p style={{ borderTop: '1px solid black', paddingTop: '2px', margin: 0 }}>
                    {namaKiri || '(____________________________)'}
                  </p>
                </div>
                {/* Kanan */}
                <div style={{ textAlign: 'center', minWidth: '170px' }}>
                  <p style={{ margin: '0 0 1px' }}>
                    Tasikmalaya, {new Date().toLocaleDateString('id-ID', {
                      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta'
                    })}
                  </p>
                  <p style={{ fontWeight: 'bold', margin: '0 0 44px' }}>{ttdKanan}</p>
                  <p style={{ borderTop: '1px solid black', paddingTop: '2px', margin: 0 }}>
                    {namaKanan || '(____________________________)'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// MAIN CLIENT COMPONENT
// ============================================================
export function RapatClient({
  undanganMasuk, rapatDibuat, canCreate, roles = [], allUsers = [],
}: {
  undanganMasuk: any[]; rapatDibuat: any[]; canCreate: boolean;
  roles: RoleOption[]; allUsers: UserItem[]
}) {
  const [activeTab, setActiveTab] = useState('masuk')
  const [createState, createAction] = useActionState(buatUndanganRapat, { error: '', success: '' } as { error?: string; success?: string })
  const [openCreateDialog, setOpenCreateDialog] = useState(false)

  // Auto-close dialog ketika buat rapat berhasil
  useEffect(() => {
    if (createState?.success) setOpenCreateDialog(false)
  }, [createState?.success])

  // Checkbox state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [targetType, setTargetType] = useState('all')
  const [targetRole, setTargetRole] = useState(roles[0]?.value || '')

  // Sinkronisasi targetType → selectedIds
  const handleTargetTypeChange = useCallback((v: string) => {
    setTargetType(v)
    if (v === 'all') {
      setSelectedIds(new Set(allUsers.map(u => u.id)))
    } else {
      setSelectedIds(new Set())
    }
  }, [allUsers])

  const handleTargetRoleChange = useCallback((v: string) => {
    setTargetRole(v)
    setSelectedIds(new Set(allUsers.filter(u => u.all_roles.includes(v)).map(u => u.id)))
  }, [allUsers])

  // Init: kalau all, langsung centang semua
  const handleOpenCreate = () => {
    if (targetType === 'all') setSelectedIds(new Set(allUsers.map(u => u.id)))
    setOpenCreateDialog(true)
  }

  // Konfirmasi kehadiran
  const [isConfirming, setIsConfirming] = useState<string | null>(null)
  const handleKonfirmasi = async (pesertaId: string, status: 'HADIR' | 'TIDAK_HADIR', alasan: string = '') => {
    setIsConfirming(pesertaId)
    try {
      const res = await konfirmasiKehadiran(pesertaId, status, alasan)
      if (res.error) alert(res.error)
    } finally {
      setIsConfirming(null)
    }
  }

  // Hapus expired
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const handleHapus = (rapatId: string, agenda: string) => {
    if (!confirm(`Hapus undangan "${agenda}" yang sudah expired? Tindakan ini tidak dapat dibatalkan.`)) return
    setDeletingId(rapatId)
    startTransition(async () => {
      const res = await hapusUndanganExpired(rapatId)
      if (res.error) alert(res.error)
      setDeletingId(null)
    })
  }

  const todayStr = todayWIB()

  return (
    <div className="space-y-4">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
          <TabsList className="bg-surface border border-surface p-0.5 h-auto rounded-lg grid grid-cols-2 w-fit">
            <TabsTrigger value="masuk" className="py-1.5 px-4 rounded-md data-[state=active]:bg-slate-900 data-[state=active]:text-white text-xs font-medium">
              Undangan Masuk ({undanganMasuk.filter(u => u.status_kehadiran === 'BELUM_RESPOND').length})
            </TabsTrigger>
            {canCreate && (
              <TabsTrigger value="dibuat" className="py-1.5 px-4 rounded-md data-[state=active]:bg-slate-900 data-[state=active]:text-white text-xs font-medium">
                Undangan Saya ({rapatDibuat.length})
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>

        {canCreate && activeTab === 'dibuat' && (
          <Dialog open={openCreateDialog} onOpenChange={setOpenCreateDialog}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenCreate} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 h-9 text-sm rounded-lg">
                <Plus className="h-4 w-4" /> Buat Rapat Baru
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Buat Undangan Rapat</DialogTitle>
              </DialogHeader>
              <form
                action={(fd) => {
                  fd.set('targetUserIds', JSON.stringify([...selectedIds]))
                  return createAction(fd)
                }}
                className="space-y-3 overflow-y-auto flex-1 pr-1"
              >
                {(createState as any)?.error && (
                  <div className="p-3 text-sm text-rose-600 bg-rose-50 rounded-lg border border-rose-100 flex gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {(createState as any).error}
                  </div>
                )}
                {(createState as any)?.success && (
                  <div className="p-3 text-sm text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-100 flex gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> {(createState as any).success}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Agenda Rapat</Label>
                  <Input name="agenda" required placeholder="Cth: Rapat Pleno Kelulusan" className="h-9 text-sm rounded-lg" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Tanggal</Label>
                    <Input name="tanggal" type="date" required defaultValue={todayWIB()} className="h-9 text-sm rounded-lg" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Waktu</Label>
                    <Input name="waktu" type="time" required defaultValue="09:00" className="h-9 text-sm rounded-lg" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Tempat</Label>
                  <Input name="tempat" required placeholder="Cth: Ruang Guru" className="h-9 text-sm rounded-lg" />
                </div>

                {/* Target Type + Role */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Target</Label>
                    <Select value={targetType} onValueChange={handleTargetTypeChange}>
                      <SelectTrigger className="h-9 text-sm rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Pengguna</SelectItem>
                        <SelectItem value="role">Berdasarkan Role</SelectItem>
                        <SelectItem value="custom">Pilih Manual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {targetType === 'role' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Role</Label>
                      <Select value={targetRole} onValueChange={handleTargetRoleChange}>
                        <SelectTrigger className="h-9 text-sm rounded-lg"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {roles.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Checkbox Peserta */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    Daftar Peserta
                    <span className="text-slate-400 font-normal">({selectedIds.size} dipilih)</span>
                  </Label>
                  <CheckboxPeserta
                    allUsers={allUsers}
                    roles={roles}
                    selectedIds={selectedIds}
                    setSelectedIds={setSelectedIds}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Catatan (Opsional)</Label>
                  <Textarea name="catatan" placeholder="Cth: Membawa buku nilai" className="h-18 resize-none text-sm rounded-lg" />
                </div>

                <SubmitBuatRapatBtn />
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* ===== TAB: UNDANGAN MASUK ===== */}
      {activeTab === 'masuk' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {undanganMasuk.length === 0 ? (
            <div className="col-span-full py-12 text-center text-sm text-slate-400 dark:text-slate-500 bg-surface rounded-lg border border-surface">
              Tidak ada undangan rapat saat ini.
            </div>
          ) : (
            undanganMasuk.map((u, i) => (
              <div key={i} className="bg-surface border border-surface rounded-xl overflow-hidden flex flex-col">
                <div className="p-4 space-y-3 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 leading-tight truncate">{u.agenda}</h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">Pengundang: {u.pengundang_nama}</p>
                    </div>
                    <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full border uppercase shrink-0', STATUS_BADGE[u.status_kehadiran])}>
                      {STATUS_LABEL[u.status_kehadiran]}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-slate-400" /> {u.tanggalFmt}</div>
                    <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-slate-400" /> {u.waktu} WIB</div>
                    <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-slate-400" /> {u.tempat}</div>
                  </div>

                  {u.catatan && (
                    <div className="p-2.5 bg-surface-2 text-slate-700 dark:text-slate-300 text-[11px] rounded-lg border border-surface">
                      <strong className="text-slate-900 dark:text-slate-100 block mb-0.5 font-bold uppercase text-[9px]">Catatan:</strong>
                      {u.catatan}
                    </div>
                  )}
                </div>

                <div className="p-3 bg-surface-2/50 border-t border-surface flex items-center gap-2">
                  {u.status_kehadiran === 'BELUM_RESPOND' ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleKonfirmasi(u.peserta_id, 'HADIR')}
                        disabled={isConfirming === u.peserta_id}
                        className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                      >
                        {isConfirming === u.peserta_id ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <CheckCircle2 className="h-3 w-3 mr-2" />} Hadir
                      </Button>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            disabled={isConfirming === u.peserta_id}
                            className="flex-1 h-8 text-xs bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded-lg"
                          >
                            <XCircle className="h-3 w-3 mr-2" /> Berhalangan
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-sm">
                          <DialogHeader><DialogTitle>Alasan Berhalangan</DialogTitle></DialogHeader>
                          <div className="space-y-3 pt-3">
                            <Textarea id={`alasan-${u.peserta_id}`} placeholder="Tuliskan alasannya..." className="min-h-[100px] text-sm rounded-lg" />
                            <Button className="w-full h-10 bg-blue-600 rounded-lg" onClick={() => {
                              const t = document.getElementById(`alasan-${u.peserta_id}`) as HTMLTextAreaElement
                              handleKonfirmasi(u.peserta_id, 'TIDAK_HADIR', t?.value)
                            }}>Simpan Konfirmasi</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </>
                  ) : (
                    <div className={cn('w-full py-1.5 px-3 rounded-lg border text-center text-[11px] font-bold flex items-center justify-center gap-2', STATUS_BADGE[u.status_kehadiran])}>
                      {u.status_kehadiran === 'HADIR' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                      {u.status_kehadiran === 'HADIR' ? 'KONFIRMASI: ANDA HADIR' : `BERHALANGAN: ${u.alasan_tidak_hadir || '-'}`}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ===== TAB: UNDANGAN SAYA ===== */}
      {activeTab === 'dibuat' && canCreate && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rapatDibuat.length === 0 ? (
            <div className="col-span-full py-12 text-center text-sm text-slate-400 dark:text-slate-500 bg-surface rounded-lg border border-surface">
              Anda belum membuat undangan rapat apapun.
            </div>
          ) : (
            rapatDibuat.map((r) => {
              const isExpired = r.tanggal < todayStr
              return (
                <div key={r.id} className="bg-surface border border-surface rounded-xl p-4 flex flex-col gap-3">
                  {/* Header */}
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 leading-tight">{r.agenda}</h3>
                        {isExpired && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-slate-100 text-slate-500 border-slate-200 uppercase">
                            Expired
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 space-y-0.5">
                        <span className="flex items-center gap-1.5 text-xs text-slate-500"><Calendar className="h-3.5 w-3.5" /> {r.tanggalFmt}</span>
                        <span className="flex items-center gap-1.5 text-xs text-slate-500"><Clock className="h-3.5 w-3.5" /> {r.waktu} WIB</span>
                        <span className="flex items-center gap-1.5 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" /> {r.tempat}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 bg-surface-2 border border-surface rounded-lg p-2 min-w-[60px]">
                      <div className="text-[9px] font-bold text-slate-400 uppercase">Diundang</div>
                      <div className="text-xl font-black text-slate-700 dark:text-slate-200 leading-none mt-0.5">{r.total_peserta}</div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-surface">
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2 text-center border border-emerald-100 dark:border-emerald-800">
                      <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">{r.total_hadir}</div>
                      <div className="text-[9px] font-bold text-emerald-800 dark:text-emerald-600 uppercase">Hadir</div>
                    </div>
                    <div className="bg-rose-50 dark:bg-rose-900/20 rounded-lg p-2 text-center border border-rose-100 dark:border-rose-800">
                      <div className="text-lg font-black text-rose-600 dark:text-rose-400">{r.total_tidak_hadir}</div>
                      <div className="text-[9px] font-bold text-rose-800 dark:text-rose-600 uppercase">Absen</div>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 text-center border border-amber-100 dark:border-amber-800">
                      <div className="text-lg font-black text-amber-600 dark:text-amber-400">{r.total_belum}</div>
                      <div className="text-[9px] font-bold text-amber-800 dark:text-amber-600 uppercase">Pending</div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <DialogPeserta rapat={r} />
                    <DialogCetak rapat={r} />
                    {isExpired && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={deletingId === r.id}
                        onClick={() => handleHapus(r.id, r.agenda)}
                        className="h-8 text-xs gap-1.5 rounded-lg text-rose-600 hover:bg-rose-50 ml-auto"
                      >
                        {deletingId === r.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />
                        }
                        Hapus Expired
                      </Button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
