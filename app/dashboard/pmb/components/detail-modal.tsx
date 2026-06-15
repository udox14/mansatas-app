'use client'

import { useEffect, useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Loader2, FileText, ExternalLink, CheckCircle2, XCircle, RefreshCw,
  Edit2, Save, X, Eye, MessageCircle, Award, CalendarClock,
} from 'lucide-react'
import {
  getDetailPendaftar, editPendaftar, verifikasiBerkas, setKelulusan,
  bulkAlihReguler, setJadwalPendaftar, setFlagBerkas,
} from '../actions'
import { JalurBadge, VerifBadge, LulusBadge } from './pmb-client'
import type { Pendaftar } from './pmb-client'

function isImageFile(url: string) {
  if (!url) return false
  const clean = url.split('?')[0].toLowerCase()
  return clean.endsWith('.jpg') || clean.endsWith('.jpeg') || clean.endsWith('.png') ||
    clean.endsWith('.webp') || clean.endsWith('.gif') || !clean.endsWith('.pdf')
}

const BERKAS_DEF: { key: string; label: string }[] = [
  { key: 'foto_url', label: 'Pas Foto' },
  { key: 'scan_kk_url', label: 'Kartu Keluarga' },
  { key: 'scan_akta_url', label: 'Akta Kelahiran' },
  { key: 'scan_kelakuan_baik_url', label: 'Surat Kelakuan Baik' },
  { key: 'scan_ktp_ortu_url', label: 'KTP Orang Tua' },
  { key: 'scan_rapor_url', label: 'Rapor' },
  { key: 'scan_sertifikat_prestasi_url', label: 'Sertifikat Prestasi' },
]

const EDITABLE_FIELDS: { key: string; label: string; type?: string }[] = [
  // Identitas
  { key: 'nisn', label: 'NISN' }, { key: 'nik', label: 'NIK' },
  { key: 'nama_lengkap', label: 'Nama Lengkap' },
  { key: 'jenis_kelamin', label: 'Jenis Kelamin' },
  { key: 'tempat_lahir', label: 'Tempat Lahir' },
  { key: 'tanggal_lahir', label: 'Tanggal Lahir', type: 'date' },
  { key: 'agama', label: 'Agama' }, { key: 'ukuran_baju', label: 'Ukuran Baju' },
  { key: 'status_anak', label: 'Status Anak' },
  { key: 'jumlah_saudara', label: 'Jumlah Saudara', type: 'number' },
  { key: 'anak_ke', label: 'Anak Ke-', type: 'number' },
  // Alamat
  { key: 'alamat_lengkap', label: 'Alamat Lengkap' },
  { key: 'rt', label: 'RT' }, { key: 'rw', label: 'RW' },
  { key: 'desa_kelurahan', label: 'Desa/Kelurahan' }, { key: 'kecamatan', label: 'Kecamatan' },
  { key: 'kabupaten_kota', label: 'Kab/Kota' }, { key: 'provinsi', label: 'Provinsi' },
  { key: 'kode_pos', label: 'Kode Pos' },
  // Keluarga
  { key: 'no_kk', label: 'No. KK' }, { key: 'no_telepon_ortu', label: 'No. WA Ortu' },
  // Ayah
  { key: 'nama_ayah', label: 'Nama Ayah' }, { key: 'nik_ayah', label: 'NIK Ayah' },
  { key: 'tempat_lahir_ayah', label: 'Tempat Lahir Ayah' },
  { key: 'tanggal_lahir_ayah', label: 'Tgl Lahir Ayah', type: 'date' },
  { key: 'status_ayah', label: 'Status Ayah' },
  { key: 'pendidikan_ayah', label: 'Pendidikan Ayah' },
  { key: 'pekerjaan_ayah', label: 'Pekerjaan Ayah' },
  { key: 'penghasilan_ayah', label: 'Penghasilan Ayah', type: 'number' },
  // Ibu
  { key: 'nama_ibu', label: 'Nama Ibu' }, { key: 'nik_ibu', label: 'NIK Ibu' },
  { key: 'tempat_lahir_ibu', label: 'Tempat Lahir Ibu' },
  { key: 'tanggal_lahir_ibu', label: 'Tgl Lahir Ibu', type: 'date' },
  { key: 'status_ibu', label: 'Status Ibu' },
  { key: 'pendidikan_ibu', label: 'Pendidikan Ibu' },
  { key: 'pekerjaan_ibu', label: 'Pekerjaan Ibu' },
  { key: 'penghasilan_ibu', label: 'Penghasilan Ibu', type: 'number' },
  // Wali
  { key: 'nama_wali', label: 'Nama Wali' }, { key: 'nik_wali', label: 'NIK Wali' },
  { key: 'tempat_lahir_wali', label: 'Tempat Lahir Wali' },
  { key: 'tanggal_lahir_wali', label: 'Tgl Lahir Wali', type: 'date' },
  { key: 'pendidikan_wali', label: 'Pendidikan Wali' },
  { key: 'pekerjaan_wali', label: 'Pekerjaan Wali' },
  { key: 'penghasilan_wali', label: 'Penghasilan Wali', type: 'number' },
  { key: 'no_telepon_wali', label: 'No. WA Wali' },
  // Sekolah
  { key: 'asal_sekolah', label: 'Asal Sekolah' },
  { key: 'npsn_sekolah', label: 'NPSN' },
  { key: 'pilihan_pesantren', label: 'Pilihan Pesantren' },
]

export function DetailModal({ id, pendaftar, onClose, onFlash }: {
  id: string
  pendaftar: Pendaftar[]
  onClose: () => void
  onFlash: (r: { success?: string; error?: string }) => void
}) {
  const [data, setData] = useState<{ pendaftar: any; prestasi: any[] } | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [pend, startT] = useTransition()
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState('')
  const [flaggedBerkas, setFlaggedBerkas] = useState<string[]>([])
  const [jadwalDraft, setJadwalDraft] = useState({ tanggal_tes: '', sesi_tes: '', ruang_tes: '' })
  const [jadwalEdit, setJadwalEdit] = useState(false)

  const summary = pendaftar.find((p) => p.id === id)

  function loadData() {
    getDetailPendaftar(id).then((r) => {
      setData({ pendaftar: r.pendaftar, prestasi: r.prestasi || [] })
      try {
        const parsed = r.pendaftar?.berkas_ditolak ? JSON.parse(r.pendaftar.berkas_ditolak) : []
        setFlaggedBerkas(Array.isArray(parsed) ? parsed : [])
      } catch {
        setFlaggedBerkas([])
      }
      setJadwalDraft({
        tanggal_tes: r.pendaftar?.tanggal_tes || '',
        sesi_tes: r.pendaftar?.sesi_tes || '',
        ruang_tes: r.pendaftar?.ruang_tes || '',
      })
    })
  }

  useEffect(() => { loadData() }, [id])

  const p = data?.pendaftar
  const bebasCBT = p?.jalur === 'PRESTASI' && p?.status_verifikasi === 1 && p?.status_kelulusan !== 'TIDAK DITERIMA'

  function startEdit(p: any) {
    const vals: Record<string, string> = {}
    EDITABLE_FIELDS.forEach((f) => { vals[f.key] = p[f.key] != null ? String(p[f.key]) : '' })
    setEditValues(vals)
    setEditMode(true)
  }

  function saveEdit() {
    startT(async () => {
      const res = await editPendaftar(id, editValues)
      onFlash(res)
      if (!res.error) { setEditMode(false); loadData() }
    })
  }

  function doVerif(ok: boolean | null) {
    startT(async () => { onFlash(await verifikasiBerkas([id], ok)); loadData() })
  }

  function doLulus(s: 'DITERIMA' | 'TIDAK DITERIMA' | 'PENDING') {
    startT(async () => { onFlash(await setKelulusan([id], s)); loadData() })
  }

  function doAlihReguler() {
    if (!confirm('Alihkan pendaftar ini ke Jalur Reguler?')) return
    startT(async () => { onFlash(await bulkAlihReguler([id])); loadData() })
  }

  function saveFlagBerkas() {
    startT(async () => {
      const res = await setFlagBerkas(id, flaggedBerkas)
      onFlash(res)
      if (!res.error) loadData()
    })
  }

  function openWA() {
    const raw = p?.no_telepon_ortu?.replace(/\D/g, '') || ''
    const nomor = raw.startsWith('0') ? '62' + raw.slice(1) : raw
    const flaggedLabels = flaggedBerkas.map((k) => BERKAS_DEF.find((b) => b.key === k)?.label || k)
    const msg = encodeURIComponent(
      `Assalamu'alaikum, Ananda *${p?.nama_lengkap}* (No. Pendaftaran: ${p?.no_pendaftaran})\n\n` +
      `Mohon lengkapi/perbaiki berkas berikut:\n` +
      flaggedLabels.map((l) => `• ${l}`).join('\n') +
      `\n\nSilakan login dan upload ulang melalui sistem PMB MAN 1 Tasikmalaya. Terima kasih.`
    )
    window.open(`https://wa.me/${nomor}?text=${msg}`, '_blank')
  }

  function saveJadwal() {
    startT(async () => {
      const res = await setJadwalPendaftar(id, jadwalDraft)
      onFlash(res)
      if (!res.error) { setJadwalEdit(false); loadData() }
    })
  }

  function toggleDaftarUlang() {
    const cur = p?.daftar_ulang_status
    startT(async () => {
      const res = await editPendaftar(id, { daftar_ulang_status: cur === 'SELESAI' ? null : 'SELESAI' })
      onFlash(res)
      if (!res.error) loadData()
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap text-base">
            Detail Pendaftar
            {bebasCBT && (
              <Badge className="bg-purple-100 text-purple-800 border-purple-300 text-[10px] px-1.5 gap-0.5">
                <Award className="h-3 w-3" />BEBAS CBT
              </Badge>
            )}
            {summary && <JalurBadge jalur={summary.jalur} />}
            {summary && <VerifBadge v={summary.status_verifikasi} />}
            {summary && <LulusBadge s={summary.status_kelulusan} />}
          </DialogTitle>
        </DialogHeader>

        {!data ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !p ? (
          <p className="text-sm text-red-600 py-4">Data tidak ditemukan.</p>
        ) : (
          <div className="space-y-4">
            {/* ── Quick action bar ── */}
            <Card className="bg-muted/30">
              <CardContent className="flex flex-wrap gap-2 p-3">
                {(() => {
                  const sv = p.status_verifikasi
                  const sk = p.status_kelulusan
                  return (<>
                    <Button size="sm" variant={sv === 1 ? 'default' : 'outline'} disabled={pend}
                      onClick={() => doVerif(sv === 1 ? null : true)}
                      className={sv === 1 ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'text-emerald-700 border-emerald-400 hover:bg-emerald-50'}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />{sv === 1 ? 'Batalkan Verif' : 'Verifikasi'}
                    </Button>
                    <Button size="sm" variant={sv === 0 ? 'default' : 'outline'} disabled={pend}
                      onClick={() => doVerif(sv === 0 ? null : false)}
                      className={sv === 0 ? 'bg-red-600 hover:bg-red-700 text-white' : 'text-red-600 border-red-400 hover:bg-red-50'}>
                      <XCircle className="h-3.5 w-3.5 mr-1" />{sv === 0 ? 'Batalkan Tolak' : 'Tolak Berkas'}
                    </Button>
                    <Button size="sm" variant={sk === 'DITERIMA' ? 'default' : 'outline'} disabled={pend}
                      onClick={() => doLulus(sk === 'DITERIMA' ? 'PENDING' : 'DITERIMA')}
                      className={sk === 'DITERIMA' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'text-emerald-700 border-emerald-400 hover:bg-emerald-50'}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />{sk === 'DITERIMA' ? 'Batalkan Lulus' : 'Luluskan'}
                    </Button>
                    <Button size="sm" variant={sk === 'TIDAK DITERIMA' ? 'default' : 'outline'} disabled={pend}
                      onClick={() => doLulus(sk === 'TIDAK DITERIMA' ? 'PENDING' : 'TIDAK DITERIMA')}
                      className={sk === 'TIDAK DITERIMA' ? 'bg-red-600 hover:bg-red-700 text-white' : 'text-red-600 border-red-400 hover:bg-red-50'}>
                      {sk === 'TIDAK DITERIMA' ? 'Batalkan Tidak Lulus' : 'Tidak Lulus'}
                    </Button>
                    {p.jalur === 'PRESTASI' && (
                      <Button size="sm" variant="outline" disabled={pend} onClick={doAlihReguler}
                        className="text-blue-700 border-blue-400 hover:bg-blue-50">
                        <RefreshCw className="h-3.5 w-3.5 mr-1" />Alih Reguler
                      </Button>
                    )}
                  </>)
                })()}
              </CardContent>
            </Card>

            {/* Flagged berkas alert */}
            {flaggedBerkas.length > 0 && (
              <Alert variant="destructive" className="bg-red-50 text-red-700 border-red-200 py-2">
                <AlertTitle className="text-xs font-semibold mb-1">Berkas bermasalah</AlertTitle>
                <AlertDescription className="text-xs">
                  {flaggedBerkas.map((k) => BERKAS_DEF.find((b) => b.key === k)?.label || k).join(', ')}
                </AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="biodata">
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="biodata">Biodata</TabsTrigger>
                <TabsTrigger value="berkas">Berkas</TabsTrigger>
                <TabsTrigger value="jadwal">Jadwal & Status</TabsTrigger>
                {data.prestasi.length > 0 && <TabsTrigger value="prestasi">Prestasi</TabsTrigger>}
              </TabsList>

              {/* ── Biodata ── */}
              <TabsContent value="biodata" className="mt-3">
                <div className="flex justify-end mb-2">
                  {editMode ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditMode(false)} disabled={pend}>
                        <X className="h-4 w-4 mr-1" />Batal
                      </Button>
                      <Button size="sm" onClick={saveEdit} disabled={pend} className="bg-emerald-600 hover:bg-emerald-700">
                        {pend ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                        Simpan
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => startEdit(p)}>
                      <Edit2 className="h-4 w-4 mr-1" />Edit
                    </Button>
                  )}
                </div>

                {editMode ? (
                  <div className="grid grid-cols-2 gap-3">
                    {EDITABLE_FIELDS.map((f) => (
                      <div key={f.key}>
                        <Label className="text-xs mb-1 block">{f.label}</Label>
                        <Input
                          type={f.type || 'text'}
                          value={editValues[f.key] || ''}
                          className="h-8 text-sm"
                          onChange={(e) => setEditValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3 text-sm">
                    {/* Foto pendaftar */}
                    {p.foto_url && (
                      <div className="flex items-center gap-4 pb-3 border-b">
                        <div className="relative w-20 h-24 flex-shrink-0 rounded-md overflow-hidden border border-slate-200 bg-slate-50 shadow-sm">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.foto_url} alt={p.nama_lengkap} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="font-semibold text-base leading-tight">{p.nama_lengkap}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{p.no_pendaftaran}</p>
                          <p className="text-xs text-muted-foreground">{p.jenis_kelamin} · {p.agama}</p>
                          <button
                            className="text-[10px] text-blue-600 hover:underline mt-1 flex items-center gap-0.5"
                            onClick={() => { setPreviewUrl(p.foto_url); setPreviewTitle('Pas Foto') }}
                          >
                            <Eye className="h-3 w-3" />Perbesar
                          </button>
                        </div>
                      </div>
                    )}
                    <Section title="Identitas" rows={[
                      ['No. Pendaftaran', p.no_pendaftaran],
                      ['Tahun Ajaran', p.tahun_ajaran],
                      ['Jalur', p.jalur],
                      ['NISN', p.nisn], ['NIK', p.nik],
                      ['Nama', p.nama_lengkap],
                      ['Jenis Kelamin', p.jenis_kelamin],
                      ['TTL', `${p.tempat_lahir || '—'}, ${p.tanggal_lahir || '—'}`],
                      ['Agama', p.agama],
                      ['Ukuran Baju', p.ukuran_baju],
                      ['Status Anak', `Anak ke-${p.anak_ke} dari ${p.jumlah_saudara} saudara (${p.status_anak || '—'})`],
                    ]} />
                    <Section title="Alamat" rows={[
                      ['Alamat', p.alamat_lengkap],
                      ['RT/RW', `${p.rt || '—'}/${p.rw || '—'}`],
                      ['Desa/Kel.', p.desa_kelurahan],
                      ['Kecamatan', p.kecamatan],
                      ['Kab/Kota', p.kabupaten_kota],
                      ['Provinsi', p.provinsi],
                      ['Kode Pos', p.kode_pos],
                    ]} />
                    <Section title="Ayah" rows={[
                      ['No. KK', p.no_kk],
                      ['Nama', p.nama_ayah], ['NIK', p.nik_ayah],
                      ['TTL', `${p.tempat_lahir_ayah || '—'}, ${p.tanggal_lahir_ayah || '—'}`],
                      ['Status', p.status_ayah],
                      ['Pendidikan', p.pendidikan_ayah], ['Pekerjaan', p.pekerjaan_ayah],
                      ['Penghasilan', p.penghasilan_ayah ? `Rp ${Number(p.penghasilan_ayah).toLocaleString('id-ID')}` : null],
                    ]} />
                    <Section title="Ibu" rows={[
                      ['Nama', p.nama_ibu], ['NIK', p.nik_ibu],
                      ['TTL', `${p.tempat_lahir_ibu || '—'}, ${p.tanggal_lahir_ibu || '—'}`],
                      ['Status', p.status_ibu],
                      ['Pendidikan', p.pendidikan_ibu], ['Pekerjaan', p.pekerjaan_ibu],
                      ['Penghasilan', p.penghasilan_ibu ? `Rp ${Number(p.penghasilan_ibu).toLocaleString('id-ID')}` : null],
                      ['WA Ortu', p.no_telepon_ortu],
                    ]} />
                    {p.nama_wali && (
                      <Section title="Wali" rows={[
                        ['Nama', p.nama_wali], ['NIK', p.nik_wali],
                        ['TTL', `${p.tempat_lahir_wali || '—'}, ${p.tanggal_lahir_wali || '—'}`],
                        ['Pendidikan', p.pendidikan_wali], ['Pekerjaan', p.pekerjaan_wali],
                        ['Penghasilan', p.penghasilan_wali ? `Rp ${Number(p.penghasilan_wali).toLocaleString('id-ID')}` : null],
                        ['WA Wali', p.no_telepon_wali],
                      ]} />
                    )}
                    <Section title="Sekolah Asal" rows={[
                      ['Asal Sekolah', p.asal_sekolah],
                      ['NPSN', p.npsn_sekolah],
                      ['Status Sekolah', p.status_sekolah],
                      ['Alamat Sekolah', p.alamat_sekolah],
                      ['Pilihan Pesantren', p.pilihan_pesantren],
                    ]} />
                  </div>
                )}
              </TabsContent>

              {/* ── Berkas ── */}
              <TabsContent value="berkas" className="mt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Centang berkas bermasalah lalu simpan</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={saveFlagBerkas} disabled={pend}>
                      {pend ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                      Simpan Flag
                    </Button>
                    {flaggedBerkas.length > 0 && p.no_telepon_ortu && (
                      <Button size="sm" onClick={openWA}
                        className="bg-green-600 hover:bg-green-700 text-white gap-1">
                        <MessageCircle className="h-3.5 w-3.5" />Notif WA
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {BERKAS_DEF.map(({ key, label }) => {
                    const url = p[key]
                    const exists = !!url
                    const isFlagged = flaggedBerkas.includes(key)
                    const isImg = exists && isImageFile(url)

                    return (
                      <Card key={key}
                        className={`group relative overflow-hidden border shadow-sm transition-all hover:shadow-md flex flex-col ${isFlagged ? 'border-red-400 bg-red-50/30' : 'border-slate-200/80'}`}>
                        <CardContent className="p-3 flex flex-col space-y-2 flex-1">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Checkbox
                                id={`flag-${key}`}
                                checked={isFlagged}
                                onCheckedChange={(c) => {
                                  if (c) setFlaggedBerkas((prev) => [...prev, key])
                                  else setFlaggedBerkas((prev) => prev.filter((k) => k !== key))
                                }}
                                className={isFlagged ? 'border-red-500 data-[state=checked]:bg-red-500' : ''}
                              />
                              <div className="min-w-0">
                                <label htmlFor={`flag-${key}`} className="text-xs font-bold text-slate-700 truncate block cursor-pointer">{label}</label>
                                <p className="text-[10px] text-muted-foreground">{exists ? 'Tersedia' : 'Belum diunggah'}</p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                              <Badge variant={exists ? 'secondary' : 'outline'}
                                className={`text-[9px] px-1.5 py-0.5 font-bold ${exists ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'text-slate-400 border-slate-200'}`}>
                                {exists ? (isImg ? 'GAMBAR' : 'PDF') : 'KOSONG'}
                              </Badge>
                              {isFlagged && (
                                <Badge variant="destructive" className="text-[9px] px-1.5 py-0.5">BERMASALAH</Badge>
                              )}
                            </div>
                          </div>

                          {exists ? (
                            <div className="relative aspect-[16/10] w-full rounded-md overflow-hidden bg-slate-50 border border-slate-100 flex items-center justify-center">
                              {isImg ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={url} alt={label} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                              ) : (
                                <div className="flex flex-col items-center justify-center p-3 text-red-500">
                                  <FileText className="h-10 w-10 stroke-[1.5]" />
                                  <span className="text-[10px] font-semibold mt-1.5 text-slate-600">Dokumen PDF</span>
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 backdrop-blur-[1px]">
                                <Button size="sm" variant="secondary" className="h-8 px-2.5 text-xs font-semibold shadow-sm"
                                  onClick={(e) => { e.preventDefault(); setPreviewUrl(url); setPreviewTitle(label) }}>
                                  <Eye className="h-3.5 w-3.5 mr-1" />Pratinjau
                                </Button>
                                <a href={url} target="_blank" rel="noreferrer"
                                  className="inline-flex items-center justify-center h-8 px-2.5 text-xs font-semibold rounded-md border border-slate-200 bg-white text-slate-950 shadow-sm hover:bg-slate-100">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              </div>
                            </div>
                          ) : (
                            <div className="aspect-[16/10] w-full rounded-md border border-dashed border-slate-200 flex flex-col items-center justify-center p-3">
                              <XCircle className="h-7 w-7 stroke-[1.2] text-slate-300" />
                              <span className="text-[10px] font-medium text-slate-400 mt-2">Belum Diunggah</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </TabsContent>

              {/* ── Jadwal & Status ── */}
              <TabsContent value="jadwal" className="mt-3 space-y-4">
                {/* Status header */}
                <Card>
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status PMB</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3 space-y-2">
                    <Table>
                      <TableBody>
                        {([
                          ['No. Pendaftaran', p.no_pendaftaran],
                          ['Status Verifikasi', p.status_verifikasi === 1 ? 'Terverifikasi ✓' : p.status_verifikasi === 0 ? 'Ditolak ✗' : 'Menunggu'],
                          ['Status Kelulusan', p.status_kelulusan],
                          ['Akun Siswa', p.siswa_id ? `Terhubung (${p.siswa_id})` : '—'],
                          ['Tgl. Daftar', p.created_at],
                        ] as [string, any][]).map(([k, v]) => (
                          <TableRow key={k} className="border-0 hover:bg-transparent">
                            <TableCell className="text-muted-foreground py-0.5 pr-3 align-top w-36 text-xs pl-0">{k}</TableCell>
                            <TableCell className="py-0.5 text-sm pl-0">{v || <span className="text-slate-300">—</span>}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* Daftar ulang toggle */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div>
                        <p className="text-xs font-semibold">Daftar Ulang</p>
                        <p className="text-[10px] text-muted-foreground">
                          {p.daftar_ulang_status === 'SELESAI' ? 'Sudah selesai' : 'Belum dilakukan'}
                        </p>
                      </div>
                      <Button
                        size="sm" disabled={pend}
                        variant={p.daftar_ulang_status === 'SELESAI' ? 'default' : 'outline'}
                        onClick={toggleDaftarUlang}
                        className={p.daftar_ulang_status === 'SELESAI' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
                      >
                        {p.daftar_ulang_status === 'SELESAI' ? <><CheckCircle2 className="h-3.5 w-3.5 mr-1" />SELESAI</> : 'Tandai Selesai'}
                      </Button>
                    </div>

                    {/* Nilai rapor */}
                    {p.nilai_rapor != null && (
                      <div className="flex items-center justify-between pt-2 border-t">
                        <p className="text-xs font-semibold">Nilai Rapor (Rata-rata)</p>
                        <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-sm font-bold px-3">
                          {Number(p.nilai_rapor).toFixed(2)}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Jadwal tes */}
                <Card>
                  <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <CalendarClock className="h-3.5 w-3.5" />Jadwal Tes
                    </CardTitle>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setJadwalEdit((v) => !v)} disabled={pend}>
                      {jadwalEdit ? <><X className="h-3 w-3 mr-1" />Batal</> : <><Edit2 className="h-3 w-3 mr-1" />Edit</>}
                    </Button>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    {jadwalEdit ? (
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs mb-1 block">Tanggal Tes</Label>
                          <Input type="date" className="h-8 text-sm" value={jadwalDraft.tanggal_tes}
                            onChange={(e) => setJadwalDraft((d) => ({ ...d, tanggal_tes: e.target.value }))} />
                        </div>
                        <div>
                          <Label className="text-xs mb-1 block">Sesi Tes</Label>
                          <Input className="h-8 text-sm" placeholder="mis. Sesi 1: 07:30-09:00" value={jadwalDraft.sesi_tes}
                            onChange={(e) => setJadwalDraft((d) => ({ ...d, sesi_tes: e.target.value }))} />
                        </div>
                        <div>
                          <Label className="text-xs mb-1 block">Ruang Tes</Label>
                          <Input className="h-8 text-sm" placeholder="mis. Ruang 01" value={jadwalDraft.ruang_tes}
                            onChange={(e) => setJadwalDraft((d) => ({ ...d, ruang_tes: e.target.value }))} />
                        </div>
                        <Button size="sm" onClick={saveJadwal} disabled={pend} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full">
                          {pend ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                          Simpan Jadwal
                        </Button>
                      </div>
                    ) : (
                      <Table>
                        <TableBody>
                          {([
                            ['Tanggal', p.tanggal_tes],
                            ['Sesi', p.sesi_tes],
                            ['Ruang', p.ruang_tes],
                          ] as [string, any][]).map(([k, v]) => (
                            <TableRow key={k} className="border-0 hover:bg-transparent">
                              <TableCell className="text-muted-foreground py-0.5 pr-3 w-24 text-xs pl-0">{k}</TableCell>
                              <TableCell className="py-0.5 text-sm pl-0">{v || <span className="text-slate-300">—</span>}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Prestasi ── */}
              {data.prestasi.length > 0 && (
                <TabsContent value="prestasi" className="mt-3">
                  <div className="space-y-2">
                    {data.prestasi.map((pr: any) => (
                      <Card key={pr.id}>
                        <CardContent className="p-3 text-sm">
                          <div className="font-semibold">{pr.nama_lomba}</div>
                          <div className="text-muted-foreground text-xs mt-0.5">
                            {pr.kategori} · {pr.tingkat} · {pr.penyelenggara} · {pr.tahun_perolehan}
                          </div>
                          {pr.sertifikat_url && (
                            <a href={pr.sertifikat_url} target="_blank" rel="noreferrer"
                              className="text-blue-600 text-xs flex items-center gap-1 mt-1 hover:underline">
                              <ExternalLink className="h-3 w-3" />Lihat Sertifikat
                            </a>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </div>
        )}
      </DialogContent>

      {/* ── Pratinjau berkas ── */}
      {previewUrl && (
        <Dialog open onOpenChange={() => setPreviewUrl(null)}>
          <DialogContent className="max-w-3xl w-full max-h-[85vh] p-4 flex flex-col items-center">
            <DialogHeader className="w-full flex flex-row items-center justify-between pb-2 border-b">
              <DialogTitle className="text-sm font-semibold truncate pr-4">
                Pratinjau: {previewTitle}
              </DialogTitle>
              <div className="flex gap-1.5 items-center mr-6">
                <a href={previewUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center justify-center h-8 px-3 text-xs font-semibold rounded-md border border-slate-200 bg-white text-slate-950 shadow-sm hover:bg-slate-100">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />Buka Tab Baru
                </a>
              </div>
            </DialogHeader>
            <div className="w-full flex-1 min-h-0 flex items-center justify-center p-2 bg-slate-50 rounded-md mt-2 overflow-auto">
              {isImageFile(previewUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt={previewTitle} className="max-h-[65vh] max-w-full object-contain rounded-md shadow-md border" />
              ) : (
                <iframe src={previewUrl} title={previewTitle} className="w-full h-[65vh] rounded-md border-0" />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  )
}

function Section({ title, rows }: { title: string; rows: [string, any][] }) {
  return (
    <div>
      <div className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-1.5 border-b pb-1">{title}</div>
      <Table>
        <TableBody>
          {rows.map(([k, v]) => (
            <TableRow key={k} className="border-0 hover:bg-transparent">
              <TableCell className="text-muted-foreground py-0.5 pr-3 align-top w-36 text-xs pl-0">{k}</TableCell>
              <TableCell className="py-0.5 text-sm pl-0">{v ?? <span className="text-slate-300">—</span>}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
