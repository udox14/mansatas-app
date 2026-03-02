'use client'

import { useState, useEffect } from 'react'
import Script from 'next/script'
import { useFormState, useFormStatus } from 'react-dom'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, UserPlus, Trash2, ShieldAlert, Loader2, Mail, FileSpreadsheet, Download, KeyRound, Pencil, AlertCircle, Users, CheckCircle2 } from 'lucide-react'
import { tambahPegawai, ubahRolePegawai, hapusPegawai, importPegawaiMassal, editPegawai, resetPasswordPegawai } from '../actions'

type ProfilType = { id: string, nama_lengkap: string, role: string, email: string }

const ROLES = [
  { value: 'guru', label: 'Guru Mata Pelajaran' },
  { value: 'guru_bk', label: 'Guru BK' },
  { value: 'guru_piket', label: 'Guru Piket' },
  { value: 'wakamad', label: 'Wakil Kepala Madrasah' },
  { value: 'kepsek', label: 'Kepala Madrasah' },
  { value: 'admin_tu', label: 'Admin Tata Usaha' },
  { value: 'satpam', label: 'Satpam / Keamanan' },
  { value: 'pramubakti', label: 'Pramubakti / Kebersihan' },
]

const initialState = { error: null as string | null, success: null as string | null }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl shadow-md">
      {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sedang Membuat Akun...</> : 'Buat Akun Pegawai'}
    </Button>
  )
}

export function GuruClient({ initialData }: { initialData: ProfilType[] }) {
  const [isPending, setIsPending] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState('ALL')
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Modals State
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingPegawai, setEditingPegawai] = useState<ProfilType | null>(null)
  const [state, formAction] = useFormState(tambahPegawai, initialState)
  
  // Import State
  const [isImporting, setIsImporting] = useState(false)
  const [importLogs, setImportLogs] = useState<string[]>([])

  // Reset pagination when filter or search changes
  useEffect(() => { setCurrentPage(1) }, [searchTerm, filterRole, itemsPerPage])
  useEffect(() => {
    if (state?.success) {
      const timer = setTimeout(() => setIsAddOpen(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [state?.success])

  // FILTERING DATA
  const filteredData = initialData.filter(p => {
    const matchSearch = p.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) || p.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchRole = filterRole === 'ALL' || p.role === filterRole
    return matchSearch && matchRole
  })

  // PAGINATION LOGIC
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  // HANDLERS
  const handleUbahRole = async (id: string, newRole: string) => {
    if (!confirm('Yakin ingin mengubah hak akses pegawai ini?')) return
    setIsPending(true)
    const res = await ubahRolePegawai(id, newRole)
    if (res?.error) alert(res.error)
    setIsPending(false)
  }

  const handleHapus = async (id: string, nama: string) => {
    if (!confirm(`TINDAKAN PERMANEN!\nYakin ingin menghapus seluruh data dan akses login milik ${nama}?`)) return
    setIsPending(true)
    const res = await hapusPegawai(id)
    if (res?.error) alert(res.error)
    setIsPending(false)
  }

  const handleResetPassword = async (id: string, nama: string) => {
    if (!confirm(`Reset password untuk ${nama} menjadi default (mansatas2026)?`)) return
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
    const id = formData.get('id') as string
    const nama = formData.get('nama_lengkap') as string
    const email = formData.get('email') as string

    const res = await editPegawai(id, nama, email)
    if (res?.error) alert(res.error)
    else {
      alert(res.success)
      setEditingPegawai(null)
    }
    setIsPending(false)
  }

  // IMPORT EXCEL HANDLERS
  const handleDownloadTemplate = () => {
    const XLSX = (window as any).XLSX
    if (!XLSX) return alert('Library belum siap.')
    const data = [
      { NAMA_LENGKAP: "Budi Santoso, S.Pd", EMAIL: "budi@mansatas.sch.id", JABATAN: "guru" },
      { NAMA_LENGKAP: "Siti Aminah, M.Pd", EMAIL: "siti@mansatas.sch.id", JABATAN: "wakamad" }
    ]
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Data_Pegawai")
    XLSX.writeFile(wb, "Template_Import_Pegawai.xlsx")
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
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)
        
        const result = await importPegawaiMassal(jsonData) as { error?: string, success?: string, logs?: string[] }
        
        if (result.error) alert(result.error)
        else alert(result.success)
        
        if (result.logs && result.logs.length > 0) setImportLogs(result.logs)
      } catch (err: any) {
        alert('Gagal membaca file Excel.')
      } finally {
        setIsImporting(false)
        e.target.value = '' 
      }
    }
    reader.readAsBinaryString(file)
  }

  // Fungsi helper untuk mendapatkan warna inisial (pseudo-random berdasarkan nama, nuansa hijau/kuning/biru/ungu pastel)
  const getAvatarColor = (name: string) => {
    const colors = [
      'from-emerald-100 to-emerald-200 text-emerald-800',
      'from-teal-100 to-teal-200 text-teal-800',
      'from-cyan-100 to-cyan-200 text-cyan-800',
      'from-lime-100 to-lime-200 text-lime-800',
      'from-amber-100 to-amber-200 text-amber-800',
      'from-blue-100 to-blue-200 text-blue-800',
    ]
    const charCode = name.charCodeAt(0) || 0
    return colors[charCode % colors.length]
  }

  return (
    <>
      <Script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js" strategy="lazyOnload" />

      {/* MODAL EDIT */}
      <Dialog open={!!editingPegawai} onOpenChange={(open) => !open && setEditingPegawai(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="text-xl font-bold text-slate-800">Edit Profil Pegawai</DialogTitle></DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-5 py-4">
            <input type="hidden" name="id" value={editingPegawai?.id} />
            <div className="space-y-2">
              <Label className="text-slate-600 font-medium">Nama Lengkap</Label>
              <Input name="nama_lengkap" defaultValue={editingPegawai?.nama_lengkap} required className="rounded-xl bg-slate-50 focus:bg-white focus:border-emerald-500 transition-colors" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-600 font-medium">Email (Login)</Label>
              <Input type="email" name="email" defaultValue={editingPegawai?.email} required className="rounded-xl bg-slate-50 focus:bg-white focus:border-emerald-500 transition-colors" />
            </div>
            <Button type="submit" className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl" disabled={isPending}>
              {isPending ? <Loader2 className="animate-spin h-5 w-5" /> : 'Simpan Perubahan'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        {/* TOOLBAR MODERN */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white/80 backdrop-blur-xl p-4 rounded-2xl border border-slate-200/60 shadow-sm">
          
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            {/* SEARCH BAR MODERN */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Cari nama atau email..." 
                className="pl-10 rounded-xl bg-slate-50/50 border-slate-200 focus:bg-white focus:border-emerald-500 transition-all h-11" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
            {/* FILTER ROLE PILL */}
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-full sm:w-48 rounded-xl h-11 bg-slate-50/50 border-slate-200 text-slate-600 font-medium focus:ring-emerald-500">
                <SelectValue placeholder="Semua Jabatan" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="ALL" className="font-semibold text-emerald-600">Semua Jabatan</SelectItem>
                {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* BUTTON IMPORT EXCEL MODERN */}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 h-11 px-5 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all flex-1 sm:flex-none">
                  <FileSpreadsheet className="h-4 w-4" /> Import Excel
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl rounded-2xl">
                <DialogHeader><DialogTitle className="text-xl font-bold text-slate-800">Import Akun Pegawai Massal</DialogTitle></DialogHeader>
                <div className="space-y-5 py-2">
                  <div className="flex justify-between items-center p-4 bg-slate-50 border border-slate-100 rounded-xl">
                    <p className="text-sm font-medium text-slate-600">Download format template Excel:</p>
                    <Button size="sm" variant="outline" onClick={handleDownloadTemplate} className="gap-2 rounded-lg bg-white border-slate-200 hover:bg-slate-100"><Download className="h-4 w-4"/> Template</Button>
                  </div>
                  <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl text-sm space-y-2 text-emerald-800">
                    <p className="flex items-center gap-2 font-medium"><KeyRound className="h-4 w-4 text-emerald-600"/> Password akun otomatis: <strong className="bg-white text-emerald-700 px-2 py-0.5 rounded shadow-sm border border-emerald-100">mansatas2026</strong></p>
                    <p className="text-emerald-700">Kolom Wajib: <strong>NAMA_LENGKAP</strong>, <strong>EMAIL</strong>, <strong>JABATAN</strong></p>
                  </div>
                  <div className="relative group">
                    <Input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} disabled={isImporting} className="cursor-pointer file:cursor-pointer h-12 pt-2.5 rounded-xl border-slate-300 focus:border-emerald-500" />
                  </div>
                  
                  {isImporting && <div className="flex items-center justify-center p-4 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-xl border border-emerald-100 animate-pulse"><Loader2 className="mr-2 h-5 w-5 animate-spin"/> Sedang men-generate ratusan akun...</div>}
                  {importLogs.length > 0 && (
                    <div className="mt-4 border border-rose-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800 flex items-center gap-2"><AlertCircle className="h-5 w-5"/> Log Gagal Import:</div>
                      <ScrollArea className="h-32 bg-white p-4 text-xs font-mono text-rose-600 leading-relaxed">
                        {importLogs.map((log, i) => <div key={i} className="mb-1">{log}</div>)}
                      </ScrollArea>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* BUTTON TAMBAH MANUAL MODERN */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 h-11 px-5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md hover:shadow-lg transition-all flex-1 sm:flex-none border-0">
                  <UserPlus className="h-4 w-4" /> Tambah Pegawai
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader><DialogTitle className="text-xl font-bold text-slate-800">Buat Akun Pegawai Baru</DialogTitle></DialogHeader>
                <form action={formAction} className="space-y-5 py-2">
                  {state?.error && <div className="p-3 text-sm font-medium text-rose-600 bg-rose-50 rounded-xl border border-rose-100 flex items-start gap-2"><AlertCircle className="h-4 w-4 shrink-0 mt-0.5"/> {state.error}</div>}
                  {state?.success && <div className="p-3 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5"/> {state.success}</div>}

                  <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl flex gap-3 text-sm text-emerald-800">
                    <ShieldAlert className="h-5 w-5 shrink-0 text-emerald-600" />
                    <p className="leading-relaxed">Password default otomatis: <strong className="font-mono bg-white text-emerald-700 px-1.5 py-0.5 rounded shadow-sm border border-emerald-100">mansatas2026</strong>.</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600 font-medium">Nama Lengkap <span className="text-rose-500">*</span></Label>
                    <Input name="nama_lengkap" required className="rounded-xl bg-slate-50 focus:bg-white focus:border-emerald-500 transition-colors" placeholder="Contoh: Budi Santoso, S.Pd" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600 font-medium">Email Resmi <span className="text-rose-500">*</span></Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input name="email" type="email" required className="pl-10 rounded-xl bg-slate-50 focus:bg-white focus:border-emerald-500 transition-colors" placeholder="guru@mansatas.sch.id" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600 font-medium">Jabatan / Role <span className="text-rose-500">*</span></Label>
                    <Select name="role" defaultValue="guru">
                      <SelectTrigger className="rounded-xl bg-slate-50 focus:bg-white focus:ring-emerald-500"><SelectValue placeholder="Pilih Jabatan" /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="pt-2">
                    <SubmitButton />
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* DATA TABLE MODERN */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-slate-200/60 hover:bg-transparent">
                <TableHead className="font-semibold text-slate-600 h-12 px-6">Profil Pegawai</TableHead>
                <TableHead className="font-semibold text-slate-600 h-12">Hak Akses / Jabatan</TableHead>
                <TableHead className="text-right font-semibold text-slate-600 h-12 px-6">Kelola Akun</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400 space-y-3">
                      <div className="p-4 bg-slate-50 rounded-full"><Users className="h-8 w-8 text-slate-300" /></div>
                      <p className="font-medium text-slate-500">Tidak ada data pegawai yang ditemukan.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((p) => (
                  <TableRow key={p.id} className="hover:bg-emerald-50/30 transition-colors border-slate-100 group">
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        {/* AVATAR INISIAL */}
                        <div className={`h-11 w-11 rounded-full bg-gradient-to-br ${getAvatarColor(p.nama_lengkap)} shadow-inner flex items-center justify-center text-lg font-bold ring-2 ring-white`}>
                          {p.nama_lengkap.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">{p.nama_lengkap}</span>
                          <span className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                            <Mail className="h-3 w-3 opacity-70" /> {p.email}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                       <Select value={p.role} onValueChange={(val) => handleUbahRole(p.id, val)} disabled={isPending}>
                          <SelectTrigger className="h-9 w-[200px] text-xs font-bold tracking-wide rounded-full bg-slate-100/80 border-transparent hover:bg-slate-200 transition-colors text-slate-700 focus:ring-0 focus:ring-offset-0 focus:border-emerald-300">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl shadow-lg border-slate-100">
                            {ROLES.map(r => <SelectItem key={r.value} value={r.value} className="text-xs font-medium focus:bg-emerald-50 focus:text-emerald-700">{r.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                    </TableCell>
                    <TableCell className="text-right px-6 py-4">
                      <div className="flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" size="icon" 
                          onClick={() => handleResetPassword(p.id, p.nama_lengkap)} 
                          disabled={isPending} 
                          title="Reset Password (mansatas2026)" 
                          className="h-9 w-9 rounded-full bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" size="icon" 
                          onClick={() => setEditingPegawai(p)} 
                          disabled={isPending} 
                          title="Edit Profil" 
                          className="h-9 w-9 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" size="icon" 
                          onClick={() => handleHapus(p.id, p.nama_lengkap)} 
                          disabled={isPending} 
                          title="Hapus Permanen" 
                          className="h-9 w-9 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* PAGINATION FOOTER MODERN */}
          <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50 gap-4 text-sm">
            <div className="flex items-center gap-3 text-slate-500 font-medium">
              <span>Tampilkan</span>
              <Select value={itemsPerPage.toString()} onValueChange={(v) => setItemsPerPage(Number(v))}>
                <SelectTrigger className="h-9 w-[80px] bg-white rounded-lg border-slate-200 font-bold text-slate-700 shadow-sm focus:ring-emerald-500"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span>dari <strong className="text-slate-800">{filteredData.length}</strong> pegawai</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="rounded-lg bg-white shadow-sm hover:bg-slate-50 border-slate-200 text-slate-600">
                Sebelumnya
              </Button>
              <div className="flex items-center justify-center min-w-[4rem] font-bold text-slate-700">
                {currentPage} <span className="text-slate-400 font-medium mx-1">/</span> {totalPages || 1}
              </div>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages || totalPages === 0} className="rounded-lg bg-white shadow-sm hover:bg-slate-50 border-slate-200 text-slate-600">
                Berikutnya
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}