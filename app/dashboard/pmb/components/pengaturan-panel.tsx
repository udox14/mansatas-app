'use client'

import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Save, Loader2, Info } from 'lucide-react'
import { simpanPengaturan } from '../actions'

// Prefix no_pendaftaran dari tahun: '2026/2027' -> '2627'
function prefixDariTahun(t: string): string {
  const [a, b] = t.split('/')
  return a && b ? a.slice(-2) + b.slice(-2) : '????'
}

// Helper format to YYYY-MM-DDTHH:MM (untuk datetime-local)
function formatToDatetimeLocal(val: string): string {
  if (!val) return ''
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val)) return val.slice(0, 16)
  const d = new Date(val)
  if (!isNaN(d.getTime())) {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  return ''
}

// Helper format to YYYY-MM-DD (untuk date picker)
function formatToDate(val: string): string {
  if (!val) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
  const d = new Date(val)
  if (!isNaN(d.getTime())) {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
  return ''
}

const FIELDS: [string, string, string][] = [
  ['tahun_pmb', 'Tahun PMB', '2026/2027'],
  ['pmb_dibuka', 'Pendaftaran Dibuka (1/0)', '1'],
  ['jalur_reguler_dibuka', 'Jalur Reguler Dibuka', '1'],
  ['jalur_prestasi_dibuka', 'Jalur Prestasi Dibuka', '1'],
  ['tanggal_buka', 'Tanggal Buka', ''],
  ['tanggal_tutup', 'Tanggal Tutup', ''],
  ['tanggal_pengumuman', 'Tanggal Pengumuman', ''],
  ['teks_hero', 'Teks Hero Beranda', ''],
  ['link_grup_wa', 'Link Grup WhatsApp', ''],
  ['kontak_wa', 'Kontak WA (cth 628xxx)', ''],
  ['teks_daftar_reg', 'Alur: Daftar Reguler', '20 April – 20 Mei 2026'],
  ['teks_tes_cbt', 'Alur: Tes CBT', '21 – 23 Mei 2026'],
  ['teks_pengumuman_reg', 'Alur: Pengumuman Reguler', '25 Mei 2026'],
  ['teks_lapor_reg', 'Alur: Lapor Diri Reguler', '13 – 20 Juni 2026'],
  ['teks_daftar_pres', 'Alur: Daftar Prestasi', '6 – 14 April 2026'],
  ['teks_tes_pres', 'Alur: Tes Prestasi', '16 April 2026'],
  ['teks_pengumuman_pres', 'Alur: Pengumuman Prestasi', '18 April 2026'],
  ['teks_lapor_pres', 'Alur: Lapor Diri Prestasi', '20 – 25 April 2026'],
  ['teks_rapat', 'Landing: Tgl Rapat Ortu', '6 Juni 2026'],
  ['jadwal_cetak_waktu', 'Cetak Undangan: Hari/Tanggal', 'Kamis, 16 April 2026'],
  ['jadwal_cetak_tsk', 'Cetak Undangan: Tgl TTD', '10 April 2026'],
  ['nama_ketua_pmb', 'Cetak: Nama Ketua PMB', 'Dede Fathul Umam, S.Pd.I.'],
  ['nip_ketua_pmb', 'Cetak: NIP Ketua PMB', '197809132009011011'],
  ['tanggal_rapat_komite', 'Cetak Surat: Tanggal', ''],
]

export function PengaturanPanel({ pengaturan, onFlash }: {
  pengaturan: Record<string, string>; onFlash: (r: { success?: string; error?: string }) => void
}) {
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {}
    for (const [k] of FIELDS) {
      v[k] = pengaturan[k] ?? (k === 'pmb_dibuka' || k === 'jalur_reguler_dibuka' || k === 'jalur_prestasi_dibuka' ? '1' : '')
    }
    return v
  })
  const [pending, start] = useTransition()

  const tahun = vals.tahun_pmb || '2026/2027'

  return (
    <div className="space-y-4">
      <Alert className="border-blue-200 bg-blue-50 text-blue-700 max-w-4xl">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription>
          Prefix nomor pendaftaran: <b>{prefixDariTahun(tahun)}</b> → contoh: {prefixDariTahun(tahun)}001
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
        {/* Kolom Kiri */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Sistem &amp; Informasi PMB</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div>
                <Label className="text-xs">Tahun PMB</Label>
                <Input value={vals.tahun_pmb} placeholder="2026/2027" onChange={(e) => setVals({ ...vals, tahun_pmb: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs block mb-1.5">Pendaftaran</Label>
                  <Select value={vals.pmb_dibuka} onValueChange={(v) => setVals({ ...vals, pmb_dibuka: v })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Buka</SelectItem>
                      <SelectItem value="0">Tutup</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs block mb-1.5">Jalur Reguler</Label>
                  <Select value={vals.jalur_reguler_dibuka} onValueChange={(v) => setVals({ ...vals, jalur_reguler_dibuka: v })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Buka</SelectItem>
                      <SelectItem value="0">Tutup</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs block mb-1.5">Jalur Prestasi</Label>
                  <Select value={vals.jalur_prestasi_dibuka} onValueChange={(v) => setVals({ ...vals, jalur_prestasi_dibuka: v })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Buka</SelectItem>
                      <SelectItem value="0">Tutup</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Tanggal Buka</Label>
                <Input type="datetime-local" value={formatToDatetimeLocal(vals.tanggal_buka)} onChange={(e) => setVals({ ...vals, tanggal_buka: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Tanggal Tutup</Label>
                <Input type="datetime-local" value={formatToDatetimeLocal(vals.tanggal_tutup)} onChange={(e) => setVals({ ...vals, tanggal_tutup: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Tanggal Pengumuman</Label>
                <Input type="datetime-local" value={formatToDatetimeLocal(vals.tanggal_pengumuman)} onChange={(e) => setVals({ ...vals, tanggal_pengumuman: e.target.value })} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Landing Page &amp; Kontak</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div>
                <Label className="text-xs">Teks Hero Beranda</Label>
                <Input value={vals.teks_hero} placeholder="Penerimaan Murid Baru MAN 1 Tasikmalaya" onChange={(e) => setVals({ ...vals, teks_hero: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Link Grup WhatsApp</Label>
                <Input value={vals.link_grup_wa} placeholder="https://chat.whatsapp.com/..." onChange={(e) => setVals({ ...vals, link_grup_wa: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Kontak WA (format 628xxx)</Label>
                <Input value={vals.kontak_wa} placeholder="628123456789" onChange={(e) => setVals({ ...vals, kontak_wa: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Landing: Tgl Rapat Ortu</Label>
                <Input value={vals.teks_rapat} placeholder="6 Juni 2026" onChange={(e) => setVals({ ...vals, teks_rapat: e.target.value })} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Kolom Kanan */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Alur Jalur Reguler</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div>
                <Label className="text-xs">Alur: Daftar Reguler</Label>
                <Input value={vals.teks_daftar_reg} placeholder="20 April – 20 Mei 2026" onChange={(e) => setVals({ ...vals, teks_daftar_reg: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Alur: Tes CBT</Label>
                <Input value={vals.teks_tes_cbt} placeholder="21 – 23 Mei 2026" onChange={(e) => setVals({ ...vals, teks_tes_cbt: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Alur: Pengumuman Reguler</Label>
                <Input value={vals.teks_pengumuman_reg} placeholder="25 Mei 2026" onChange={(e) => setVals({ ...vals, teks_pengumuman_reg: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Alur: Lapor Diri Reguler</Label>
                <Input value={vals.teks_lapor_reg} placeholder="13 – 20 Juni 2026" onChange={(e) => setVals({ ...vals, teks_lapor_reg: e.target.value })} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Alur Jalur Prestasi</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div>
                <Label className="text-xs">Alur: Daftar Prestasi</Label>
                <Input value={vals.teks_daftar_pres} placeholder="6 – 14 April 2026" onChange={(e) => setVals({ ...vals, teks_daftar_pres: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Alur: Tes Prestasi</Label>
                <Input value={vals.teks_tes_pres} placeholder="16 April 2026" onChange={(e) => setVals({ ...vals, teks_tes_pres: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Alur: Pengumuman Prestasi</Label>
                <Input value={vals.teks_pengumuman_pres} placeholder="18 April 2026" onChange={(e) => setVals({ ...vals, teks_pengumuman_pres: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Alur: Lapor Diri Prestasi</Label>
                <Input value={vals.teks_lapor_pres} placeholder="20 – 25 April 2026" onChange={(e) => setVals({ ...vals, teks_lapor_pres: e.target.value })} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Format Cetak Dokumen &amp; Surat</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Undangan: Hari/Tgl</Label>
                  <Input value={vals.jadwal_cetak_waktu} placeholder="Kamis, 16 April 2026" onChange={(e) => setVals({ ...vals, jadwal_cetak_waktu: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Undangan: Tgl TTD</Label>
                  <Input type="date" value={formatToDate(vals.jadwal_cetak_tsk)} onChange={(e) => setVals({ ...vals, jadwal_cetak_tsk: e.target.value })} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Cetak: Nama Ketua PMB</Label>
                <Input value={vals.nama_ketua_pmb} placeholder="Dede Fathul Umam, S.Pd.I." onChange={(e) => setVals({ ...vals, nama_ketua_pmb: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Cetak: NIP Ketua PMB</Label>
                <Input value={vals.nip_ketua_pmb} placeholder="197809132009011011" onChange={(e) => setVals({ ...vals, nip_ketua_pmb: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Cetak Surat: Tanggal</Label>
                <Input type="date" value={formatToDate(vals.tanggal_rapat_komite)} onChange={(e) => setVals({ ...vals, tanggal_rapat_komite: e.target.value })} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="pt-2">
        <Button disabled={pending} onClick={() => start(async () => onFlash(await simpanPengaturan(vals)))} className="w-full md:w-auto">
          {pending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          Simpan Pengaturan
        </Button>
      </div>
    </div>
  )
}

