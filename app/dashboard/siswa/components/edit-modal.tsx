'use client'

import { useEffect, useRef, useState } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, AlertCircle, CheckCircle2, UserCog, MapPin, Users } from 'lucide-react'
import { editSiswaLengkap } from '../actions'
import { formatNamaKelas } from '@/lib/utils'
import { dateToInputFormatSafe } from '@/lib/time'

const initialState = { error: null as string | null, success: null as string | null }

const AGAMA_OPTIONS = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu']
const STATUS_SISWA_OPTIONS = [
  { value: 'aktif', label: 'Aktif' },
  { value: 'lulus', label: 'Lulus' },
  { value: 'pindah', label: 'Pindah' },
  { value: 'keluar', label: 'Keluar/DO' },
]
const STATUS_ANAK_OPTIONS = ['Anak Kandung', 'Anak Tiri', 'Anak Angkat']
const TEMPAT_TINGGAL_OPTIONS = [
  'Non-Pesantren',
  'Pesantren Sukahideng',
  'Pesantren Sukamanah',
  'Pesantren Sukaguru',
  "Pesantren Al-Ma'mur",
]
const STATUS_ORTU_OPTIONS = ['Hidup', 'Meninggal', 'Tidak Diketahui']

function normalizeStatusAnak(value: string | null | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed) return 'Anak Kandung'
  const lower = trimmed.toLowerCase()
  if (lower === 'kandung' || lower === 'anak kandung') return 'Anak Kandung'
  if (lower === 'tiri' || lower === 'anak tiri') return 'Anak Tiri'
  if (lower === 'angkat' || lower === 'anak angkat') return 'Anak Angkat'
  return trimmed
}

function buildOptions(presets: string[], currentValue: string): string[] {
  if (!currentValue || presets.includes(currentValue)) return presets
  return [...presets, currentValue]
}

function SubmitBtn() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full h-9 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md">
      {pending ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Menyimpan...</> : 'Simpan Perubahan'}
    </Button>
  )
}

function EditSiswaForm({ siswa, kelasList, onClose }: {
  siswa: any; kelasList: any[]; onClose: () => void
}) {
  const [state, formAction] = useActionState(editSiswaLengkap, initialState)
  const [activeTab, setActiveTab] = useState('utama')
  const [clientError, setClientError] = useState<string | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (state?.success) {
      const timer = setTimeout(() => onCloseRef.current(), 1500)
      return () => clearTimeout(timer)
    }
  }, [state?.success])

  const defaultAgama = siswa.agama?.trim() || 'Islam'
  const defaultStatusAnak = normalizeStatusAnak(siswa.status_anak)
  const defaultTempatTinggal = siswa.tempat_tinggal?.trim() || 'Non-Pesantren'
  const defaultStatusSiswa = siswa.status?.trim() || 'aktif'
  const defaultStatusAyah = siswa.status_ayah?.trim() || 'Hidup'
  const defaultStatusIbu = siswa.status_ibu?.trim() || 'Hidup'
  const defaultKelasId = siswa.kelas?.id || siswa.kelas_id || 'none'

  const agamaOptions = buildOptions(AGAMA_OPTIONS, defaultAgama)
  const statusAnakOptions = buildOptions(STATUS_ANAK_OPTIONS, defaultStatusAnak)
  const tempatTinggalOptions = buildOptions(TEMPAT_TINGGAL_OPTIONS, defaultTempatTinggal)
  const statusAyahOptions = buildOptions(STATUS_ORTU_OPTIONS, defaultStatusAyah)
  const statusIbuOptions = buildOptions(STATUS_ORTU_OPTIONS, defaultStatusIbu)
  const statusSiswaOptions = STATUS_SISWA_OPTIONS.some(opt => opt.value === defaultStatusSiswa)
    ? STATUS_SISWA_OPTIONS
    : [...STATUS_SISWA_OPTIONS, { value: defaultStatusSiswa, label: defaultStatusSiswa }]

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const fd = new FormData(e.currentTarget)
    const nisn = String(fd.get('nisn') ?? '').trim()
    const namaLengkap = String(fd.get('nama_lengkap') ?? '').trim()
    const tahunMasukRaw = String(fd.get('tahun_masuk') ?? '').trim()

    if (!nisn) {
      e.preventDefault()
      setActiveTab('utama')
      setClientError('NISN wajib diisi.')
      return
    }
    if (!namaLengkap) {
      e.preventDefault()
      setActiveTab('utama')
      setClientError('Nama lengkap wajib diisi.')
      return
    }
    if (tahunMasukRaw) {
      const tahunMasukNum = Number(tahunMasukRaw)
      if (!/^\d{4}$/.test(tahunMasukRaw) || tahunMasukNum < 2000 || tahunMasukNum > 2099) {
        e.preventDefault()
        setActiveTab('utama')
        setClientError('Tahun masuk (angkatan) harus berupa 4 digit antara 2000–2099.')
        return
      }
    }

    setClientError(null)
  }

  const displayedError = clientError || state?.error

  return (
    <ScrollArea className="h-[75vh]">
      <form action={formAction} onSubmit={handleSubmit} noValidate className="p-4 space-y-4">
        <input type="hidden" name="id" value={siswa.id} />

        {displayedError && (
          <div className="p-2.5 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-100 dark:border-rose-900/40 flex gap-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {displayedError}
          </div>
        )}
        {state?.success && !clientError && (
          <div className="p-2.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg border border-emerald-100 dark:border-emerald-800 flex gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {state.success}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full bg-surface-3 rounded-md p-0.5 h-8">
            <TabsTrigger value="utama" className="rounded text-xs data-[state=active]:bg-surface data-[state=active]:shadow-sm gap-1.5">
              <UserCog className="h-3 w-3" /> Utama
            </TabsTrigger>
            <TabsTrigger value="alamat" className="rounded text-xs data-[state=active]:bg-surface data-[state=active]:shadow-sm gap-1.5">
              <MapPin className="h-3 w-3" /> Alamat
            </TabsTrigger>
            <TabsTrigger value="ortu" className="rounded text-xs data-[state=active]:bg-surface data-[state=active]:shadow-sm gap-1.5">
              <Users className="h-3 w-3" /> Orang Tua
            </TabsTrigger>
          </TabsList>

          {/* TAB UTAMA — forceMount agar input di semua tab tidak ter-unmount saat pindah tab */}
          <TabsContent forceMount value="utama" className="space-y-3 mt-3 bg-surface p-3.5 rounded-lg border border-surface data-[state=inactive]:hidden">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">NISN *</Label>
                <Input name="nisn" defaultValue={siswa.nisn ?? ''} required className="h-8 text-sm rounded-md bg-surface-2" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">NIS Lokal</Label>
                <Input name="nis_lokal" defaultValue={siswa.nis_lokal ?? ''} className="h-8 text-sm rounded-md bg-surface-2" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Nama Lengkap *</Label>
              <Input name="nama_lengkap" defaultValue={siswa.nama_lengkap ?? ''} required className="h-8 text-sm rounded-md bg-surface-2" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">NIK (16 Digit)</Label>
                <Input name="nik" defaultValue={siswa.nik ?? ''} placeholder="3206..." className="h-8 text-sm rounded-md bg-surface-2" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Jenis Kelamin</Label>
                <Select name="jenis_kelamin" defaultValue={siswa.jenis_kelamin || 'L'}>
                  <SelectTrigger className="h-8 text-xs rounded-md bg-surface-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L" className="text-xs">Laki-laki</SelectItem>
                    <SelectItem value="P" className="text-xs">Perempuan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Tempat Lahir</Label>
                <Input name="tempat_lahir" defaultValue={siswa.tempat_lahir ?? ''} className="h-8 text-sm rounded-md bg-surface-2" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Tanggal Lahir</Label>
                <Input
                  type="date"
                  name="tanggal_lahir"
                  defaultValue={dateToInputFormatSafe(siswa.tanggal_lahir)}
                  className="h-8 text-xs rounded-md bg-surface-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Agama</Label>
                <Select name="agama" defaultValue={defaultAgama}>
                  <SelectTrigger className="h-8 text-xs rounded-md bg-surface-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {agamaOptions.map(opt => (
                      <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Asal Sekolah</Label>
                <Input name="asal_sekolah" defaultValue={siswa.asal_sekolah ?? ''} placeholder="cth: MTsN 1 Tasikmalaya" className="h-8 text-sm rounded-md bg-surface-2" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Tahun Masuk (Angkatan)</Label>
                <Input
                  type="number"
                  name="tahun_masuk"
                  defaultValue={siswa.tahun_masuk ?? ''}
                  min={2000}
                  max={2099}
                  placeholder="cth: 2024"
                  onWheel={e => e.currentTarget.blur()}
                  className="h-8 text-sm rounded-md bg-surface-2"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Minat Jurusan / Peminatan</Label>
                <Input name="minat_jurusan" defaultValue={siswa.minat_jurusan ?? ''} placeholder="cth: MIPA / IPS / Keagamaan" className="h-8 text-sm rounded-md bg-surface-2" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Kelas</Label>
                <Select name="kelas_id" defaultValue={defaultKelasId}>
                  <SelectTrigger className="h-8 text-xs rounded-md bg-surface-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs text-slate-400">Tanpa Kelas</SelectItem>
                    {kelasList.map(k => (
                      <SelectItem key={k.id} value={k.id} className="text-xs">
                        {formatNamaKelas(k.tingkat, k.nomor_kelas, k.kelompok)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Status Siswa</Label>
                <Select name="status" defaultValue={defaultStatusSiswa}>
                  <SelectTrigger className="h-8 text-xs rounded-md bg-surface-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statusSiswaOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Anak Ke</Label>
                <Input
                  type="number"
                  name="anak_ke"
                  defaultValue={siswa.anak_ke ?? ''}
                  min={1}
                  max={20}
                  onWheel={e => e.currentTarget.blur()}
                  className="h-8 text-sm rounded-md bg-surface-2"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Jml Saudara</Label>
                <Input
                  type="number"
                  name="jumlah_saudara"
                  defaultValue={siswa.jumlah_saudara ?? ''}
                  min={0}
                  max={20}
                  onWheel={e => e.currentTarget.blur()}
                  className="h-8 text-sm rounded-md bg-surface-2"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Status Anak</Label>
                <Select name="status_anak" defaultValue={defaultStatusAnak}>
                  <SelectTrigger className="h-8 text-xs rounded-md bg-surface-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statusAnakOptions.map(opt => (
                      <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          {/* TAB ALAMAT */}
          <TabsContent forceMount value="alamat" className="space-y-3 mt-3 bg-surface p-3.5 rounded-lg border border-surface data-[state=inactive]:hidden">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Status Domisili / Pesantren</Label>
              <Select name="tempat_tinggal" defaultValue={defaultTempatTinggal}>
                <SelectTrigger className="h-8 text-xs rounded-md bg-surface-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {tempatTinggalOptions.map(opt => (
                    <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Asrama & Kamar */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30 rounded-lg">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-amber-800 dark:text-amber-300">Asrama</Label>
                <Input name="asrama" defaultValue={siswa.asrama ?? ''} placeholder="cth: Al-Falah" className="h-8 text-sm rounded-md bg-surface" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-amber-800 dark:text-amber-300">Kamar</Label>
                <Input name="kamar" defaultValue={siswa.kamar ?? ''} placeholder="cth: 12B" className="h-8 text-sm rounded-md bg-surface" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Alamat Lengkap (Jalan/Kp/Dusun)</Label>
              <Input name="alamat_lengkap" defaultValue={siswa.alamat_lengkap ?? ''} placeholder="cth: Jl. Sukahideng No. 12" className="h-8 text-sm rounded-md bg-surface-2" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">RT</Label>
                <Input name="rt" defaultValue={siswa.rt ?? ''} placeholder="cth: 01" className="h-8 text-sm rounded-md bg-surface-2" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">RW</Label>
                <Input name="rw" defaultValue={siswa.rw ?? ''} placeholder="cth: 04" className="h-8 text-sm rounded-md bg-surface-2" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Desa / Kelurahan</Label>
                <Input name="desa_kelurahan" defaultValue={siswa.desa_kelurahan ?? ''} className="h-8 text-sm rounded-md bg-surface-2" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Kecamatan</Label>
                <Input name="kecamatan" defaultValue={siswa.kecamatan ?? ''} className="h-8 text-sm rounded-md bg-surface-2" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Kabupaten / Kota</Label>
                <Input name="kabupaten_kota" defaultValue={siswa.kabupaten_kota ?? ''} placeholder="cth: Kab. Tasikmalaya" className="h-8 text-sm rounded-md bg-surface-2" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Provinsi</Label>
                <Input name="provinsi" defaultValue={siswa.provinsi ?? ''} placeholder="cth: Jawa Barat" className="h-8 text-sm rounded-md bg-surface-2" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Kode Pos</Label>
                <Input name="kode_pos" defaultValue={siswa.kode_pos ?? ''} placeholder="cth: 46411" className="h-8 text-sm rounded-md bg-surface-2" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">No. WhatsApp Siswa</Label>
                <Input name="nomor_whatsapp" defaultValue={siswa.nomor_whatsapp ?? ''} placeholder="0812..." className="h-8 text-sm rounded-md bg-surface-2" />
              </div>
            </div>
          </TabsContent>

          {/* TAB ORANG TUA */}
          <TabsContent forceMount value="ortu" className="space-y-3 mt-3 bg-surface p-3.5 rounded-lg border border-surface data-[state=inactive]:hidden">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Nomor Kartu Keluarga (KK)</Label>
              <Input name="nomor_kk" defaultValue={siswa.nomor_kk ?? ''} placeholder="3206..." className="h-8 text-sm rounded-md bg-surface-2" />
            </div>

            {/* Box Data Ayah */}
            <div className="border border-surface p-3 rounded-lg bg-surface-2/60 space-y-3">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 border-b border-surface pb-1.5">Data Ayah</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500 dark:text-slate-400">Nama Ayah</Label>
                  <Input name="nama_ayah" defaultValue={siswa.nama_ayah ?? ''} className="h-8 text-sm rounded-md bg-surface" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500 dark:text-slate-400">NIK Ayah</Label>
                  <Input name="nik_ayah" defaultValue={siswa.nik_ayah ?? ''} placeholder="3206..." className="h-8 text-sm rounded-md bg-surface" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500 dark:text-slate-400">Status Ayah</Label>
                  <Select name="status_ayah" defaultValue={defaultStatusAyah}>
                    <SelectTrigger className="h-8 text-xs rounded-md bg-surface"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statusAyahOptions.map(opt => (
                        <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500 dark:text-slate-400">Pendidikan Terakhir</Label>
                  <Input name="pendidikan_ayah" defaultValue={siswa.pendidikan_ayah ?? ''} placeholder="cth: SMA / S1" className="h-8 text-sm rounded-md bg-surface" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500 dark:text-slate-400">Tempat Lahir Ayah</Label>
                  <Input name="tempat_lahir_ayah" defaultValue={siswa.tempat_lahir_ayah ?? ''} className="h-8 text-sm rounded-md bg-surface" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500 dark:text-slate-400">Tanggal Lahir Ayah</Label>
                  <Input
                    type="date"
                    name="tanggal_lahir_ayah"
                    defaultValue={dateToInputFormatSafe(siswa.tanggal_lahir_ayah)}
                    className="h-8 text-xs rounded-md bg-surface"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500 dark:text-slate-400">Pekerjaan Ayah</Label>
                  <Input name="pekerjaan_ayah" defaultValue={siswa.pekerjaan_ayah ?? ''} placeholder="cth: Wiraswasta" className="h-8 text-sm rounded-md bg-surface" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500 dark:text-slate-400">Penghasilan Ayah</Label>
                  <Input name="penghasilan_ayah" defaultValue={siswa.penghasilan_ayah ?? ''} placeholder="cth: Rp 3.000.000" className="h-8 text-sm rounded-md bg-surface" />
                </div>
              </div>
            </div>

            {/* Box Data Ibu */}
            <div className="border border-surface p-3 rounded-lg bg-surface-2/60 space-y-3">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 border-b border-surface pb-1.5">Data Ibu</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500 dark:text-slate-400">Nama Ibu</Label>
                  <Input name="nama_ibu" defaultValue={siswa.nama_ibu ?? ''} className="h-8 text-sm rounded-md bg-surface" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500 dark:text-slate-400">NIK Ibu</Label>
                  <Input name="nik_ibu" defaultValue={siswa.nik_ibu ?? ''} placeholder="3206..." className="h-8 text-sm rounded-md bg-surface" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500 dark:text-slate-400">Status Ibu</Label>
                  <Select name="status_ibu" defaultValue={defaultStatusIbu}>
                    <SelectTrigger className="h-8 text-xs rounded-md bg-surface"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statusIbuOptions.map(opt => (
                        <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500 dark:text-slate-400">Pendidikan Terakhir</Label>
                  <Input name="pendidikan_ibu" defaultValue={siswa.pendidikan_ibu ?? ''} placeholder="cth: SMA / S1" className="h-8 text-sm rounded-md bg-surface" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500 dark:text-slate-400">Tempat Lahir Ibu</Label>
                  <Input name="tempat_lahir_ibu" defaultValue={siswa.tempat_lahir_ibu ?? ''} className="h-8 text-sm rounded-md bg-surface" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500 dark:text-slate-400">Tanggal Lahir Ibu</Label>
                  <Input
                    type="date"
                    name="tanggal_lahir_ibu"
                    defaultValue={dateToInputFormatSafe(siswa.tanggal_lahir_ibu)}
                    className="h-8 text-xs rounded-md bg-surface"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500 dark:text-slate-400">Pekerjaan Ibu</Label>
                  <Input name="pekerjaan_ibu" defaultValue={siswa.pekerjaan_ibu ?? ''} placeholder="cth: Ibu Rumah Tangga" className="h-8 text-sm rounded-md bg-surface" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500 dark:text-slate-400">Penghasilan Ibu</Label>
                  <Input name="penghasilan_ibu" defaultValue={siswa.penghasilan_ibu ?? ''} placeholder="cth: Tidak Ada" className="h-8 text-sm rounded-md bg-surface" />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <SubmitBtn />
      </form>
    </ScrollArea>
  )
}

export function EditSiswaModal({ isOpen, onClose, siswa, kelasList }: {
  isOpen: boolean; onClose: () => void; siswa: any; kelasList: any[]
}) {
  if (!siswa) return null

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl rounded-xl p-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 bg-surface border-b border-surface">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <UserCog className="h-4 w-4 text-blue-600" /> Edit Biodata — <span className="text-blue-600 truncate max-w-[200px]">{siswa.nama_lengkap}</span>
          </DialogTitle>
        </DialogHeader>

        {isOpen && (
          <EditSiswaForm
            key={siswa.id}
            siswa={siswa}
            kelasList={kelasList}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
