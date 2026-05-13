// Lokasi: app/dashboard/surat/components/surat-client.tsx
'use client'

import { useMemo, useRef, useState } from 'react'
import { useReactToPrint } from 'react-to-print'
import {
  ArrowRightLeft, BookOpen, Briefcase, ChevronDown, ClipboardCheck,
  FileSignature, FileText, Filter, Loader2, Mail, Megaphone, Plus, Printer,
  RotateCcw, Search, ShieldCheck, Trash2, UserCheck, Users, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import {
  DEFAULT_PRINT_SETTINGS,
  TEMPLATE_MAP,
  formatTanggalIndo,
  getPrintPageStyle,
  getPrintSettings,
  type PrintSettings,
} from './surat-templates'
import { hapusSuratKeluar, hapusSuratKeluarBatch, getSuratKeluar, simpanSuratKeluar, simpanSuratPenandatanganSettings, type SuratPenandatanganSettings } from '../actions'
import { JENIS_SURAT_LABEL, KODE_KLASIFIKASI_SURAT, type JenisSurat } from '../constants'
import { formatNamaKelas } from '@/lib/utils'

type MasterData = { siswa: any[]; guru: any[]; kelas: any[]; pejabat: any[] }

type SuratConfig = {
  id: JenisSurat
  label: string
  desc: string
  icon: any
  color: string
  needsSiswa?: boolean
  needsGuru?: boolean
  multiGuru?: boolean
}

const SURAT_CONFIGS: SuratConfig[] = [
  { id: 'ket_aktif', label: 'Siswa Aktif', desc: 'Keterangan siswa aktif', icon: ClipboardCheck, color: 'teal', needsSiswa: true },
  { id: 'kelakuan_baik', label: 'SKKB', desc: 'Keterangan kelakuan baik', icon: ShieldCheck, color: 'green', needsSiswa: true },
  { id: 'mutasi_keluar', label: 'Mutasi Keluar', desc: 'Keterangan pindah siswa', icon: ArrowRightLeft, color: 'orange', needsSiswa: true },
  { id: 'mutasi_masuk', label: 'Mutasi Masuk', desc: 'Keterangan tidak keberatan', icon: UserCheck, color: 'emerald' },
  { id: 'penelitian', label: 'Penelitian', desc: 'Keterangan selesai penelitian', icon: BookOpen, color: 'violet' },
  { id: 'panggilan_ortu', label: 'Panggilan Ortu', desc: 'Panggilan wali murid', icon: Megaphone, color: 'rose', needsSiswa: true },
  { id: 'sppd', label: 'SPPD', desc: 'Surat perjalanan dinas', icon: Briefcase, color: 'blue', needsGuru: true },
  { id: 'penerimaan', label: 'Penerimaan', desc: 'Keterangan penerimaan siswa', icon: UserCheck, color: 'emerald', needsSiswa: true },
  { id: 'izin_pesantren', label: 'Izin Pesantren', desc: 'Permohonan izin kegiatan', icon: BookOpen, color: 'violet' },
  { id: 'permohonan', label: 'Permohonan', desc: 'Permohonan umum', icon: Mail, color: 'amber' },
  { id: 'surat_tugas', label: 'Surat Tugas', desc: 'Penugasan pegawai', icon: Users, color: 'indigo', needsGuru: true, multiGuru: true },
  { id: 'undangan_rapat', label: 'Undangan Rapat', desc: 'Undangan rapat/kegiatan', icon: Megaphone, color: 'rose' },
  { id: 'pernyataan', label: 'Pernyataan', desc: 'Pernyataan orang tua/wali', icon: FileSignature, color: 'slate', needsSiswa: true },
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
  slate: { border: 'border-slate-200 dark:border-slate-800 hover:border-slate-400', iconBg: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' },
  green: { border: 'border-green-200 dark:border-green-800 hover:border-green-400', iconBg: 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400' },
}

const BULAN_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const BULAN_ROMAWI = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

function SearchableSelect({ label, options, value, onChange, placeholder }: {
  label: string
  options: { value: string; label: string; sub?: string }[]
  value: string
  onChange: (v: string) => void
  placeholder?: string
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
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="mt-1 flex w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <span className={value ? 'truncate text-slate-800 dark:text-slate-200' : 'text-slate-400'}>
          {value ? options.find(o => o.value === value)?.label || value : (placeholder || '-- Pilih --')}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearch('') }} />
          <div className="absolute z-50 mt-1 max-h-60 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 p-2 dark:border-slate-800">
              <div className="flex items-center gap-1.5 rounded-md bg-slate-50 px-2 dark:bg-slate-800">
                <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <input autoFocus className="w-full bg-transparent py-1.5 text-xs outline-none" placeholder="Cari..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-slate-400">Tidak ditemukan</p>
              ) : filtered.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); setSearch('') }}
                  className={`w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800 ${value === o.value ? 'bg-amber-50 font-medium dark:bg-amber-950/30' : ''}`}
                >
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

function SearchMulti({ options, selected, onChange }: {
  options: { value: string; label: string; sub?: string }[]
  selected: string[]
  onChange: (v: string[]) => void
}) {
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    if (!search) return options
    const q = search.toLowerCase()
    return options.filter(o => o.label.toLowerCase().includes(q) || (o.sub && o.sub.toLowerCase().includes(q)))
  }, [search, options])

  return (
    <div className="mt-1 rounded-md border border-slate-200 dark:border-slate-800">
      <div className="border-b border-slate-100 p-2 dark:border-slate-800">
        <div className="flex items-center gap-1.5 rounded-md bg-slate-50 px-2 dark:bg-slate-800">
          <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <input className="w-full bg-transparent py-1.5 text-xs outline-none" placeholder="Cari..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="max-h-40 space-y-0.5 overflow-y-auto p-1.5">
        {filtered.map(o => {
          const checked = selected.includes(o.value)
          return (
            <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-slate-50 dark:hover:bg-slate-800">
              <input type="checkbox" checked={checked} className="rounded" onChange={() => onChange(checked ? selected.filter(id => id !== o.value) : [...selected, o.value])} />
              <div>
                <span className="block">{o.label}</span>
                {o.sub && <span className="block text-[10px] text-slate-400">{o.sub}</span>}
              </div>
            </label>
          )
        })}
      </div>
      {selected.length > 0 && <div className="border-t border-slate-100 px-2 py-1.5 text-[10px] text-slate-500 dark:border-slate-800">{selected.length} dipilih</div>}
    </div>
  )
}

export function SuratClient({ masterData, logSurat: initialLog, penandatanganSettings, currentUser }: {
  masterData: MasterData
  logSurat: any[]
  penandatanganSettings: SuratPenandatanganSettings
  currentUser: { id: string; nama: string }
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
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ success?: string; error?: string; nomor_surat?: string } | null>(null)
  const [reprintData, setReprintData] = useState<any>(null)
  const [reprintType, setReprintType] = useState<JenisSurat | null>(null)
  const [reprintOpen, setReprintOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [signerSettings, setSignerSettings] = useState<SuratPenandatanganSettings>(penandatanganSettings || {})
  const [isSavingSigner, setIsSavingSigner] = useState(false)
  const [signerMessage, setSignerMessage] = useState<{ success?: string; error?: string } | null>(null)

  const printRef = useRef<HTMLDivElement>(null)
  const reprintRef = useRef<HTMLDivElement>(null)

  const siswaOptions = useMemo(() => masterData.siswa.map((s: any) => ({
    value: s.id,
    label: s.nama_lengkap,
    sub: s.tingkat ? `Kelas ${formatNamaKelas(s.tingkat, s.nomor_kelas, s.kelompok)}` : 'Belum ada kelas',
  })), [masterData.siswa])

  const guruOptions = useMemo(() => masterData.guru.map((g: any) => ({
    value: g.id,
    label: g.nama_lengkap,
    sub: [g.jabatan_cetak || g.jabatan_struktural_nama, g.nip].filter(Boolean).join(' | ') || g.role || '',
  })), [masterData.guru])

  const pejabatOptions = useMemo(() => masterData.pejabat.map((p: any) => ({
    value: p.user_id || p.id,
    label: p.nama_lengkap,
    sub: [p.jabatan_cetak || p.jabatan_struktural_nama || p.nama, p.nip].filter(Boolean).join(' | ') || p.role || '',
  })), [masterData.pejabat])

  const selectedSiswa = formData.siswa_id ? masterData.siswa.find((s: any) => s.id === formData.siswa_id) : null

  const findPejabat = (key: 'kepala' | 'kepala_tu' | 'waka_kesiswaan' | 'waka_kurikulum') => {
    const all = masterData.pejabat || []
    const configured = signerSettings[key]
    if (configured) {
      const picked = all.find((p: any) => p.user_id === configured || p.id === configured)
      if (picked) return picked
    }
    const lower = (v: any) => String(v || '').toLowerCase()
    const jab = (p: any) => lower([p.jabatan_struktural_nama, p.jabatan_cetak, p.nama].filter(Boolean).join(' '))
    if (key === 'kepala') {
      return all.find((p: any) => jab(p).includes('kepala madrasah')) || all.find((p: any) => p.role === 'kepsek') || {}
    }
    if (key === 'kepala_tu') {
      return all.find((p: any) => jab(p).includes('kepala tu')) || all.find((p: any) => p.role === 'admin_tu') || {}
    }
    if (key === 'waka_kurikulum') {
      return all.find((p: any) => jab(p).includes('kurikulum')) || all.find((p: any) => p.role === 'wakamad' && jab(p).includes('kurikulum')) || {}
    }
    return all.find((p: any) => jab(p).includes('kesiswaan')) || all.find((p: any) => p.role === 'wakamad' && jab(p).includes('siswa')) || {}
  }

  const buildPejabatMap = () => ({
    kepala: findPejabat('kepala'),
    kepala_tu: findPejabat('kepala_tu'),
    waka_kesiswaan: findPejabat('waka_kesiswaan'),
    waka_kurikulum: findPejabat('waka_kurikulum'),
  })

  const updateField = (key: string, value: any) => {
    setSaveResult(null)
    setFormData(prev => ({ ...prev, [key]: value }))
  }
  const updatePrintSetting = (path: string, value: string) => {
    setSaveResult(null)
    setFormData(prev => {
      const current = getPrintSettings(prev)
      if (path === 'paper') return { ...prev, print_settings: { ...current, paper: value } }
      return {
        ...prev,
        print_settings: {
          ...current,
          margins: { ...current.margins, [path]: Number(value) || 0 },
        },
      }
    })
  }

  const buildDefaultNomor = (type: JenisSurat | null) => {
    const d = formData.tanggal_surat_raw ? new Date(formData.tanggal_surat_raw) : new Date()
    const bulan = BULAN_ROMAWI[d.getMonth() + 1] || String(d.getMonth() + 1)
    const tahun = d.getFullYear()
    const kode = type ? KODE_KLASIFIKASI_SURAT[type] : 'PP.00.6'
    return `${formData.nomor_urut_manual || '___'}/Ma.10.20/${kode}/${bulan}/${tahun}`
  }

  const buildTemplateData = (nomorSurat?: string) => {
    const base: Record<string, any> = {
      ...formData,
      nomor_surat: nomorSurat || saveResult?.nomor_surat || buildDefaultNomor(wizardType),
      pejabat: buildPejabatMap(),
      print_settings: getPrintSettings(formData),
    }

    if (selectedSiswa) base.siswa = selectedSiswa

    if (wizardType === 'sppd' && formData.guru_id) {
      const g = masterData.guru.find((item: any) => item.id === formData.guru_id)
      if (g) base.pegawai = g
    }

    if (wizardType === 'sppd') {
      const pengikutSiswa = (formData.pengikut_siswa_ids || []).map((id: string) => {
        const s = masterData.siswa.find((item: any) => item.id === id)
        return s ? { nama: s.nama_lengkap, tanggal_lahir: s.tanggal_lahir, keterangan: s.tingkat ? `Kelas ${formatNamaKelas(s.tingkat, s.nomor_kelas, s.kelompok)}` : 'Siswa' } : null
      }).filter(Boolean)
      const pengikutGuru = (formData.pengikut_guru_ids || []).map((id: string) => {
        const g = masterData.guru.find((item: any) => item.id === id)
        return g ? { nama: g.nama_lengkap, tanggal_lahir: g.tanggal_lahir, keterangan: g.jabatan_cetak || g.jabatan_struktural_nama || g.role || 'Pegawai' } : null
      }).filter(Boolean)
      base.daftar_pengikut = [...pengikutSiswa, ...pengikutGuru]
    }

    if (wizardType === 'surat_tugas') {
      base.daftar_guru = (formData.guru_ids || []).map((id: string) => {
        const g = masterData.guru.find((item: any) => item.id === id)
        return g ? { nama: g.nama_lengkap, jabatan: g.jabatan_cetak || g.jabatan_struktural_nama || g.role, nip: g.nip } : null
      }).filter(Boolean)
    }

    if (wizardType === 'izin_pesantren') {
      base.daftar_siswa = (formData.siswa_ids || []).map((id: string) => {
        const s = masterData.siswa.find((item: any) => item.id === id)
        return s ? { nama: s.nama_lengkap, kelas: s.tingkat ? `Kelas ${formatNamaKelas(s.tingkat, s.nomor_kelas, s.kelompok)}` : '' } : null
      }).filter(Boolean)
    }

    return base
  }

  const previewData = wizardType ? buildTemplateData(saveResult?.nomor_surat) : null
  const previewSettings = getPrintSettings(previewData || formData)
  const reprintSettings = getPrintSettings(reprintData)

  const handlePrint = useReactToPrint({ contentRef: printRef, pageStyle: getPrintPageStyle(previewSettings) })
  const handleReprint = useReactToPrint({ contentRef: reprintRef, pageStyle: getPrintPageStyle(reprintSettings) })

  const openWizard = (type: JenisSurat) => {
    setWizardType(type)
    setFormData({
      print_settings: DEFAULT_PRINT_SETTINGS,
      lampiran: '-',
      tempat_berangkat: 'Sukamanah',
      tempat: type === 'panggilan_ortu' ? 'Ruang BK' : '',
      tingkat_biaya: 'Biasa',
      alat_angkut: 'Kendaraan Pribadi',
      tanggal_surat_raw: new Date().toISOString().slice(0, 10),
      tanggal_surat: formatTanggalIndo(new Date().toISOString()),
    })
    setSaveResult(null)
    setWizardOpen(true)
  }

  const closeWizard = () => {
    setWizardOpen(false)
    setWizardType(null)
    setFormData({})
    setSaveResult(null)
  }

  const handleSaveAndPreview = async () => {
    if (!wizardType) return
    setIsSaving(true)
    const dataSurat = buildTemplateData()
    const result = await simpanSuratKeluar({
      jenis_surat: wizardType,
      perihal: formData.perihal || JENIS_SURAT_LABEL[wizardType],
      data_surat: dataSurat,
      dicetak_oleh: currentUser.id,
      nama_pencetak: currentUser.nama,
      nomor_urut_manual: formData.nomor_urut_manual,
    })
    setSaveResult(result)
    setIsSaving(false)
    if (result.success) {
      refreshLog()
    }
  }

  const refreshLog = async () => {
    setIsFilterLoading(true)
    const data = await getSuratKeluar({
      jenis_surat: filterJenis as JenisSurat || undefined,
      tahun: filterTahun ? parseInt(filterTahun) : undefined,
      bulan: filterBulan ? parseInt(filterBulan) : undefined,
    })
    setLogData(data)
    setCurrentPage(1)
    setIsFilterLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin hapus surat ini dari log?')) return
    const r = await hapusSuratKeluar(id)
    if (r.success) {
      refreshLog()
      setSelectedIds([])
    }
  }

  const handleDeleteBatch = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`Yakin hapus ${selectedIds.length} surat yang dipilih dari log?`)) return
    setIsFilterLoading(true)
    const r = await hapusSuratKeluarBatch(selectedIds)
    if (r.success) {
      refreshLog()
      setSelectedIds([])
    }
    setIsFilterLoading(false)
  }

  const handleSaveSignerSettings = async () => {
    setIsSavingSigner(true)
    const result = await simpanSuratPenandatanganSettings(signerSettings)
    setSignerMessage(result)
    setIsSavingSigner(false)
  }

  const handleReprintOpen = (surat: any) => {
    try {
      const parsed = typeof surat.data_surat === 'string' ? JSON.parse(surat.data_surat) : surat.data_surat
      setReprintData({
        pejabat: buildPejabatMap(),
        print_settings: DEFAULT_PRINT_SETTINGS,
        ...parsed,
        nomor_surat: surat.nomor_surat,
      })
      setReprintType(surat.jenis_surat === 'pindah' ? 'mutasi_keluar' : surat.jenis_surat as JenisSurat)
      setReprintOpen(true)
    } catch { /* ignore broken log row */ }
  }

  const totalPages = Math.ceil(logData.length / perPage)
  const paginatedLog = logData.slice((currentPage - 1) * perPage, currentPage * perPage)

  const renderFormFields = () => {
    if (!wizardType) return null
    const config = SURAT_CONFIGS.find(c => c.id === wizardType)!

    return (
      <div className="max-h-[78vh] space-y-3 overflow-y-auto pr-1">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/20">
          <Field label="No. Surat (bagian depan)" field="nomor_urut_manual" formData={formData} onChange={updateField} placeholder="Contoh: B-762 atau B.722" />
          <p className="mt-1 text-[10px] italic text-amber-700/80">Format otomatis: {buildDefaultNomor(wizardType)}</p>
        </div>

        <PrintSettingsPanel settings={getPrintSettings(formData)} onChange={updatePrintSetting} />

        {config.needsSiswa && (
          <SearchableSelect label="Pilih Siswa" options={siswaOptions} value={formData.siswa_id || ''} onChange={v => updateField('siswa_id', v)} placeholder="Cari nama siswa..." />
        )}

        {config.needsGuru && !config.multiGuru && (
          <SearchableSelect label={wizardType === 'sppd' ? 'Pegawai yang melakukan perjalanan dinas' : 'Pilih Pegawai'} options={guruOptions} value={formData.guru_id || ''} onChange={v => updateField('guru_id', v)} placeholder="Cari nama pegawai..." />
        )}

        {config.multiGuru && (
          <div>
            <Label className="text-xs font-medium">Pilih Pegawai (bisa lebih dari satu)</Label>
            <SearchMulti options={guruOptions} selected={formData.guru_ids || []} onChange={v => updateField('guru_ids', v)} />
          </div>
        )}

        {wizardType === 'ket_aktif' && (
          <Field label="Tahun Pelajaran" field="tahun_pelajaran" formData={formData} onChange={updateField} placeholder="2025/2026" />
        )}

        {wizardType === 'mutasi_keluar' && (
          <>
            <Field label="Sekolah Tujuan" field="sekolah_tujuan" formData={formData} onChange={updateField} placeholder="SMA/MA tujuan" />
            <Field label="Alasan Pindah" field="alasan_pindah" formData={formData} onChange={updateField} placeholder="Permohonan Orang Tua" />
            <Field label="Alamat Orang Tua/Wali (opsional override)" field="alamat_ortu" formData={formData} onChange={updateField} textarea />
          </>
        )}

        {wizardType === 'mutasi_masuk' && (
          <>
            <Field label="Nama Calon Siswa" field="nama_calon_siswa" formData={formData} onChange={updateField} />
            <Field label="Tempat Tanggal Lahir" field="ttl_calon_siswa" formData={formData} onChange={updateField} placeholder="Bogor, 24 November 2009" />
            <Field label="Kelas Tujuan" field="kelas_tujuan" formData={formData} onChange={updateField} placeholder="10" />
            <Field label="Asal Sekolah" field="asal_sekolah" formData={formData} onChange={updateField} />
          </>
        )}

        {wizardType === 'penelitian' && (
          <>
            <Field label="Instansi/Universitas" field="instansi_peneliti" formData={formData} onChange={updateField} />
            <Field label="Nomor Surat Pengantar" field="nomor_surat_pengantar" formData={formData} onChange={updateField} />
            <Field label="Tanggal Surat Pengantar" field="tanggal_surat_pengantar" formData={formData} onChange={updateField} placeholder="30 April 2026" />
            <Field label="Perihal Pengantar" field="perihal_pengantar" formData={formData} onChange={updateField} placeholder="Permohonan Izin Penelitian Skripsi" />
            <Field label="Nama Peneliti" field="nama_peneliti" formData={formData} onChange={updateField} />
            <Field label="NIM" field="nim_peneliti" formData={formData} onChange={updateField} />
            <Field label="Label Prodi" field="label_prodi" formData={formData} onChange={updateField} placeholder="Jurusan/ Prodi" />
            <Field label="Prodi/Konsentrasi" field="prodi_peneliti" formData={formData} onChange={updateField} />
            <Field label="Jenis Kegiatan" field="jenis_kegiatan" formData={formData} onChange={updateField} placeholder="observasi/penelitian" />
            <Field label="Tanggal/Rentang Penelitian" field="tanggal_penelitian" formData={formData} onChange={updateField} placeholder="13 April s.d 07 Mei 2026" />
            <Field label="Metode Penelitian" field="metode_penelitian" formData={formData} onChange={updateField} placeholder="Wawancara, Observasi dan Dokumentasi" />
            <Field label="Tujuan Penelitian" field="tujuan_penelitian" formData={formData} onChange={updateField} placeholder="menyusun skripsi" />
            <Field label="Judul/Tema Penelitian" field="judul_penelitian" formData={formData} onChange={updateField} textarea />
          </>
        )}

        {wizardType === 'panggilan_ortu' && (
          <>
            <Field label="Lampiran" field="lampiran" formData={formData} onChange={updateField} placeholder="-" />
            <Field label="Perihal" field="perihal" formData={formData} onChange={updateField} placeholder="Surat Panggilan" />
            <Field label="Nama Siswa di Tujuan (opsional override)" field="nama_siswa_panggilan" formData={formData} onChange={updateField} placeholder={selectedSiswa?.nama_lengkap || ''} />
            <Field label="Hari/Tanggal" field="hari_tanggal" formData={formData} onChange={updateField} placeholder="Senin, 11 Mei 2026" />
            <Field label="Waktu" field="waktu" formData={formData} onChange={updateField} placeholder="08.00 - Selesai" />
            <Field label="Tempat" field="tempat" formData={formData} onChange={updateField} placeholder="Ruang BK" />
          </>
        )}

        {wizardType === 'sppd' && (
          <>
            <Field label="Maksud Perjalanan Dinas" field="maksud_perjalanan" formData={formData} onChange={updateField} />
            <Field label="Tempat Berangkat" field="tempat_berangkat" formData={formData} onChange={updateField} placeholder="Sukamanah" />
            <Field label="Tempat Tujuan" field="tempat_tujuan" formData={formData} onChange={updateField} />
            <Field label="Tanggal Berangkat" type="date" field="tanggal_berangkat" formData={formData} onChange={updateField} />
            <Field label="Tanggal Kembali" type="date" field="tanggal_kembali" formData={formData} onChange={updateField} />
            <Field label="Lama Perjalanan" field="lama_perjalanan" formData={formData} onChange={updateField} placeholder="1 (satu) Hari" />
            <Field label="Alat Kendaraan" field="alat_angkut" formData={formData} onChange={updateField} placeholder="Kendaraan Pribadi" />
            <Field label="Tingkat Biaya" field="tingkat_biaya" formData={formData} onChange={updateField} placeholder="Biasa" />
            <div>
              <Label className="text-xs font-medium">Pengikut Siswa</Label>
              <SearchMulti options={siswaOptions} selected={formData.pengikut_siswa_ids || []} onChange={v => updateField('pengikut_siswa_ids', v)} />
            </div>
            <div>
              <Label className="text-xs font-medium">Pengikut Guru/Pegawai</Label>
              <SearchMulti options={guruOptions} selected={formData.pengikut_guru_ids || []} onChange={v => updateField('pengikut_guru_ids', v)} />
            </div>
            <Field label="Pengikut Manual (Nama, Tanggal lahir, Keterangan)" field="pengikut" formData={formData} onChange={updateField} placeholder="Contoh: Ahmad Fauzi, 12/03/2008, Siswa" textarea />
            <Field label="Pembebanan Anggaran" field="pembebanan_anggaran" formData={formData} onChange={updateField} />
            <Field label="Mata Anggaran" field="mata_anggaran" formData={formData} onChange={updateField} />
            <Field label="Keterangan Lain" field="keterangan_lain" formData={formData} onChange={updateField} />
          </>
        )}

        {wizardType === 'penerimaan' && (
          <>
            <Field label="Tanggal Diterima" type="date" field="tanggal_terima" formData={formData} onChange={updateField} />
            <Field label="Tahun Pelajaran" field="tahun_pelajaran" formData={formData} onChange={updateField} placeholder="2025/2026" />
          </>
        )}

        {wizardType === 'izin_pesantren' && (
          <>
            <div>
              <Label className="text-xs font-medium">Daftar Siswa (bisa lebih dari satu)</Label>
              <SearchMulti options={siswaOptions} selected={formData.siswa_ids || []} onChange={v => updateField('siswa_ids', v)} />
            </div>
            <Field label="Tujuan Surat" field="tujuan_surat" formData={formData} onChange={updateField} />
            <Field label="Keperluan / Alasan" field="keperluan" formData={formData} onChange={updateField} />
            <Field label="Hari, Tanggal" field="hari_tanggal" formData={formData} onChange={updateField} />
            <Field label="Waktu" field="waktu" formData={formData} onChange={updateField} />
            <Field label="Tempat" field="tempat" formData={formData} onChange={updateField} />
          </>
        )}

        {(wizardType === 'permohonan' || wizardType === 'undangan_rapat') && (
          <>
            <Field label="Tujuan Surat" field="tujuan_surat" formData={formData} onChange={updateField} />
            <Field label="Perihal" field="perihal" formData={formData} onChange={updateField} />
            <Field label="Lampiran" field="lampiran" formData={formData} onChange={updateField} placeholder="-" />
            <Field label={wizardType === 'undangan_rapat' ? 'Keterangan Pembuka' : 'Isi Surat'} field="isi_surat" formData={formData} onChange={updateField} textarea />
            <Field label="Hari/Tanggal Kegiatan" field="hari_tanggal" formData={formData} onChange={updateField} />
            <Field label="Waktu" field="waktu" formData={formData} onChange={updateField} />
            <Field label="Tempat" field="tempat" formData={formData} onChange={updateField} />
            {wizardType === 'undangan_rapat'
              ? <Field label="Agenda" field="agenda" formData={formData} onChange={updateField} />
              : <Field label="Isi Tambahan" field="isi_tambahan" formData={formData} onChange={updateField} textarea />}
          </>
        )}

        {wizardType === 'surat_tugas' && (
          <>
            <Field label="Dasar Surat" field="dasar_surat" formData={formData} onChange={updateField} textarea />
            <Field label="Tujuan Penugasan" field="tujuan_tugas" formData={formData} onChange={updateField} />
            <Field label="Tanggal Kegiatan" field="tanggal_kegiatan" formData={formData} onChange={updateField} />
            <Field label="Tempat Kegiatan" field="tempat_kegiatan" formData={formData} onChange={updateField} />
          </>
        )}

        {wizardType === 'pernyataan' && (
          <>
            <Field label="Nama Orang Tua/Wali" field="nama_ortu" formData={formData} onChange={updateField} placeholder={selectedSiswa?.nama_ayah || ''} />
            <Field label="Alamat Orang Tua/Wali" field="alamat_ortu" formData={formData} onChange={updateField} textarea />
            <Field label="No. KTP" field="no_ktp" formData={formData} onChange={updateField} placeholder={selectedSiswa?.nik_ayah || ''} />
            <Field label="Tahun Pelajaran" field="tahun_pelajaran" formData={formData} onChange={updateField} placeholder="2025/2026" />
          </>
        )}

        <Field
          label="Tanggal Surat"
          type="date"
          field="tanggal_surat_raw"
          formData={formData}
          onChange={(k, v) => { updateField(k, v); updateField('tanggal_surat', formatTanggalIndo(v)) }}
        />
      </div>
    )
  }

  return (
    <>
      <TabsPrimitive.Root value={activeTab} onValueChange={setActiveTab}>
        <TabsPrimitive.List className="flex w-fit gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          <TabsPrimitive.Trigger value="buat" className="rounded-md px-4 py-1.5 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-700">
            <Plus className="mr-1.5 inline h-3.5 w-3.5" />Buat Surat
          </TabsPrimitive.Trigger>
          <TabsPrimitive.Trigger value="log" className="rounded-md px-4 py-1.5 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-700">
            <FileText className="mr-1.5 inline h-3.5 w-3.5" />Log Surat Keluar
          </TabsPrimitive.Trigger>
          <TabsPrimitive.Trigger value="penandatangan" className="rounded-md px-4 py-1.5 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-700">
            <FileSignature className="mr-1.5 inline h-3.5 w-3.5" />Penandatangan
          </TabsPrimitive.Trigger>
        </TabsPrimitive.List>

        <TabsPrimitive.Content value="buat" className="mt-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {SURAT_CONFIGS.map(cfg => {
              const Icon = cfg.icon
              const c = COLOR_MAP[cfg.color] || COLOR_MAP.amber
              return (
                <button key={cfg.id} onClick={() => openWizard(cfg.id)} className={`group flex flex-col items-start gap-3 rounded-xl border bg-white p-4 text-left transition-all hover:shadow-lg dark:bg-slate-900 ${c.border}`}>
                  <div className={`rounded-lg p-2 transition-transform group-hover:scale-110 ${c.iconBg}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold leading-tight text-slate-800 dark:text-slate-100">{cfg.label}</p>
                    <p className="mt-0.5 text-[10px] leading-snug text-slate-400 dark:text-slate-500">{cfg.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </TabsPrimitive.Content>

        <TabsPrimitive.Content value="penandatangan" className="mt-4">
          <div className="max-w-3xl rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Pejabat Penandatangan Surat</h3>
              <p className="mt-1 text-xs text-slate-500">Pilihan ini menjadi acuan utama untuk tanda tangan surat. Jika kosong, sistem tetap memakai fallback dari jabatan cetak/role.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <SearchableSelect label="Kepala Madrasah" options={pejabatOptions} value={signerSettings.kepala || ''} onChange={v => { setSignerMessage(null); setSignerSettings(prev => ({ ...prev, kepala: v })) }} placeholder="Pilih Kepala Madrasah" />
              <SearchableSelect label="Kepala TU / PPK SPPD" options={pejabatOptions} value={signerSettings.kepala_tu || ''} onChange={v => { setSignerMessage(null); setSignerSettings(prev => ({ ...prev, kepala_tu: v })) }} placeholder="Pilih Kepala TU" />
              <SearchableSelect label="Waka Kesiswaan" options={pejabatOptions} value={signerSettings.waka_kesiswaan || ''} onChange={v => { setSignerMessage(null); setSignerSettings(prev => ({ ...prev, waka_kesiswaan: v })) }} placeholder="Pilih Waka Kesiswaan" />
              <SearchableSelect label="Waka Kurikulum" options={pejabatOptions} value={signerSettings.waka_kurikulum || ''} onChange={v => { setSignerMessage(null); setSignerSettings(prev => ({ ...prev, waka_kurikulum: v })) }} placeholder="Pilih Waka Kurikulum" />
            </div>
            <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              {signerMessage?.success && <span className="mr-auto text-xs text-emerald-600">{signerMessage.success}</span>}
              {signerMessage?.error && <span className="mr-auto text-xs text-red-500">{signerMessage.error}</span>}
              <Button size="sm" onClick={handleSaveSignerSettings} disabled={isSavingSigner} className="bg-amber-600 text-white hover:bg-amber-700">
                {isSavingSigner && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                Simpan Penandatangan
              </Button>
            </div>
          </div>
        </TabsPrimitive.Content>

        <TabsPrimitive.Content value="log" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <Label className="text-[10px] text-slate-500">Jenis Surat</Label>
              <select className="mt-0.5 block rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900" value={filterJenis} onChange={e => setFilterJenis(e.target.value)}>
                <option value="">Semua</option>
                {Object.entries(JENIS_SURAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-[10px] text-slate-500">Bulan</Label>
              <select className="mt-0.5 block rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900" value={filterBulan} onChange={e => setFilterBulan(e.target.value)}>
                <option value="">Semua</option>
                {BULAN_NAMES.slice(1).map((b, i) => <option key={i + 1} value={String(i + 1)}>{b}</option>)}
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
              <select className="mt-0.5 block rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900" value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setCurrentPage(1) }}>
                {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            {selectedIds.length > 0 && (
              <div className="flex items-center justify-between border-b border-red-100 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950/20">
                <span className="text-xs font-semibold text-red-700 dark:text-red-400">{selectedIds.length} item dipilih</span>
                <Button size="sm" variant="destructive" onClick={handleDeleteBatch} className="h-7 px-3 text-xs">
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Hapus Terpilih
                </Button>
              </div>
            )}
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-left dark:bg-slate-800">
                  <th className="w-[30px] px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={paginatedLog.length > 0 && paginatedLog.every((l: any) => selectedIds.includes(l.id))}
                      onChange={e => {
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
                  <th className="px-3 py-2 text-center font-medium text-slate-500">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLog.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">Belum ada surat yang tercatat.</td></tr>
                ) : paginatedLog.map((s: any) => (
                  <tr key={s.id} className={`border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50 ${selectedIds.includes(s.id) ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" className="rounded" checked={selectedIds.includes(s.id)} onChange={() => setSelectedIds(prev => prev.includes(s.id) ? prev.filter(i => i !== s.id) : [...prev, s.id])} />
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px]">{s.nomor_surat}</td>
                    <td className="px-3 py-2">
                      <span className="inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                        {JENIS_SURAT_LABEL[s.jenis_surat as JenisSurat] || s.jenis_surat}
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-slate-600 dark:text-slate-400">{s.perihal || '-'}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{s.nama_pencetak || '-'}</td>
                    <td className="px-3 py-2 text-slate-500">
                      {s.created_at ? new Date(s.created_at + 'Z').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => handleReprintOpen(s)} className="text-blue-400 transition-colors hover:text-blue-600" title="Cetak Ulang">
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(s.id)} className="text-red-400 transition-colors hover:text-red-600" title="Hapus">
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
              <span>Menampilkan {(currentPage - 1) * perPage + 1}-{Math.min(currentPage * perPage, logData.length)} dari {logData.length}</span>
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

      <DialogPrimitive.Root open={wizardOpen} onOpenChange={v => !v && closeWizard()}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogPrimitive.Content className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto pb-[3vh] pt-[3vh]">
            <div className="mx-3 w-full max-w-[calc(100vw-32px)] rounded-xl bg-white shadow-2xl dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{wizardType ? JENIS_SURAT_LABEL[wizardType] : 'Buat Surat'}</h3>
                  {saveResult?.nomor_surat && <span className="rounded bg-amber-50 px-2 py-0.5 font-mono text-[10px] text-amber-600 dark:bg-amber-950/40">{saveResult.nomor_surat}</span>}
                </div>
                <DialogPrimitive.Close className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                  <X className="h-4 w-4" />
                </DialogPrimitive.Close>
              </div>
              <div className="grid gap-4 px-5 py-4 xl:grid-cols-[420px_minmax(0,1fr)]">
                <div className="min-w-0">
                  {renderFormFields()}
                  <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <Button variant="outline" size="sm" onClick={closeWizard}>Batal</Button>
                    <Button size="sm" variant="outline" onClick={handleSaveAndPreview} disabled={isSaving}>
                      {isSaving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1 h-3.5 w-3.5" />}Simpan ke Log
                    </Button>
                    <Button size="sm" onClick={() => handlePrint()} disabled={!wizardType || !previewData} className="bg-emerald-600 text-white hover:bg-emerald-700">
                      <Printer className="mr-1 h-3.5 w-3.5" /> Cetak PDF
                    </Button>
                  </div>
                  {saveResult?.success && <p className="mt-2 text-xs text-emerald-600">{saveResult.success}</p>}
                  {saveResult?.error && <p className="mt-2 text-xs text-red-500">{saveResult.error}</p>}
                </div>

                <div className="min-w-0">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Preview Live</p>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800">
                      {previewSettings.paper} | {previewSettings.margins.top}/{previewSettings.margins.right}/{previewSettings.margins.bottom}/{previewSettings.margins.left} mm
                    </span>
                  </div>
                  <div className="max-h-[78vh] overflow-auto rounded-lg border border-slate-200 bg-gray-100 p-4 dark:border-slate-800 dark:bg-slate-800">
                    <div ref={printRef} style={{ background: '#fff' }}>
                      {wizardType && previewData && (() => {
                        const Tpl = TEMPLATE_MAP[wizardType]
                        return Tpl ? <Tpl data={previewData} /> : <p>Template tidak ditemukan</p>
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <DialogPrimitive.Root open={reprintOpen} onOpenChange={v => !v && setReprintOpen(false)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogPrimitive.Content className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto pb-[3vh] pt-[3vh]">
            <div className="mx-3 w-full max-w-[240mm] rounded-xl bg-white shadow-2xl dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-blue-500" />
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Cetak Ulang Surat</h3>
                  {reprintData?.nomor_surat && <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-[10px] text-blue-600 dark:bg-blue-950/40">{reprintData.nomor_surat}</span>}
                </div>
                <DialogPrimitive.Close className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                  <X className="h-4 w-4" />
                </DialogPrimitive.Close>
              </div>
              <div className="px-5 py-4">
                <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200 bg-gray-100 p-4 dark:border-slate-800 dark:bg-slate-800">
                  <div ref={reprintRef} style={{ background: '#fff' }}>
                    {reprintType && reprintData && (() => {
                      const Tpl = TEMPLATE_MAP[reprintType]
                      return Tpl ? <Tpl data={reprintData} /> : <p>Template tidak ditemukan</p>
                    })()}
                  </div>
                </div>
                <div className="mt-4 flex justify-end border-t border-slate-100 pt-3 dark:border-slate-800">
                  <Button size="sm" onClick={() => handleReprint()} className="bg-emerald-600 text-white hover:bg-emerald-700"><Printer className="mr-1 h-3.5 w-3.5" /> Cetak PDF</Button>
                </div>
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  )
}

function PrintSettingsPanel({ settings, onChange }: { settings: PrintSettings; onChange: (path: string, value: string) => void }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="mb-2 flex items-center gap-2">
        <Printer className="h-3.5 w-3.5 text-slate-500" />
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Pengaturan Cetak</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <div>
          <Label className="text-[10px]">Kertas</Label>
          <select className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs dark:border-slate-800 dark:bg-slate-900" value={settings.paper} onChange={e => onChange('paper', e.target.value)}>
            <option value="A4">A4</option>
            <option value="F4">F4/Folio</option>
          </select>
        </div>
        <SmallNumber label="Atas" value={settings.margins.top} onChange={v => onChange('top', v)} />
        <SmallNumber label="Kanan" value={settings.margins.right} onChange={v => onChange('right', v)} />
        <SmallNumber label="Bawah" value={settings.margins.bottom} onChange={v => onChange('bottom', v)} />
        <SmallNumber label="Kiri" value={settings.margins.left} onChange={v => onChange('left', v)} />
      </div>
    </div>
  )
}

function SmallNumber({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-[10px]">{label} (mm)</Label>
      <Input type="number" min={0} max={50} className="mt-1 h-8 text-xs" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  )
}

function Field({ label, field, formData, onChange, type = 'text', placeholder, textarea }: {
  label: string
  field: string
  formData: any
  onChange: (k: string, v: any) => void
  type?: string
  placeholder?: string
  textarea?: boolean
}) {
  return (
    <div>
      <Label className="text-xs font-medium">{label}</Label>
      {textarea ? (
        <textarea className="mt-1 min-h-[68px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900" value={formData[field] || ''} onChange={e => onChange(field, e.target.value)} placeholder={placeholder} />
      ) : (
        <Input type={type} className="mt-1" value={formData[field] || ''} onChange={e => onChange(field, e.target.value)} placeholder={placeholder} />
      )}
    </div>
  )
}
