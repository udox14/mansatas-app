'use client'

import { useState, useEffect } from 'react'
import Script from 'next/script'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Search, UserPlus, Trash2, ShieldAlert, Loader2, Mail, FileSpreadsheet,
  Download, KeyRound, Pencil, AlertCircle, Users, CheckCircle2,
  PlusCircle, X, Shield, SlidersHorizontal, Check, Camera, LayoutGrid, List
} from 'lucide-react'
import {
  tambahPegawai, hapusPegawai, importPegawaiMassal,
  editPegawai, resetPasswordPegawai, setUserRoles, uploadFotoPegawaiAction
} from '../actions'
import {
  getUserFeatureOverridesAction, setUserFeatureOverride
} from '@/app/dashboard/settings/fitur/actions'
import { MENU_ITEMS, getRoleLabel } from '@/config/menu'
import { cn } from '@/lib/utils'

type MasterRoleType = { value: string; label: string; is_custom: number }
type ProfilType = {
  id: string, nama_lengkap: string, role: string, roles: string[], email: string,
  avatar_url?: string | null,
}

const compressImage = async (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_SIZE = 800
        let width = img.width, height = img.height
        if (width > height && width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE }
        else if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE }
        canvas.width = width; canvas.height = height
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height)
        canvas.toBlob(blob => {
          if (blob) resolve(new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.jpg', { type: 'image/jpeg' }))
          else resolve(file)
        }, 'image/jpeg', 0.8)
      }
      img.onerror = reject
    }
    reader.onerror = reject
  })
}

const DEFAULT_ROLES: MasterRoleType[] = [
  { value: 'super_admin', label: 'Super Admin', is_custom: 0 },
  { value: 'admin_tu', label: 'Admin TU', is_custom: 0 },
  { value: 'kepsek', label: 'Kepala Madrasah', is_custom: 0 },
  { value: 'wakamad', label: 'Wakamad', is_custom: 0 },
  { value: 'guru', label: 'Guru', is_custom: 0 },
  { value: 'guru_bk', label: 'Guru BK', is_custom: 0 },
  { value: 'guru_piket', label: 'Guru Piket', is_custom: 0 },
  { value: 'wali_kelas', label: 'Wali Kelas', is_custom: 0 },
  { value: 'resepsionis', label: 'Resepsionis', is_custom: 0 },
  { value: 'guru_ppl', label: 'Guru PPL', is_custom: 0 },
]

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-rose-100 text-rose-700 border-rose-200',
  admin_tu: 'bg-violet-100 text-violet-700 border-violet-200',
  kepsek: 'bg-amber-100 text-amber-700 border-amber-200',
  wakamad: 'bg-blue-100 text-blue-700 border-blue-200',
  guru: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  guru_bk: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  guru_piket: 'bg-teal-100 text-teal-700 border-teal-200',
  wali_kelas: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  resepsionis: 'bg-pink-100 text-pink-700 border-pink-200',
  guru_ppl: 'bg-lime-100 text-lime-700 border-lime-200',
}

const initialState: any = { error: null, success: null }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full h-9 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg">
      {pending ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Membuat Akun...</> : 'Buat Akun Pegawai'}
    </Button>
  )
}

const getAvatarColor = (name: string) => {
  const colors = [
    'from-emerald-100 to-emerald-200 text-emerald-800 dark:text-emerald-400',
    'from-teal-100 to-teal-200 text-teal-800',
    'from-cyan-100 to-cyan-200 text-cyan-800',
    'from-blue-100 to-blue-200 text-blue-800',
    'from-amber-100 to-amber-200 text-amber-800',
    'from-indigo-100 to-indigo-200 text-indigo-800',
  ]
  return colors[(name.charCodeAt(0) || 0) % colors.length]
}

export function GuruClient({ initialData, masterRoles = DEFAULT_ROLES }: {
  initialData: ProfilType[], masterRoles?: MasterRoleType[]
}) {
  const [isPending, setIsPending] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingPegawai, setEditingPegawai] = useState<ProfilType | null>(null)
  const [state, formAction] = useActionState(tambahPegawai, initialState)
  const [isImporting, setIsImporting] = useState(false)
  const [importLogs, setImportLogs] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'table' | 'gallery'>('table')
  const [uploadingId, setUploadingId] = useState<string | null>(null)

  // Multi-role modal
  const [roleModalUser, setRoleModalUser] = useState<ProfilType | null>(null)
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [selectedPrimary, setSelectedPrimary] = useState('')
  // Override modal
  const [overrideModalUser, setOverrideModalUser] = useState<ProfilType | null>(null)
  const [overrides, setOverrides] = useState<{ grants: string[]; revokes: string[] }>({ grants: [], revokes: [] })
  const [overrideLoading, setOverrideLoading] = useState(false)

  useEffect(() => { setCurrentPage(1) }, [searchTerm, filterRole, itemsPerPage])
  useEffect(() => {
    if (state?.success) { const t = setTimeout(() => setIsAddOpen(false), 2000); return () => clearTimeout(t) }
  }, [state?.success])

  const filteredData = initialData.filter(p => {
    const matchSearch = p.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) || p.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchRole = filterRole === 'ALL' || p.roles.includes(filterRole) || p.role === filterRole
    return matchSearch && matchRole
  })

  const dynamicItemsPerPage = viewMode === 'gallery' ? 24 : itemsPerPage
  const totalPages = Math.ceil(filteredData.length / dynamicItemsPerPage)
  const paginatedData = filteredData.slice((currentPage - 1) * dynamicItemsPerPage, currentPage * dynamicItemsPerPage)

  const handleHapus = async (id: string, nama: string) => {
    if (!confirm(`PERMANEN!\nYakin hapus semua data dan akses login ${nama}?`)) return
    setIsPending(true)
    const res = await hapusPegawai(id)
    if (res?.error) alert(res.error)
    setIsPending(false)
  }

  const handleResetPassword = async (id: string, nama: string) => {
    if (!confirm(`Reset password ${nama} ke "mansatas2026"?`)) return
    setIsPending(true)
    const res = await resetPasswordPegawai(id)
    if (res?.error) alert(res.error)
    else alert(res.success)
    setIsPending(false)
  }

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsPending(true)
    const formData = new FormData(e.currentTarget)
    const res = await editPegawai(formData.get('id') as string, formData.get('nama_lengkap') as string, formData.get('email') as string)
    if (res?.error) alert(res.error)
    else { alert(res.success); setEditingPegawai(null) }
    setIsPending(false)
  }

  const handleUploadFoto = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingId(id)
    try {
      const compressedFile = await compressImage(file)
      const fd = new FormData()
      fd.append('foto', compressedFile)
      const res = await uploadFotoPegawaiAction(id, fd)
      if (res.error) alert(res.error)
    } catch { alert('Gagal memproses gambar.') }
    finally { setUploadingId(null); e.target.value = '' }
  }

  // Multi-role handlers
  const openRoleModal = (p: ProfilType) => {
    setRoleModalUser(p)
    setSelectedRoles([...p.roles])
    setSelectedPrimary(p.role)
  }

  const handleSaveRoles = async () => {
    if (!roleModalUser) return
    if (selectedRoles.length === 0) return alert('Pilih minimal 1 role.')
    setIsPending(true)
    const primary = selectedRoles.includes(selectedPrimary) ? selectedPrimary : selectedRoles[0]
    const res = await setUserRoles(roleModalUser.id, selectedRoles, primary)
    if (res?.error) alert(res.error)
    else { setRoleModalUser(null) }
    setIsPending(false)
  }

  const toggleRole = (role: string) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    )
  }

  // Override handlers
  const openOverrideModal = async (p: ProfilType) => {
    setOverrideModalUser(p)
    setOverrideLoading(true)
    try {
      const result = await getUserFeatureOverridesAction(p.id)
      setOverrides(result)
    } catch {
      setOverrides({ grants: [], revokes: [] })
    }
    setOverrideLoading(false)
  }

  const handleToggleOverride = async (featureId: string) => {
    if (!overrideModalUser) return
    const isGrant = overrides.grants.includes(featureId)
    const isRevoke = overrides.revokes.includes(featureId)
    let action: 'grant' | 'revoke' | 'remove'
    if (!isGrant && !isRevoke) action = 'grant'
    else if (isGrant) action = 'revoke'
    else action = 'remove'
    setOverrideLoading(true)
    const res = await setUserFeatureOverride(overrideModalUser.id, featureId, action)
    if (res?.error) alert(res.error)
    const result = await getUserFeatureOverridesAction(overrideModalUser.id)
    setOverrides(result)
    setOverrideLoading(false)
  }

  const handleDownloadTemplate = () => {
    const XLSX = (window as any).XLSX
    if (!XLSX) return alert('Library belum siap.')
    const ws = XLSX.utils.json_to_sheet([
      { NAMA_LENGKAP: 'Budi Santoso, S.Pd', EMAIL: 'budi@man1tasikmalaya.sch.id', JABATAN: 'guru' },
      { NAMA_LENGKAP: 'Siti Aminah, M.Pd', EMAIL: 'siti@man1tasikmalaya.sch.id', JABATAN: 'wakamad' },
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data_Pegawai')
    XLSX.writeFile(wb, 'Template_Import_Pegawai.xlsx')
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsImporting(true); setImportLogs([])
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const XLSX = (window as any).XLSX
        const workbook = XLSX.read(event.target?.result, { type: 'binary' })
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])
        const result = await importPegawaiMassal(jsonData) as any
        if (result.error) alert(result.error)
        else alert(result.success)
        if (result.logs?.length > 0) setImportLogs(result.logs)
      } catch { alert('Gagal membaca file Excel.') }
      finally { setIsImporting(false); e.target.value = '' }
    }
    reader.readAsBinaryString(file)
  }

  // ─── Role Badges Component ──────────────
  const RoleBadges = ({ roles, primaryRole }: { roles: string[]; primaryRole: string }) => (
    <div className="flex flex-wrap gap-1">
      {roles.map(role => (
        <span key={role} className={cn(
          'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold border',
          ROLE_COLORS[role] || 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800',
          role === primaryRole && 'ring-1 ring-offset-0.5 ring-slate-400'
        )}>
          {role === primaryRole && <span className="text-[7px]">★</span>}
          {getRoleLabel(role)}
        </span>
      ))}
    </div>
  )

  return (
    <>
      <Script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js" strategy="lazyOnload" />

      {/* MODAL EDIT PROFIL */}
      <Dialog open={!!editingPegawai} onOpenChange={open => !open && setEditingPegawai(null)}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader className="border-b pb-3"><DialogTitle className="text-sm font-semibold">Edit Profil Pegawai</DialogTitle></DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-3 pt-1">
            <input type="hidden" name="id" value={editingPegawai?.id} />
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300">Nama Lengkap</Label>
              <Input name="nama_lengkap" defaultValue={editingPegawai?.nama_lengkap} required className="h-9 text-sm rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300">Email (Login)</Label>
              <Input type="email" name="email" defaultValue={editingPegawai?.email} required className="h-9 text-sm rounded-lg" />
            </div>
            <Button type="submit" disabled={isPending} className="w-full h-9 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan Perubahan'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL MULTI-ROLE */}
      <Dialog open={!!roleModalUser} onOpenChange={open => !open && setRoleModalUser(null)}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-violet-500" /> Atur Role — {roleModalUser?.nama_lengkap}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 border border-surface">
              Centang role yang berlaku. User bisa memiliki banyak role sekaligus. Role dengan ★ adalah role utama.
            </p>
            <div className="space-y-1.5">
              {masterRoles.map((r: MasterRoleType) => {
                const isSelected = selectedRoles.includes(r.value)
                const isPrimary = selectedPrimary === r.value
                return (
                  <div key={r.value} className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all',
                    isSelected ? 'bg-emerald-50 dark:bg-emerald-950/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' : 'bg-surface border-surface hover:bg-surface-2'
                  )}>
                    <button type="button" onClick={() => toggleRole(r.value)} className={cn(
                      'h-4 w-4 rounded shrink-0 flex items-center justify-center transition-colors',
                      isSelected ? 'bg-emerald-500 text-white' : 'border-2 border-slate-300 dark:border-slate-700 dark:border-slate-600'
                    )}>
                      {isSelected && <Check className="h-2.5 w-2.5" />}
                    </button>
                    <span className={cn('text-xs font-medium flex-1', isSelected ? 'text-slate-800 dark:text-slate-200 dark:text-slate-100' : 'text-slate-400')}>
                      {r.label}
                    </span>
                    {isSelected && (
                      <button type="button" onClick={() => setSelectedPrimary(r.value)} className={cn(
                        'text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors',
                        isPrimary ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-slate-100 dark:bg-slate-800/80 dark:bg-slate-700 text-slate-400 hover:bg-amber-50 hover:text-amber-600'
                      )} title="Set sebagai role utama">
                        {isPrimary ? '★ Utama' : 'Set utama'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            <Button onClick={handleSaveRoles} disabled={isPending || selectedRoles.length === 0} className="w-full h-9 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Simpan ${selectedRoles.length} Role`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL OVERRIDE FITUR */}
      <Dialog open={!!overrideModalUser} onOpenChange={open => !open && setOverrideModalUser(null)}>
        <DialogContent className="sm:max-w-lg rounded-xl max-h-[80vh]">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-violet-500" /> Override Fitur — {overrideModalUser?.nama_lengkap}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-1">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 border border-surface">
              Klik berulang untuk mengubah status: <span className="font-semibold text-emerald-600">✓ Grant</span> → <span className="font-semibold text-rose-600">✗ Revoke</span> → <span className="text-slate-400">Normal</span>.
            </p>
            <ScrollArea className="h-[50vh]">
              <div className="space-y-1 pr-3">
                {overrideLoading ? (
                  <div className="flex items-center justify-center py-8 text-slate-400">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat...
                  </div>
                ) : MENU_ITEMS.map(feature => {
                  const Icon = feature.icon
                  const isGrant = overrides.grants.includes(feature.id)
                  const isRevoke = overrides.revokes.includes(feature.id)
                  return (
                    <button key={feature.id} onClick={() => handleToggleOverride(feature.id)} disabled={overrideLoading} className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all text-left',
                      isGrant ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800'
                        : isRevoke ? 'bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800'
                          : 'bg-surface border-surface hover:bg-surface-2'
                    )}>
                      <div className={cn('p-1 rounded shrink-0', isGrant ? 'bg-emerald-100 dark:bg-emerald-900/50' : isRevoke ? 'bg-rose-100' : 'bg-slate-100 dark:bg-slate-800/80 dark:bg-slate-800')}>
                        <Icon className={cn('h-3 w-3', isGrant ? 'text-emerald-600' : isRevoke ? 'text-rose-500' : 'text-slate-400')} />
                      </div>
                      <span className={cn('text-xs font-medium flex-1 truncate', isGrant ? 'text-emerald-700 dark:text-emerald-400' : isRevoke ? 'text-rose-600 line-through' : 'text-slate-600 dark:text-slate-400 dark:text-slate-300')}>
                        {feature.title}
                      </span>
                      {isGrant && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">+ Grant</span>}
                      {isRevoke && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 border border-rose-200">− Revoke</span>}
                      {!isGrant && !isRevoke && <span className="text-[9px] text-slate-400 px-1.5 py-0.5">Normal</span>}
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-3">
        {/* TOOLBAR */}
        <div className="bg-surface border border-surface rounded-lg p-3 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-0" style={{ minWidth: '140px' }}>
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
            <Input placeholder="Cari nama atau email..." className="pl-8 h-8 text-sm rounded-md" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1) }} />
          </div>

          {/* View toggle */}
          <div className="flex bg-surface-2 border border-surface p-0.5 rounded-lg shrink-0">
            <button onClick={() => { setViewMode('table'); setCurrentPage(1) }} className={`h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${viewMode === 'table' ? 'bg-surface text-slate-800 dark:text-slate-200 dark:text-slate-100 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-400'}`}>
              <List className="h-3.5 w-3.5" /><span className="hidden sm:inline">Tabel</span>
            </button>
            <button onClick={() => { setViewMode('gallery'); setCurrentPage(1) }} className={`h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${viewMode === 'gallery' ? 'bg-surface text-slate-800 dark:text-slate-200 dark:text-slate-100 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-400'}`}>
              <LayoutGrid className="h-3.5 w-3.5" /><span className="hidden sm:inline">Foto</span>
            </button>
          </div>

          <Select value={filterRole} onValueChange={val => { setFilterRole(val); setCurrentPage(1) }}>
            <SelectTrigger className="h-8 w-36 sm:w-40 text-xs rounded-md shrink-0"><SelectValue placeholder="Semua Role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Role</SelectItem>
              {masterRoles.map((r: MasterRoleType) => <SelectItem key={r.value} value={r.value}>{r.label}{r.is_custom ? ' ★' : ''}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="flex gap-2 ml-auto">
            {/* Import Dialog */}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs rounded-md">
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Import
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg rounded-xl">
                <DialogHeader className="border-b pb-3"><DialogTitle className="text-sm font-semibold">Import Akun Pegawai Massal</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center p-2.5 bg-surface-2 border border-surface rounded-lg">
                    <p className="text-xs text-slate-600 dark:text-slate-400 dark:text-slate-300 font-medium">Download format template:</p>
                    <Button size="sm" variant="outline" onClick={handleDownloadTemplate} className="h-7 text-xs gap-1"><Download className="h-3 w-3" />Template</Button>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 p-3 rounded-lg text-xs text-emerald-800 dark:text-emerald-400 space-y-1">
                    <p className="flex items-center gap-1.5 font-medium"><KeyRound className="h-3.5 w-3.5 text-emerald-600" />Password otomatis: <strong className="font-mono bg-surface px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">mansatas2026</strong></p>
                    <p>Kolom: <strong>NAMA_LENGKAP</strong>, <strong>EMAIL</strong>, <strong>JABATAN</strong></p>
                  </div>
                  <Input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} disabled={isImporting} className="h-9 text-xs rounded-lg cursor-pointer" />
                  {isImporting && <div className="flex items-center text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 p-2.5 rounded-lg animate-pulse"><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Sedang membuat akun...</div>}
                  {importLogs.length > 0 && (
                    <div className="border border-rose-200 rounded-lg overflow-hidden">
                      <div className="bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" />Log Gagal:</div>
                      <ScrollArea className="h-28 bg-surface p-3 text-xs font-mono text-rose-600">
                        {importLogs.map((log, i) => <div key={i} className="mb-0.5">{log}</div>)}
                      </ScrollArea>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Tambah Manual */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 text-xs rounded-md bg-emerald-600 hover:bg-emerald-700 text-white">
                  <UserPlus className="h-3.5 w-3.5 mr-1" /> Tambah
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md rounded-xl">
                <DialogHeader className="border-b pb-3"><DialogTitle className="text-sm font-semibold">Buat Akun Pegawai Baru</DialogTitle></DialogHeader>
                <form action={formAction} className="space-y-3 pt-2">
                  {state?.error && <div className="p-2.5 text-xs text-rose-600 bg-rose-50 rounded-lg border border-rose-200 flex gap-1.5"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{state.error}</div>}
                  {state?.success && <div className="p-2.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg border border-emerald-200 dark:border-emerald-800 flex gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 shrink-0" />{state.success}</div>}
                  <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 p-2.5 rounded-lg flex gap-2 text-xs text-emerald-800 dark:text-emerald-400">
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-emerald-600 mt-0.5" />
                    Password default: <strong className="font-mono bg-surface px-1 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">mansatas2026</strong>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300">Nama Lengkap <span className="text-rose-500">*</span></Label>
                    <Input name="nama_lengkap" required className="h-9 text-sm rounded-lg" placeholder="Contoh: Budi Santoso, S.Pd" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300">Email Resmi <span className="text-rose-500">*</span></Label>
                    <div className="relative">
                      <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                      <Input name="email" type="email" required className="pl-8 h-9 text-sm rounded-lg" placeholder="guru@man1tasikmalaya.sch.id" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300">Jabatan <span className="text-rose-500">*</span></Label>
                    <Select name="role" defaultValue="guru">
                      <SelectTrigger className="h-9 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>{masterRoles.map((r: MasterRoleType) => <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <SubmitButton />
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {viewMode === 'gallery' ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
            {paginatedData.length === 0 ? (
              <div className="col-span-full py-12 text-center text-sm text-slate-400 bg-surface rounded-lg border border-surface">
                Tidak ada pegawai ditemukan.
              </div>
            ) : paginatedData.map(p => (
              <div key={p.id} className="bg-surface rounded-lg border border-surface overflow-hidden group flex flex-col">
                <div className="relative aspect-[3/4] bg-surface-3">
                  {uploadingId === p.id ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-slate-900/70 z-10">
                      <Loader2 className="h-5 w-5 text-emerald-600 animate-spin" />
                    </div>
                  ) : p.avatar_url ? (
                    <img src={p.avatar_url} alt={p.nama_lengkap} className="w-full h-full object-cover" />
                  ) : (
                    <div className={cn("w-full h-full bg-gradient-to-br flex items-center justify-center text-3xl font-black text-white/60", getAvatarColor(p.nama_lengkap))}>
                      {p.nama_lengkap.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <label className="absolute bottom-1 right-1 bg-white dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 p-1 rounded shadow cursor-pointer z-10 hover:bg-surface transition-colors">
                    <Camera className="w-3 h-3" />
                    <input type="file" className="hidden" accept="image/*" capture="environment" onChange={e => handleUploadFoto(p.id, e)} />
                  </label>
                </div>
                <div className="p-1.5 text-center flex-1">
                  <p className="text-[10px] font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100 leading-tight line-clamp-2">{p.nama_lengkap}</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">{getRoleLabel(p.role)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* MOBILE CARDS */}
            <div className="block md:hidden space-y-2">
              {paginatedData.length === 0 ? (
                <div className="bg-surface py-10 rounded-lg border border-surface text-center">
                  <Users className="h-7 w-7 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Tidak ada data pegawai.</p>
                </div>
              ) : paginatedData.map(p => (
                <div key={p.id} className="bg-surface border border-surface rounded-lg p-3">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={cn("h-9 w-9 rounded-full shrink-0 flex items-center justify-center text-sm font-bold overflow-hidden bg-slate-100 dark:bg-slate-800/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 dark:border-slate-700", getAvatarColor(p.nama_lengkap))}>
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt={p.nama_lengkap} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br flex items-center justify-center text-white/90">
                          {p.nama_lengkap.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100 truncate leading-tight">{p.nama_lengkap}</p>
                      <p className="text-[10px] text-slate-400 truncate flex items-center gap-0.5 mt-0.5"><Mail className="h-2.5 w-2.5" />{p.email}</p>
                    </div>
                  </div>
                  <div className="mb-2">
                    <RoleBadges roles={p.roles} primaryRole={p.role} />
                  </div>
                  <div className="flex gap-1.5 justify-end">
                    <button onClick={() => openRoleModal(p)} disabled={isPending} className="p-1.5 rounded text-violet-600 hover:bg-violet-50" title="Atur Role">
                      <Shield className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => openOverrideModal(p)} disabled={isPending} className="p-1.5 rounded text-blue-600 hover:bg-blue-50" title="Override Fitur">
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleResetPassword(p.id, p.nama_lengkap)} disabled={isPending} className="p-1.5 rounded text-amber-600 hover:bg-amber-50" title="Reset Password">
                      <KeyRound className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setEditingPegawai(p)} disabled={isPending} className="p-1.5 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50" title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleHapus(p.id, p.nama_lengkap)} disabled={isPending} className="p-1.5 rounded text-rose-500 hover:bg-rose-50" title="Hapus">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* DESKTOP TABLE */}
            <div className="hidden md:block bg-surface rounded-lg border border-surface overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-surface-2 hover:bg-surface-2">
                    <TableHead className="h-9 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400">Profil Pegawai</TableHead>
                    <TableHead className="h-9 text-xs font-semibold text-slate-500 dark:text-slate-400 w-52">Role</TableHead>
                    <TableHead className="h-9 text-xs font-semibold text-slate-500 dark:text-slate-400 text-right px-4 w-36">Kelola</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center">
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                          <Users className="h-7 w-7 text-slate-300 dark:text-slate-600" />
                          <p className="text-sm">Tidak ada data pegawai.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : paginatedData.map(p => (
                    <TableRow key={p.id} className="hover:bg-emerald-50 dark:hover:bg-emerald-950/50/20 border-surface-2 group">
                      <TableCell className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className={cn("h-8 w-8 rounded-full shrink-0 flex items-center justify-center text-sm font-bold overflow-hidden bg-slate-100 dark:bg-slate-800/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 dark:border-slate-700", getAvatarColor(p.nama_lengkap))}>
                            {p.avatar_url ? (
                              <img src={p.avatar_url} alt={p.nama_lengkap} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br flex items-center justify-center text-white/90">
                                {p.nama_lengkap.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors leading-tight">{p.nama_lengkap}</p>
                            <p className="text-[11px] text-slate-400 flex items-center gap-0.5 mt-0.5"><Mail className="h-2.5 w-2.5" />{p.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 min-w-0">
                            <RoleBadges roles={p.roles} primaryRole={p.role} />
                          </div>
                          <button onClick={() => openRoleModal(p)} className="p-1 rounded text-violet-500 hover:bg-violet-50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" title="Atur Role">
                            <Pencil className="h-3 w-3" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openOverrideModal(p)} disabled={isPending} className="p-1.5 rounded text-blue-600 hover:bg-blue-50" title="Override Fitur">
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleResetPassword(p.id, p.nama_lengkap)} disabled={isPending} className="p-1.5 rounded text-amber-600 hover:bg-amber-50" title="Reset Password">
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setEditingPegawai(p)} disabled={isPending} className="p-1.5 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50" title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleHapus(p.id, p.nama_lengkap)} disabled={isPending} className="p-1.5 rounded text-rose-500 hover:bg-rose-50" title="Hapus">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* PAGINATION */}
              <div className="flex items-center justify-between px-4 py-2 border-t border-surface-2 bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="hidden sm:inline">Tampilkan</span>
                  <Select value={itemsPerPage.toString()} onValueChange={v => { setItemsPerPage(Number(v)); setCurrentPage(1) }}>
                    <SelectTrigger className="h-7 w-16 text-xs rounded border-surface"><SelectValue /></SelectTrigger>
                    <SelectContent>{[10, 20, 50].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}</SelectContent>
                  </Select>
                  <span><strong className="text-slate-700 dark:text-slate-300 dark:text-slate-200">{filteredData.length}</strong> pegawai</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-7 px-2.5 text-xs rounded">&#8592;</Button>
                  <span className="text-xs font-medium px-2">{currentPage}/{totalPages || 1}</span>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="h-7 px-2.5 text-xs rounded">&#8594;</Button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Mobile pagination */}
        <div className="flex items-center justify-between md:hidden bg-surface border border-surface rounded-lg px-3 py-2">
          <span className="text-xs text-slate-500 dark:text-slate-400"><strong>{filteredData.length}</strong> pegawai</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-7 px-2.5 text-xs rounded">&#8592;</Button>
            <span className="text-xs font-medium px-2">{currentPage}/{totalPages || 1}</span>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="h-7 px-2.5 text-xs rounded">&#8594;</Button>
          </div>
        </div>
      </div>
    </>
  )
}
