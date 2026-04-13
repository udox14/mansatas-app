// Lokasi: app/dashboard/surat/components/surat-client.tsx
'use client'

import { useState, useRef, useMemo } from 'react'
import { useReactToPrint } from 'react-to-print'
import {
  FileText, Printer, Loader2, X, ChevronLeft, Eye, Trash2,
  UserCheck, Briefcase, BookOpen, ClipboardCheck, Mail, Users, Megaphone,
  ArrowRightLeft, FileSignature, ShieldCheck, Plus, Filter, ChevronDown,
  RotateCcw, Search
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { TEMPLATE_MAP, formatTanggalIndo } from './surat-templates'
import { simpanSuratKeluar, hapusSuratKeluar, getSuratKeluar, hapusSuratKeluarBatch } from '../actions'
import { type JenisSurat, JENIS_SURAT_LABEL } from '../constants'
import { formatNamaKelas } from '@/lib/utils'

// ============================================================
// TYPES
// ============================================================
type MasterData = { siswa: any[]; guru: any[]; kelas: any[]; pejabat: any[] }

type SuratConfig = {
  id: JenisSurat; label: string; desc: string; icon: any; color: string
  needsSiswa: boolean; needsGuru: boolean; multiGuru: boolean; defaultPenandatangan: string
}

// ============================================================
// SURAT TYPE CONFIGS (no abbreviations except SPPD)
// ============================================================
const SURAT_CONFIGS: SuratConfig[] = [
  { id: 'penerimaan', label: 'Surat Penerimaan', desc: 'Keterangan penerimaan siswa baru/pindahan', icon: UserCheck, color: 'emerald', needsSiswa: true, needsGuru: false, multiGuru: false, defaultPenandatangan: 'H. Eka Mulyana, S.Ag., M.Pd.I.' },
  { id: 'sppd', label: 'SPPD', desc: 'Surat Perintah Perjalanan Dinas', icon: Briefcase, color: 'blue', needsSiswa: false, needsGuru: true, multiGuru: false, defaultPenandatangan: 'H. Eka Mulyana, S.Ag., M.Pd.I.' },
  { id: 'izin_pesantren', label: 'Surat Izin Pesantren', desc: 'Permohonan izin kegiatan ke pesantren', icon: BookOpen, color: 'violet', needsSiswa: false, needsGuru: false, multiGuru: false, defaultPenandatangan: 'H. Eka Mulyana, S.Ag., M.Pd.I.' },
  { id: 'ket_aktif', label: 'Surat Keterangan Aktif', desc: 'Keterangan siswa masih aktif belajar', icon: ClipboardCheck, color: 'teal', needsSiswa: true, needsGuru: false, multiGuru: false, defaultPenandatangan: 'H. Eka Mulyana, S.Ag., M.Pd.I.' },
  { id: 'permohonan', label: 'Surat Permohonan', desc: 'Permohonan umum untuk berbagai keperluan', icon: Mail, color: 'amber', needsSiswa: false, needsGuru: false, multiGuru: false, defaultPenandatangan: 'H. Eka Mulyana, S.Ag., M.Pd.I.' },
  { id: 'surat_tugas', label: 'Surat Tugas', desc: 'Penugasan guru/pegawai ke kegiatan', icon: Users, color: 'indigo', needsSiswa: false, needsGuru: true, multiGuru: true, defaultPenandatangan: 'H. Eka Mulyana, S.Ag., M.Pd.I.' },
  { id: 'undangan_rapat', label: 'Surat Undangan Rapat', desc: 'Undangan rapat atau kegiatan internal', icon: Megaphone, color: 'rose', needsSiswa: false, needsGuru: false, multiGuru: false, defaultPenandatangan: 'H. Eka Mulyana, S.Ag., M.Pd.I.' },
  { id: 'pindah', label: 'Surat Keterangan Pindah', desc: 'Keterangan pindah sekolah siswa', icon: ArrowRightLeft, color: 'orange', needsSiswa: true, needsGuru: false, multiGuru: false, defaultPenandatangan: 'H. Eka Mulyana, S.Ag., M.Pd.I.' },
  { id: 'pernyataan', label: 'Surat Pernyataan', desc: 'Pernyataan orang tua/wali murid', icon: FileSignature, color: 'slate', needsSiswa: true, needsGuru: false, multiGuru: false, defaultPenandatangan: '' },
  { id: 'kelakuan_baik', label: 'Surat Kelakuan Baik', desc: 'Keterangan berkelakuan baik siswa', icon: ShieldCheck, color: 'green', needsSiswa: true, needsGuru: false, multiGuru: false, defaultPenandatangan: 'H. Eka Mulyana, S.Ag., M.Pd.I.' },
]

const COLOR_MAP: Record<string, { border: string; iconBg: string }> = {
  emerald: { border: 'border-emerald-200 dark:border-emerald-800 hover:border-emerald-400', iconBg: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400' },
  blue: { border: 'border-blue-200 dark:border-blue-800 hover:border-blue-400', iconBg: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400' },
  violet: { border: 'border-violet-200 dark:border-violet-800 hover:border-violet-400', iconBg: 'bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400' },
  teal: { border: 'border-teal-200 dark:border-teal-800 hover:border-teal-400', iconBg: 'bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400' },
  amber: { border: 'border-amber-200 dark:border-amber-800 hover:border-amber-400', iconBg: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400' },
  indigo: { border: 'border-indigo-200 dark:border-indigo-800 hover:border-indigo-400', iconBg: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' },
  rose: { border: 'border-rose-200 dark:border-rose-800 hover:border-rose-400', iconBg: 'bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400' },
  orange: { border: 'border-orange-200 dark:border-orange-800 hover:border-orange-400', iconBg: 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400' },
  slate: { border: 'border-slate-200 dark:border-slate-700 hover:border-slate-400', iconBg: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' },
  green: { border: 'border-green-200 dark:border-green-800 hover:border-green-400', iconBg: 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400' },
}

const KEPALA_MADRASAH_OPTIONS = [
  { nama: 'H. Eka Mulyana, S.Ag., M.Pd.I.', jabatan: 'Kepala Madrasah' },
  { nama: 'H. Eka Mulyana, S.Ag., M.Pd.I.', jabatan: 'Kepala Madrasah' },
]

// ============================================================
// SEARCHABLE SELECT
// ============================================================
function SearchableSelect({ label, options, value, onChange, placeholder }: {
  label: string; options: { value: string; label: string; sub?: string }[]
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    if (!search) return options
    const q = search.toLowerCase()
    return options.filter(o => o.label.toLowerCase().includes(q) || (o.sub && o.sub.toLowerCase().includes(q)))
  }, [search, options])

  return (
    <div className="relative">
      <Label className="text-xs font-medium">{label}</Label>
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full mt-1 flex items-center justify-between rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-left">
        <span className={value ? 'text-slate-800 dark:text-slate-200 truncate' : 'text-slate-400'}>
          {value ? options.find(o => o.value === value)?.label || value : (placeholder || '-- Pilih --')}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearch('') }} />
          <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg max-h-60 overflow-hidden">
            <div className="p-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 rounded-md px-2">
                <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <input autoFocus className="w-full py-1.5 text-xs bg-transparent outline-none" placeholder="Cari..."
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="overflow-y-auto max-h-48">
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-xs text-slate-400 text-center">Tidak ditemukan</p>
              ) : filtered.map(o => (
                <button key={o.value} type="button"
                  onClick={() => { onChange(o.value); setOpen(false); setSearch('') }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 ${value === o.value ? 'bg-amber-50 dark:bg-amber-950/30 font-medium' : ''}`}>
                  <span className="block">{o.label}</span>
                  {o.sub && <span className="block text-[10px] text-slate-400">{o.sub}</span>}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ============================================================
// SEARCHABLE MULTI-SELECT (for surat tugas)
// ============================================================
function SearchMulti({ options, selected, onChange }: {
  options: { value: string; label: string; sub?: string }[]; selected: string[]; onChange: (v: string[]) => void
}) {
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    if (!search) return options
    const q = search.toLowerCase()
    return options.filter(o => o.label.toLowerCase().includes(q) || (o.sub && o.sub.toLowerCase().includes(q)))
  }, [search, options])

  return (
    <div className="mt-1 border rounded-md border-slate-200 dark:border-slate-700">
      <div className="p-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 rounded-md px-2">
          <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <input className="w-full py-1.5 text-xs bg-transparent outline-none" placeholder="Cari pegawai..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="max-h-40 overflow-y-auto p-1.5 space-y-0.5">
        {filtered.map(o => {
          const checked = selected.includes(o.value)
          return (
            <label key={o.value} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 rounded px-2 py-1">
              <input type="checkbox" checked={checked} className="rounded"
                onChange={() => onChange(checked ? selected.filter(id => id !== o.value) : [...selected, o.value])} />
              <div>
                <span className="block">{o.label}</span>
                {o.sub && <span className="block text-[10px] text-slate-400">{o.sub}</span>}
              </div>
            </label>
          )
        })}
      </div>
      {selected.length > 0 && (
        <div className="px-2 py-1.5 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-500">{selected.length} pegawai dipilih</div>
      )}
    </div>
  )
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export function SuratClient({ masterData, logSurat: initialLog, currentUser }: {
  masterData: MasterData; logSurat: any[]; currentUser: { id: string; nama: string }
}) {
  const [activeTab, setActiveTab] = useState('buat')
  const [logData, setLogData] = useState(initialLog)
  const [filterJenis, setFilterJenis] = useState('')
  const [filterTahun, setFilterTahun] = useState(String(new Date().getFullYear()))
  const [filterBulan, setFilterBulan] = useState('')
  const [isFilterLoading, setIsFilterLoading] = useState(false)
  const [perPage, setPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardType, setWizardType] = useState<JenisSurat | null>(null)
  const [wizardStep, setWizardStep] = useState<'form' | 'preview'>('form')
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ success?: string; error?: string; nomor_surat?: string } | null>(null)
  const [reprintData, setReprintData] = useState<any>(null)
  const [reprintType, setReprintType] = useState<JenisSurat | null>(null)
  const [reprintOpen, setReprintOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const printRef = useRef<HTMLDivElement>(null)
  const reprintRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({ contentRef: printRef })
  const handleReprint = useReactToPrint({ contentRef: reprintRef })

  const siswaOptions = useMemo(() => masterData.siswa.map((s: any) => ({
    value: s.id, label: s.nama_lengkap,
    sub: s.tingkat ? `Kelas ${formatNamaKelas(s.tingkat, s.nomor_kelas, s.kelompok)}` : 'Belum ada kelas',
  })), [masterData.siswa])
  const guruOptions = useMemo(() => masterData.guru.map((g: any) => ({
    value: g.id, label: g.nama_lengkap, sub: g.jabatan_struktural || g.role || '',
  })), [masterData.guru])

  const openWizard = (type: JenisSurat) => {
    const config = SURAT_CONFIGS.find(c => c.id === type)!
    setWizardType(type); setWizardStep('form')
    setFormData({ penandatangan: config.defaultPenandatangan })
    setSaveResult(null); setWizardOpen(true)
  }
  const closeWizard = () => { setWizardOpen(false); setWizardType(null); setFormData({}); setSaveResult(null) }
  const updateField = (key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value }))

  const selectedSiswa = formData.siswa_id ? masterData.siswa.find((s: any) => s.id === formData.siswa_id) : null

  const buildTemplateData = () => {
    const d = formData.tanggal_surat_raw ? new Date(formData.tanggal_surat_raw) : new Date()
    const blnRomawi = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][d.getMonth() + 1]
    const tahun = d.getFullYear()
    const pfx = formData.nomor_urut_manual || '___'
    const defaultNomor = `${pfx}/Mts.10.06.696/PP.00.5/${blnRomawi}/${tahun}`

    const base: Record<string, any> = { ...formData, nomor_surat: saveResult?.nomor_surat || defaultNomor }
    if (selectedSiswa) base.siswa = selectedSiswa
    if (wizardType === 'sppd' && formData.guru_id) {
      const g = masterData.guru.find((g: any) => g.id === formData.guru_id)
      if (g) { base.nama_pegawai = g.nama_lengkap; base.jabatan_pegawai = g.jabatan_struktural || g.role || '-' }
    }
    if (wizardType === 'surat_tugas') {
      base.daftar_guru = (formData.guru_ids || []).map((id: string) => {
        const g = masterData.guru.find((g: any) => g.id === id)
        return g ? { nama: g.nama_lengkap, jabatan: g.jabatan_struktural || g.role || '-' } : null
      }).filter(Boolean)
    }
    if (wizardType === 'izin_pesantren') {
      base.daftar_siswa = (formData.siswa_ids || []).map((id: string) => {
        const s = masterData.siswa.find((s: any) => s.id === id)
        return s ? { nama: s.nama_lengkap, kelas: s.tingkat ? `Kelas ${formatNamaKelas(s.tingkat, s.nomor_kelas, s.kelompok)}` : '-' } : null
      }).filter(Boolean)
    }
    return base
  }

  const handleSaveAndPreview = async () => {
    if (!wizardType) return
    setIsSaving(true)
    const result = await simpanSuratKeluar({
      jenis_surat: wizardType,
      perihal: formData.perihal || JENIS_SURAT_LABEL[wizardType],
      data_surat: buildTemplateData(),
      dicetak_oleh: currentUser.id,
      nama_pencetak: currentUser.nama,
      nomor_urut_manual: formData.nomor_urut_manual
    })
    setSaveResult(result); setIsSaving(false)
    if (result.success) { setWizardStep('preview'); refreshLog() }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin hapus surat ini dari log?')) return
    const r = await hapusSuratKeluar(id)
    if (r.success) { refreshLog(); setSelectedIds([]) }
  }

  const handleDeleteBatch = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`Yakin hapus ${selectedIds.length} surat yang dipilih dari log?`)) return
    setIsFilterLoading(true)
    const r = await hapusSuratKeluarBatch(selectedIds)
    if (r.success) { refreshLog(); setSelectedIds([]) }
    setIsFilterLoading(false)
  }

  const handleReprintOpen = (surat: any) => {
    try {
      const parsed = typeof surat.data_surat === 'string' ? JSON.parse(surat.data_surat) : surat.data_surat
      setReprintData({ ...parsed, nomor_surat: surat.nomor_surat })
      setReprintType(surat.jenis_surat as JenisSurat)
      setReprintOpen(true)
    } catch { /* ignore */ }
  }

  const refreshLog = async () => {
    setIsFilterLoading(true)
    const data = await getSuratKeluar({
      jenis_surat: filterJenis as any || undefined,
      tahun: filterTahun ? parseInt(filterTahun) : undefined,
      bulan: filterBulan ? parseInt(filterBulan) : undefined,
    })
    setLogData(data); setCurrentPage(1); setIsFilterLoading(false)
  }

  const totalPages = Math.ceil(logData.length / perPage)
  const paginatedLog = logData.slice((currentPage - 1) * perPage, currentPage * perPage)
  const BULAN_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

  // ----------------------------------------------------------
  // WIZARD FORM FIELDS
  // ----------------------------------------------------------
  const renderFormFields = () => {
    if (!wizardType) return null
    const config = SURAT_CONFIGS.find(c => c.id === wizardType)!
    return (
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg mb-2">
           <Field label="No. Surat (Hanya Bagian Depan)" field="nomor_urut_manual" formData={formData} onChange={updateField} placeholder="Cth: 025 (Wajib Diisi)" />
           <p className="text-[10px] text-amber-700/80 mt-1 italic">* Format bawaan otomatis: .../Mts.10.06.696/PP.00.5/Bulan/Tahun</p>
        </div>

        {config.needsSiswa && (
          <SearchableSelect label="Pilih Siswa" options={siswaOptions} value={formData.siswa_id || ''} onChange={v => updateField('siswa_id', v)} placeholder="Cari nama siswa..." />
        )}
        {config.needsGuru && !config.multiGuru && (
          <SearchableSelect label="Pilih Pegawai" options={guruOptions} value={formData.guru_id || ''} onChange={v => updateField('guru_id', v)} placeholder="Cari nama pegawai..." />
        )}
        {config.multiGuru && (
          <div><Label className="text-xs font-medium">Pilih Pegawai (bisa lebih dari satu)</Label>
            <SearchMulti options={guruOptions} selected={formData.guru_ids || []} onChange={v => updateField('guru_ids', v)} />
          </div>
        )}

        {wizardType === 'penerimaan' && <Field label="Tanggal Diterima" type="date" field="tanggal_terima" formData={formData} onChange={updateField} />}

        {wizardType === 'sppd' && (<>
          <Field label="Maksud Perjalanan Dinas" field="maksud_perjalanan" formData={formData} onChange={updateField} />
          <Field label="Tempat Tujuan" field="tempat_tujuan" formData={formData} onChange={updateField} />
          <Field label="Tanggal Berangkat" type="date" field="tanggal_berangkat" formData={formData} onChange={updateField} />
          <Field label="Tanggal Kembali (opsional)" type="date" field="tanggal_kembali" formData={formData} onChange={updateField} />
          <Field label="Lama Perjalanan" field="lama_perjalanan" formData={formData} onChange={updateField} placeholder="1 hari" />
          <Field label="Alat Angkut" field="alat_angkut" formData={formData} onChange={updateField} placeholder="Darat" />
        </>)}

        {wizardType === 'izin_pesantren' && (<>
          <div>
            <Label className="text-xs font-medium">Daftar Siswa (Bisa lebih dari 1)</Label>
            <SearchMulti options={siswaOptions} selected={formData.siswa_ids || []} onChange={v => updateField('siswa_ids', v)} />
          </div>
          <Field label="Tujuan Surat (Kepada)" field="tujuan_surat" formData={formData} onChange={updateField} placeholder="Wakil Pimpinan Bid. Kesantrian ..." />
          <Field label="Keperluan / Alasan" field="keperluan" formData={formData} onChange={updateField} placeholder="akan dilaksanakannya In House Training" />
          <Field label="Hari, Tanggal" field="hari_tanggal" formData={formData} onChange={updateField} placeholder="Rabu, 30 Juli 2025" />
          <Field label="Waktu" field="waktu" formData={formData} onChange={updateField} placeholder="08.00 s.d Selesai" />
          <Field label="Tempat" field="tempat" formData={formData} onChange={updateField} placeholder="MAN 1 Tasikmalaya" />
        </>)}

        {wizardType === 'ket_aktif' && <Field label="Tahun Pelajaran Masuk" field="tahun_masuk" formData={formData} onChange={updateField} placeholder="2023/2024" />}

        {wizardType === 'permohonan' && (<>
          <Field label="Tujuan Surat (Kepada)" field="tujuan_surat" formData={formData} onChange={updateField} placeholder="Pendamping Madrasah (Drs. ...)" />
          <Field label="Perihal" field="perihal" formData={formData} onChange={updateField} placeholder="Permohonan" />
          <Field label="Lampiran" field="lampiran" formData={formData} onChange={updateField} placeholder="-" />
          <Field label="Isi Surat" field="isi_surat" formData={formData} onChange={updateField} textarea placeholder="Sehubungan akan diadakannya ..." />
          <Field label="Hari/Tanggal Kegiatan (opsional)" field="hari_tanggal" formData={formData} onChange={updateField} />
          <Field label="Waktu (opsional)" field="waktu" formData={formData} onChange={updateField} />
          <Field label="Tempat (opsional)" field="tempat" formData={formData} onChange={updateField} />
          <Field label="Isi Tambahan (opsional)" field="isi_tambahan" formData={formData} onChange={updateField} textarea />
        </>)}

        {wizardType === 'surat_tugas' && (<>
          <Field label="Dasar Surat (opsional)" field="dasar_surat" formData={formData} onChange={updateField} textarea placeholder="Mengingat surat dari ... tentang ..." />
          <Field label="Tujuan Penugasan" field="tujuan_tugas" formData={formData} onChange={updateField} placeholder="membimbing peserta lomba" />
          <Field label="Tanggal Kegiatan" field="tanggal_kegiatan" formData={formData} onChange={updateField} placeholder="11 November 2025" />
          <Field label="Tempat Kegiatan" field="tempat_kegiatan" formData={formData} onChange={updateField} placeholder="MAN 1 Ciamis" />
        </>)}

        {wizardType === 'undangan_rapat' && (<>
          <Field label="Tujuan Undangan (Kepada)" field="tujuan_surat" formData={formData} onChange={updateField} placeholder="Pendidik dan Tenaga Kependidikan" />
          <Field label="Perihal" field="perihal" formData={formData} onChange={updateField} placeholder="Undangan Rapat" />
          <Field label="Keterangan Pembuka" field="isi_surat" formData={formData} onChange={updateField} textarea placeholder="Sehubungan akan dilaksanakannya ..." />
          <Field label="Hari/Tanggal" field="hari_tanggal" formData={formData} onChange={updateField} placeholder="Selasa, 10 Februari 2026" />
          <Field label="Waktu" field="waktu" formData={formData} onChange={updateField} placeholder="Pukul 07:30 WIB s.d Selesai" />
          <Field label="Tempat" field="tempat" formData={formData} onChange={updateField} placeholder="Aula Terbuka MAN 1 Tasikmalaya" />
          <Field label="Agenda" field="agenda" formData={formData} onChange={updateField} placeholder="Pembinaan Tenaga Pendidik" />
          <Field label="Catatan (opsional)" field="catatan" formData={formData} onChange={updateField} />
        </>)}

        {wizardType === 'pindah' && (<>
          <Field label="Alasan Pindah" field="alasan_pindah" formData={formData} onChange={updateField} />
          <Field label="Sekolah Tujuan" field="sekolah_tujuan" formData={formData} onChange={updateField} />
        </>)}

        {wizardType === 'pernyataan' && (<>
          <Field label="Nama Orang Tua/Wali" field="nama_ortu" formData={formData} onChange={updateField} placeholder={selectedSiswa?.nama_ayah || ''} />
          <Field label="Alamat Orang Tua/Wali" field="alamat_ortu" formData={formData} onChange={updateField} />
          <Field label="No. KTP" field="no_ktp" formData={formData} onChange={updateField} placeholder={selectedSiswa?.nik_ayah || ''} />
          <Field label="Tahun Pelajaran" field="tahun_pelajaran" formData={formData} onChange={updateField} placeholder="2025/2026" />
        </>)}

        <Field label="Tanggal Surat" type="date" field="tanggal_surat_raw" formData={formData}
          onChange={(k, v) => { updateField(k, v); updateField('tanggal_surat', formatTanggalIndo(v)) }} />

        {wizardType !== 'pernyataan' && (
          <div>
            <Label className="text-xs font-medium">Penandatangan</Label>
            <select className="w-full mt-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              value={formData.penandatangan || ''} onChange={e => updateField('penandatangan', e.target.value)}>
              <option value="">-- Pilih --</option>
              {KEPALA_MADRASAH_OPTIONS.map((p, i) => (
                <option key={`km-${i}`} value={p.nama}>{p.nama} — {p.jabatan}</option>
              ))}
              {masterData.pejabat.filter((p: any) => p.nama_lengkap && !KEPALA_MADRASAH_OPTIONS.some(km => km.nama === p.nama_lengkap)).map((p: any) => (
                <option key={p.user_id} value={p.nama_lengkap}>{p.nama_lengkap} — {p.nama}</option>
              ))}
            </select>
            <Input className="mt-1" placeholder="Atau ketik nama manual..." value={formData.penandatangan || ''} onChange={e => updateField('penandatangan', e.target.value)} />
          </div>
        )}
      </div>
    )
  }

  // ----------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------
  return (
    <>
      <TabsPrimitive.Root value={activeTab} onValueChange={setActiveTab}>
        <TabsPrimitive.List className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 w-fit">
          <TabsPrimitive.Trigger value="buat" className="px-4 py-1.5 text-sm font-medium rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm transition-all">
            <Plus className="h-3.5 w-3.5 inline mr-1.5" />Buat Surat
          </TabsPrimitive.Trigger>
          <TabsPrimitive.Trigger value="log" className="px-4 py-1.5 text-sm font-medium rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm transition-all">
            <FileText className="h-3.5 w-3.5 inline mr-1.5" />Log Surat Keluar
          </TabsPrimitive.Trigger>
        </TabsPrimitive.List>

        {/* ── TAB: BUAT SURAT ── */}
        <TabsPrimitive.Content value="buat" className="mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {SURAT_CONFIGS.map(cfg => {
              const Icon = cfg.icon
              const c = COLOR_MAP[cfg.color] || COLOR_MAP.amber
              return (
                <button key={cfg.id} onClick={() => openWizard(cfg.id)}
                  className={`flex flex-col items-start gap-3 p-4 rounded-xl border ${c.border} bg-white dark:bg-slate-900 hover:shadow-lg transition-all group text-left`}>
                  <div className={`p-2 rounded-lg ${c.iconBg} group-hover:scale-110 transition-transform`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 leading-tight">{cfg.label}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 leading-snug">{cfg.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </TabsPrimitive.Content>

        {/* ── TAB: LOG SURAT ── */}
        <TabsPrimitive.Content value="log" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-end gap-2 p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <div>
              <Label className="text-[10px] text-slate-500">Jenis Surat</Label>
              <select className="block mt-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs"
                value={filterJenis} onChange={e => setFilterJenis(e.target.value)}>
                <option value="">Semua</option>
                {Object.entries(JENIS_SURAT_LABEL).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
              </select>
            </div>
            <div>
              <Label className="text-[10px] text-slate-500">Bulan</Label>
              <select className="block mt-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs"
                value={filterBulan} onChange={e => setFilterBulan(e.target.value)}>
                <option value="">Semua</option>
                {BULAN_NAMES.slice(1).map((b, i) => (<option key={i + 1} value={String(i + 1)}>{b}</option>))}
              </select>
            </div>
            <div>
              <Label className="text-[10px] text-slate-500">Tahun</Label>
              <Input className="h-8 w-20 text-xs" value={filterTahun} onChange={e => setFilterTahun(e.target.value)} />
            </div>
            <Button size="sm" variant="outline" onClick={refreshLog} disabled={isFilterLoading}>
              {isFilterLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Filter className="h-3.5 w-3.5" />}
              <span className="ml-1 text-xs">Filter</span>
            </Button>
            <div className="ml-auto">
              <Label className="text-[10px] text-slate-500">Per halaman</Label>
              <select className="block mt-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs"
                value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setCurrentPage(1) }}>
                {[10, 20, 50, 100].map(n => (<option key={n} value={n}>{n}</option>))}
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-x-auto bg-white dark:bg-slate-900">
            {selectedIds.length > 0 && (
              <div className="bg-red-50 dark:bg-red-950/20 px-3 py-2 border-b border-red-100 dark:border-red-900 flex justify-between items-center">
                <span className="text-xs font-semibold text-red-700 dark:text-red-400">{selectedIds.length} item dipilih</span>
                <Button size="sm" variant="destructive" onClick={handleDeleteBatch} className="h-7 text-xs px-3">
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Hapus Terpilih
                </Button>
              </div>
            )}
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 text-left">
                  <th className="px-3 py-2 w-[30px] text-center">
                    <input type="checkbox" className="rounded"
                      checked={paginatedLog.length > 0 && paginatedLog.every((l: any) => selectedIds.includes(l.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const newIds = new Set(selectedIds)
                          paginatedLog.forEach((l: any) => newIds.add(l.id))
                          setSelectedIds(Array.from(newIds))
                        } else {
                          const paginatedSet = new Set(paginatedLog.map((l: any) => l.id))
                          setSelectedIds(selectedIds.filter(id => !paginatedSet.has(id)))
                        }
                      }}
                    />
                  </th>
                  <th className="px-3 py-2 font-medium text-slate-500">No. Surat</th>
                  <th className="px-3 py-2 font-medium text-slate-500">Jenis</th>
                  <th className="px-3 py-2 font-medium text-slate-500">Perihal</th>
                  <th className="px-3 py-2 font-medium text-slate-500">Dicetak oleh</th>
                  <th className="px-3 py-2 font-medium text-slate-500">Tanggal</th>
                  <th className="px-3 py-2 font-medium text-slate-500 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLog.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">Belum ada surat yang tercatat.</td></tr>
                ) : paginatedLog.map((s: any) => (
                  <tr key={s.id} className={`border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${selectedIds.includes(s.id) ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" className="rounded"
                        checked={selectedIds.includes(s.id)}
                        onChange={() => setSelectedIds(prev => prev.includes(s.id) ? prev.filter(i => i !== s.id) : [...prev, s.id])}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px]">{s.nomor_surat}</td>
                    <td className="px-3 py-2">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[10px] font-medium">
                        {JENIS_SURAT_LABEL[s.jenis_surat as JenisSurat] || s.jenis_surat}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400 max-w-[200px] truncate">{s.perihal || '-'}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{s.nama_pencetak || '-'}</td>
                    <td className="px-3 py-2 text-slate-500">
                      {s.created_at ? new Date(s.created_at + 'Z').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => handleReprintOpen(s)} className="text-blue-400 hover:text-blue-600 transition-colors" title="Cetak Ulang">
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(s.id)} className="text-red-400 hover:text-red-600 transition-colors" title="Hapus">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Menampilkan {(currentPage - 1) * perPage + 1}–{Math.min(currentPage * perPage, logData.length)} dari {logData.length}</span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="h-7 px-2 text-xs">Prev</Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2)).map(p => (
                  <Button key={p} size="sm" variant={p === currentPage ? 'default' : 'outline'} onClick={() => setCurrentPage(p)} className="h-7 w-7 p-0 text-xs">{p}</Button>
                ))}
                <Button size="sm" variant="outline" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="h-7 px-2 text-xs">Next</Button>
              </div>
            </div>
          )}
        </TabsPrimitive.Content>
      </TabsPrimitive.Root>

      {/* ── WIZARD MODAL ── */}
      <DialogPrimitive.Root open={wizardOpen} onOpenChange={v => !v && closeWizard()}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <DialogPrimitive.Content className="fixed inset-0 z-50 flex items-start justify-center pt-[3vh] pb-[3vh] overflow-y-auto">
            <div className={`bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full mx-3 ${wizardStep === 'preview' ? 'max-w-[240mm]' : 'max-w-lg'} transition-all duration-300`}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{wizardType ? JENIS_SURAT_LABEL[wizardType] : 'Buat Surat'}</h3>
                  {wizardStep === 'preview' && saveResult?.nomor_surat && (
                    <span className="text-[10px] font-mono text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded">{saveResult.nomor_surat}</span>
                  )}
                </div>
                <DialogPrimitive.Close className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><X className="h-4 w-4" /></DialogPrimitive.Close>
              </div>
              <div className="px-5 py-4">
                {wizardStep === 'form' && (<>
                  {renderFormFields()}
                  <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <Button variant="outline" size="sm" onClick={closeWizard}>Batal</Button>
                    <Button size="sm" onClick={handleSaveAndPreview} disabled={isSaving} className="bg-amber-600 hover:bg-amber-700 text-white">
                      {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}Simpan & Preview
                    </Button>
                  </div>
                  {saveResult?.error && <p className="text-xs text-red-500 mt-2">{saveResult.error}</p>}
                </>)}
                {wizardStep === 'preview' && wizardType && (<>
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-auto max-h-[70vh] bg-gray-100 dark:bg-slate-800 p-4">
                    <div ref={printRef} style={{ background: '#fff' }}>
                      {(() => { const Tpl = TEMPLATE_MAP[wizardType]; return Tpl ? <Tpl data={{ ...buildTemplateData(), nomor_surat: saveResult?.nomor_surat || '' }} /> : <p>Template tidak ditemukan</p> })()}
                    </div>
                  </div>
                  <div className="flex justify-between gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <Button variant="outline" size="sm" onClick={() => setWizardStep('form')}><ChevronLeft className="h-3.5 w-3.5 mr-1" /> Kembali</Button>
                    <Button size="sm" onClick={() => handlePrint()} className="bg-emerald-600 hover:bg-emerald-700 text-white"><Printer className="h-3.5 w-3.5 mr-1" /> Cetak PDF</Button>
                  </div>
                </>)}
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* ── REPRINT MODAL ── */}
      <DialogPrimitive.Root open={reprintOpen} onOpenChange={v => !v && setReprintOpen(false)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <DialogPrimitive.Content className="fixed inset-0 z-50 flex items-start justify-center pt-[3vh] pb-[3vh] overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-[240mm] mx-3">
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-blue-500" />
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Cetak Ulang Surat</h3>
                  {reprintData?.nomor_surat && <span className="text-[10px] font-mono text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded">{reprintData.nomor_surat}</span>}
                </div>
                <DialogPrimitive.Close className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><X className="h-4 w-4" /></DialogPrimitive.Close>
              </div>
              <div className="px-5 py-4">
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-auto max-h-[70vh] bg-gray-100 dark:bg-slate-800 p-4">
                  <div ref={reprintRef} style={{ background: '#fff' }}>
                    {reprintType && reprintData && (() => { const Tpl = TEMPLATE_MAP[reprintType]; return Tpl ? <Tpl data={reprintData} /> : <p>Template tidak ditemukan</p> })()}
                  </div>
                </div>
                <div className="flex justify-end mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <Button size="sm" onClick={() => handleReprint()} className="bg-emerald-600 hover:bg-emerald-700 text-white"><Printer className="h-3.5 w-3.5 mr-1" /> Cetak PDF</Button>
                </div>
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  )
}

// ============================================================
// FIELD HELPER
// ============================================================
function Field({ label, field, formData, onChange, type = 'text', placeholder, textarea }: {
  label: string; field: string; formData: any; onChange: (k: string, v: any) => void
  type?: string; placeholder?: string; textarea?: boolean
}) {
  return (
    <div>
      <Label className="text-xs font-medium">{label}</Label>
      {textarea ? (
        <textarea className="w-full mt-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm min-h-[60px]"
          value={formData[field] || ''} onChange={e => onChange(field, e.target.value)} placeholder={placeholder} />
      ) : (
        <Input type={type} className="mt-1" value={formData[field] || ''} onChange={e => onChange(field, e.target.value)} placeholder={placeholder} />
      )}
    </div>
  )
}
