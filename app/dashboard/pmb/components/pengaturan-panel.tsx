'use client'

import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Save, Loader2, Info } from 'lucide-react'
import { simpanPengaturan } from '../actions'

// Prefix no_pendaftaran dari tahun: '2026/2027' -> '2627'
function prefixDariTahun(t: string): string {
  const [a, b] = t.split('/')
  return a && b ? a.slice(-2) + b.slice(-2) : '????'
}

const FIELDS: [string, string, string][] = [
  ['tahun_pmb', 'Tahun PMB', '2026/2027'],
  ['pmb_dibuka', 'Pendaftaran Dibuka (1/0)', '1'],
  ['tanggal_buka', 'Tanggal Buka', ''],
  ['tanggal_tutup', 'Tanggal Tutup', ''],
  ['tanggal_pengumuman', 'Tanggal Pengumuman', ''],
  ['teks_hero', 'Teks Hero Beranda', ''],
  ['link_grup_wa', 'Link Grup WhatsApp', ''],
  ['kontak_wa', 'Kontak WA (cth 628xxx)', ''],
  // Teks jadwal (dipakai halaman Alur)
  ['teks_daftar_reg', 'Alur: Daftar Reguler', '20 April – 20 Mei 2026'],
  ['teks_tes_cbt', 'Alur: Tes CBT', '21 – 23 Mei 2026'],
  ['teks_pengumuman_reg', 'Alur: Pengumuman Reguler', '25 Mei 2026'],
  ['teks_lapor_reg', 'Alur: Lapor Diri Reguler', '13 – 20 Juni 2026'],
  ['teks_daftar_pres', 'Alur: Daftar Prestasi', '6 – 14 April 2026'],
  ['teks_tes_pres', 'Alur: Tes Prestasi', '16 April 2026'],
  ['teks_pengumuman_pres', 'Alur: Pengumuman Prestasi', '18 April 2026'],
  ['teks_lapor_pres', 'Alur: Lapor Diri Prestasi', '20 – 25 April 2026'],
  ['teks_rapat', 'Landing: Tgl Rapat Ortu', '6 Juni 2026'],
  // Teks dokumen cetak
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
    for (const [k] of FIELDS) v[k] = pengaturan[k] ?? ''
    return v
  })
  const [pending, start] = useTransition()

  const tahun = vals.tahun_pmb || '2026/2027'

  return (
    <div className="max-w-xl space-y-4">
      <Alert className="border-blue-200 bg-blue-50 text-blue-700">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription>
          Prefix nomor pendaftaran: <b>{prefixDariTahun(tahun)}</b> → contoh: {prefixDariTahun(tahun)}001
        </AlertDescription>
      </Alert>
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Konfigurasi PMB</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          {FIELDS.map(([key, label, ph]) => (
            <div key={key}>
              <Label className="text-xs">{label}</Label>
              <Input value={vals[key]} placeholder={ph} onChange={(e) => setVals({ ...vals, [key]: e.target.value })} />
            </div>
          ))}
        </CardContent>
      </Card>
      <Button disabled={pending} onClick={() => start(async () => onFlash(await simpanPengaturan(vals)))}>
        {pending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
        Simpan Pengaturan
      </Button>
    </div>
  )
}
