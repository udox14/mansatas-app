'use client'

import { useEffect, useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import {
  Loader2, FileText, ExternalLink, CheckCircle2, XCircle, RefreshCw, Edit2, Save, X, Eye,
} from 'lucide-react'
import { getDetailPendaftar, editPendaftar, verifikasiBerkas, setKelulusan, bulkAlihReguler } from '../actions'
import { JalurBadge, VerifBadge, LulusBadge } from './pmb-client'
import type { Pendaftar } from './pmb-client'

function isImageFile(url: string) {
  if (!url) return false
  const cleanUrl = url.split('?')[0].toLowerCase()
  return (
    cleanUrl.endsWith('.jpg') ||
    cleanUrl.endsWith('.jpeg') ||
    cleanUrl.endsWith('.png') ||
    cleanUrl.endsWith('.webp') ||
    cleanUrl.endsWith('.gif') ||
    !cleanUrl.endsWith('.pdf')
  )
}

const BERKAS: [string, string][] = [
  ['foto_url', 'Pas Foto'], ['scan_kk_url', 'Kartu Keluarga'], ['scan_akta_url', 'Akta Kelahiran'],
  ['scan_kelakuan_baik_url', 'Surat Kelakuan Baik'], ['scan_ktp_ortu_url', 'KTP Orang Tua'],
  ['scan_rapor_url', 'Rapor'], ['scan_sertifikat_prestasi_url', 'Sertifikat Prestasi'],
]

const EDITABLE_FIELDS: { key: string; label: string; type?: string }[] = [
  { key: 'nisn', label: 'NISN' }, { key: 'nik', label: 'NIK' },
  { key: 'nama_lengkap', label: 'Nama Lengkap' },
  { key: 'jenis_kelamin', label: 'Jenis Kelamin' }, { key: 'tempat_lahir', label: 'Tempat Lahir' },
  { key: 'tanggal_lahir', label: 'Tanggal Lahir', type: 'date' },
  { key: 'agama', label: 'Agama' }, { key: 'no_telepon_ortu', label: 'No. WA Ortu' },
  { key: 'asal_sekolah', label: 'Asal Sekolah' }, { key: 'npsn_sekolah', label: 'NPSN' },
  { key: 'pilihan_pesantren', label: 'Pilihan Pesantren' },
  { key: 'alamat_lengkap', label: 'Alamat Lengkap' },
  { key: 'rt', label: 'RT' }, { key: 'rw', label: 'RW' },
  { key: 'desa_kelurahan', label: 'Desa/Kelurahan' }, { key: 'kecamatan', label: 'Kecamatan' },
  { key: 'kabupaten_kota', label: 'Kab/Kota' }, { key: 'provinsi', label: 'Provinsi' },
  { key: 'kode_pos', label: 'Kode Pos' },
  { key: 'nama_ayah', label: 'Nama Ayah' }, { key: 'nama_ibu', label: 'Nama Ibu' },
  { key: 'daftar_ulang_status', label: 'Status Daftar Ulang' },
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
  const [previewTitle, setPreviewTitle] = useState<string>('')

  const summary = pendaftar.find((p) => p.id === id)

  useEffect(() => {
    getDetailPendaftar(id).then((r) => {
      setData({ pendaftar: r.pendaftar, prestasi: r.prestasi || [] })
    })
  }, [id])

  function reload() {
    getDetailPendaftar(id).then((r) => setData({ pendaftar: r.pendaftar, prestasi: r.prestasi || [] }))
  }

  function startEdit(p: any) {
    const vals: Record<string, string> = {}
    EDITABLE_FIELDS.forEach((f) => { vals[f.key] = p[f.key] || '' })
    setEditValues(vals)
    setEditMode(true)
  }

  function saveEdit() {
    startT(async () => {
      const res = await editPendaftar(id, editValues)
      onFlash(res)
      if (!res.error) { setEditMode(false); reload() }
    })
  }

  function doVerif(ok: boolean) {
    const alasan = ok ? undefined : (prompt('Alasan penolakan berkas:') || 'Berkas tidak valid')
    startT(async () => { onFlash(await verifikasiBerkas([id], ok, alasan)); reload() })
  }
  function doLulus(s: 'DITERIMA' | 'TIDAK DITERIMA' | 'PENDING') {
    startT(async () => { onFlash(await setKelulusan([id], s)); reload() })
  }
  function doAlihReguler() {
    if (!confirm('Alihkan pendaftar ini ke Jalur Reguler?')) return
    startT(async () => { onFlash(await bulkAlihReguler([id])); reload() })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap text-base">
            Detail Pendaftar
            {summary && <JalurBadge jalur={summary.jalur} />}
            {summary && <VerifBadge v={summary.status_verifikasi} />}
            {summary && <LulusBadge s={summary.status_kelulusan} />}
          </DialogTitle>
        </DialogHeader>

        {!data ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !data.pendaftar ? (
          <p className="text-sm text-red-600 py-4">Data tidak ditemukan.</p>
        ) : (
          <div className="space-y-4">
            {/* ── Quick action bar ── */}
            <Card className="bg-muted/30">
            <CardContent className="flex flex-wrap gap-2 p-3">
              <Button size="sm" variant="outline" disabled={pend} onClick={() => doVerif(true)}
                className="text-emerald-700 border-emerald-400 hover:bg-emerald-50">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Verifikasi
              </Button>
              <Button size="sm" variant="outline" disabled={pend} onClick={() => doVerif(false)}
                className="text-red-600 border-red-400 hover:bg-red-50">
                <XCircle className="h-3.5 w-3.5 mr-1" />Tolak Berkas
              </Button>
              <Button size="sm" variant="outline" disabled={pend} onClick={() => doLulus('DITERIMA')}
                className="text-emerald-700 border-emerald-400 hover:bg-emerald-50">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Luluskan
              </Button>
              <Button size="sm" variant="outline" disabled={pend} onClick={() => doLulus('TIDAK DITERIMA')}
                className="text-red-600 border-red-400 hover:bg-red-50">
                Tidak Lulus
              </Button>
              <Button size="sm" variant="outline" disabled={pend} onClick={() => doLulus('PENDING')}>
                Reset
              </Button>
              {data.pendaftar.jalur === 'PRESTASI' && (
                <Button size="sm" variant="outline" disabled={pend} onClick={doAlihReguler}
                  className="text-blue-700 border-blue-400 hover:bg-blue-50">
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />Alih Reguler
                </Button>
              )}
            </CardContent>
            </Card>

            {data.pendaftar.berkas_ditolak && (
              <Alert variant="destructive" className="bg-red-50 text-red-700 border-red-200">
                <AlertTitle className="text-sm font-semibold">Alasan tolak berkas</AlertTitle>
                <AlertDescription>{data.pendaftar.berkas_ditolak}</AlertDescription>
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
                    <Button size="sm" variant="outline" onClick={() => startEdit(data.pendaftar)}>
                      <Edit2 className="h-4 w-4 mr-1" />Edit
                    </Button>
                  )}
                </div>
                {editMode ? (
                  <div className="grid grid-cols-2 gap-3">
                    {EDITABLE_FIELDS.map((f) => (
                      <div key={f.key}>
                        <Label className="text-xs mb-1 block">{f.label}</Label>
                        <Input type={f.type || 'text'} value={editValues[f.key] || ''} className="h-8 text-sm"
                          onChange={(e) => setEditValues((prev) => ({ ...prev, [f.key]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3 text-sm">
                    <Section title="Identitas" rows={[
                      ['No. Pendaftaran', data.pendaftar.no_pendaftaran],
                      ['Tahun Ajaran', data.pendaftar.tahun_ajaran],
                      ['Jalur', data.pendaftar.jalur],
                      ['NISN', data.pendaftar.nisn], ['NIK', data.pendaftar.nik],
                      ['Nama', data.pendaftar.nama_lengkap],
                      ['Jenis Kelamin', data.pendaftar.jenis_kelamin],
                      ['TTL', `${data.pendaftar.tempat_lahir}, ${data.pendaftar.tanggal_lahir}`],
                      ['Agama', data.pendaftar.agama],
                      ['Ukuran Baju', data.pendaftar.ukuran_baju],
                      ['Status Anak', `anak ke-${data.pendaftar.anak_ke} dari ${data.pendaftar.jumlah_saudara} saudara (${data.pendaftar.status_anak})`],
                    ]} />
                    <Section title="Alamat" rows={[
                      ['Alamat', data.pendaftar.alamat_lengkap],
                      ['RT/RW', `${data.pendaftar.rt}/${data.pendaftar.rw}`],
                      ['Desa/Kel.', data.pendaftar.desa_kelurahan],
                      ['Kecamatan', data.pendaftar.kecamatan],
                      ['Kab/Kota', data.pendaftar.kabupaten_kota],
                      ['Provinsi', data.pendaftar.provinsi],
                      ['Kode Pos', data.pendaftar.kode_pos],
                    ]} />
                    <Section title="Orang Tua" rows={[
                      ['No. KK', data.pendaftar.no_kk],
                      ['Nama Ayah', data.pendaftar.nama_ayah], ['NIK Ayah', data.pendaftar.nik_ayah],
                      ['Pend. Ayah', data.pendaftar.pendidikan_ayah], ['Kerja Ayah', data.pendaftar.pekerjaan_ayah],
                      ['Penghasilan Ayah', data.pendaftar.penghasilan_ayah],
                      ['Nama Ibu', data.pendaftar.nama_ibu], ['NIK Ibu', data.pendaftar.nik_ibu],
                      ['Pend. Ibu', data.pendaftar.pendidikan_ibu], ['Kerja Ibu', data.pendaftar.pekerjaan_ibu],
                      ['Penghasilan Ibu', data.pendaftar.penghasilan_ibu],
                      ['WA Ortu', data.pendaftar.no_telepon_ortu],
                    ]} />
                    <Section title="Sekolah Asal" rows={[
                      ['Asal Sekolah', data.pendaftar.asal_sekolah],
                      ['NPSN', data.pendaftar.npsn_sekolah],
                      ['Status Sekolah', data.pendaftar.status_sekolah],
                      ['Alamat Sekolah', data.pendaftar.alamat_sekolah],
                      ['Pilihan Pesantren', data.pendaftar.pilihan_pesantren],
                    ]} />
                  </div>
                )}
              </TabsContent>

              {/* ── Berkas ── */}
              <TabsContent value="berkas" className="mt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in duration-300">
                  {BERKAS.map(([k, label]) => {
                    const url = data.pendaftar[k]
                    const exists = !!url
                    const isImg = exists && isImageFile(url)

                    return (
                      <Card key={k} className="group relative overflow-hidden border border-slate-200/80 shadow-sm transition-all hover:shadow-md dark:border-slate-800 flex flex-col">
                        <CardContent className="p-3 flex flex-col justify-between h-full space-y-3 flex-1">
                          <div className="flex items-start justify-between">
                            <div className="space-y-0.5 min-w-0 flex-1 pr-2">
                              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{label}</h4>
                              <p className="text-[10px] text-muted-foreground">
                                {exists ? 'Tersedia' : 'Belum diunggah'}
                              </p>
                            </div>
                            <Badge variant={exists ? "secondary" : "outline"} className={`text-[9px] px-1.5 py-0.5 font-bold flex-shrink-0 ${exists ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400' : 'text-slate-400 border-slate-200'}`}>
                              {exists ? (isImg ? 'GAMBAR' : 'PDF') : 'KOSONG'}
                            </Badge>
                          </div>

                          {exists ? (
                            <div className="relative aspect-[16/10] w-full rounded-md overflow-hidden bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-850 flex items-center justify-center">
                              {isImg ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={url}
                                  alt={label}
                                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                />
                              ) : (
                                <div className="flex flex-col items-center justify-center p-3 text-red-500">
                                  <FileText className="h-10 w-10 stroke-[1.5]" />
                                  <span className="text-[10px] font-semibold mt-1.5 text-slate-600 dark:text-slate-400">Dokumen PDF</span>
                                </div>
                              )}
                              
                              {/* Hover overlay actions */}
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2 backdrop-blur-[1px]">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-8 px-2.5 text-xs font-semibold shadow-sm"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    setPreviewUrl(url)
                                    setPreviewTitle(label)
                                  }}
                                >
                                  <Eye className="h-3.5 w-3.5 mr-1" /> Pratinjau
                                </Button>
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center justify-center h-8 px-2.5 text-xs font-semibold rounded-md border border-slate-200 bg-white text-slate-950 shadow-sm hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50 dark:hover:bg-slate-800"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              </div>
                            </div>
                          ) : (
                            <div className="aspect-[16/10] w-full rounded-md border border-dashed border-slate-200 dark:border-slate-800 bg-slate-25/50 flex flex-col items-center justify-center p-3 text-slate-350 dark:text-slate-700">
                              <XCircle className="h-7 w-7 stroke-[1.2] text-slate-300 dark:text-slate-700" />
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
              <TabsContent value="jadwal" className="mt-3 text-sm">
                <Section title="Status PMB" rows={[
                  ['No. Pendaftaran', data.pendaftar.no_pendaftaran],
                  ['Status Verifikasi', summary?.status_verifikasi === 1 ? 'Terverifikasi' : summary?.status_verifikasi === 0 ? 'Ditolak' : 'Menunggu'],
                  ['Status Kelulusan', data.pendaftar.status_kelulusan],
                  ['Daftar Ulang', data.pendaftar.daftar_ulang_status || 'Belum'],
                  ['Akun Siswa', data.pendaftar.siswa_id ? `✓ Terhubung (${data.pendaftar.siswa_id})` : '—'],
                  ['Tanggal Tes', data.pendaftar.tanggal_tes || '—'],
                  ['Sesi Tes', data.pendaftar.sesi_tes || '—'],
                  ['Ruang Tes', data.pendaftar.ruang_tes || '—'],
                  ['Tgl. Daftar', data.pendaftar.created_at],
                ]} />
              </TabsContent>

              {/* ── Prestasi ── */}
              {data.prestasi.length > 0 && (
                <TabsContent value="prestasi" className="mt-3">
                  <div className="space-y-2">
                    {data.prestasi.map((p: any) => (
                      <Card key={p.id}>
                        <CardContent className="p-3 text-sm">
                          <div className="font-semibold">{p.nama_lomba}</div>
                          <div className="text-muted-foreground text-xs mt-0.5">
                            {p.kategori} · {p.tingkat} · {p.penyelenggara} · {p.tahun_perolehan}
                          </div>
                          {p.sertifikat_url && (
                            <a href={p.sertifikat_url} target="_blank" rel="noreferrer"
                              className="text-blue-600 text-xs flex items-center gap-1 mt-1">
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

      {/* ── dialog pratinjau berkas (in-app viewer) ── */}
      {previewUrl && (
        <Dialog open onOpenChange={() => setPreviewUrl(null)}>
          <DialogContent className="max-w-3xl w-full max-h-[85vh] p-4 flex flex-col items-center">
            <DialogHeader className="w-full flex flex-row items-center justify-between pb-2 border-b">
              <DialogTitle className="text-sm font-semibold truncate pr-4">
                Pratinjau Berkas: {previewTitle}
              </DialogTitle>
              <div className="flex gap-1.5 items-center mr-6">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center h-8 px-3 text-xs font-semibold rounded-md border border-slate-200 bg-white text-slate-950 shadow-sm hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50 dark:hover:bg-slate-800"
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Buka Tab Baru
                </a>
              </div>
            </DialogHeader>
            <div className="w-full flex-1 min-h-0 flex items-center justify-center p-2 bg-slate-50 dark:bg-slate-900 rounded-md mt-2 overflow-auto">
              {isImageFile(previewUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt={previewTitle}
                  className="max-h-[65vh] max-w-full object-contain rounded-md shadow-md border"
                />
              ) : (
                <iframe
                  src={previewUrl}
                  title={previewTitle}
                  className="w-full h-[65vh] rounded-md border-0"
                />
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
              <TableCell className="py-0.5 text-sm pl-0">{v || <span className="text-slate-300">—</span>}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
