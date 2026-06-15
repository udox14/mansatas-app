'use client'

import { useEffect, useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Loader2, FileText, ExternalLink, CheckCircle2, XCircle, RefreshCw, Edit2, Save, X,
} from 'lucide-react'
import { getDetailPendaftar, editPendaftar, verifikasiBerkas, setKelulusan, bulkAlihReguler } from '../actions'
import { JalurBadge, VerifBadge, LulusBadge } from './pmb-client'
import type { Pendaftar } from './pmb-client'

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
            <div className="flex flex-wrap gap-2 p-3 rounded-lg border bg-muted/30">
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
            </div>

            {data.pendaftar.berkas_ditolak && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                <span className="font-semibold">Alasan tolak berkas:</span> {data.pendaftar.berkas_ditolak}
              </div>
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
                <div className="grid grid-cols-2 gap-2">
                  {BERKAS.map(([k, label]) => (
                    data.pendaftar[k] ? (
                      <a key={k} href={data.pendaftar[k]} target="_blank" rel="noreferrer"
                        className="flex items-center gap-2 border rounded-md px-3 py-2 hover:bg-muted text-blue-600 text-sm">
                        <FileText className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{label}</span>
                        <ExternalLink className="h-3 w-3 ml-auto flex-shrink-0" />
                      </a>
                    ) : (
                      <div key={k} className="flex items-center gap-2 border rounded-md px-3 py-2 text-slate-400 text-sm">
                        <FileText className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{label}</span>
                        <span className="ml-auto text-xs">Belum</span>
                      </div>
                    )
                  ))}
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
                      <div key={p.id} className="border rounded-md p-3 text-sm">
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
                      </div>
                    ))}
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Section({ title, rows }: { title: string; rows: [string, any][] }) {
  return (
    <div>
      <div className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-1.5 border-b pb-1">{title}</div>
      <table className="w-full">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td className="text-muted-foreground py-0.5 pr-3 align-top w-36 text-xs">{k}</td>
              <td className="py-0.5 text-sm">{v || <span className="text-slate-300">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
