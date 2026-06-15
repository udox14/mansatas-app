'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, FileText, ExternalLink } from 'lucide-react'
import { getDetailPendaftar } from '../actions'

const BERKAS: [string, string][] = [
  ['foto_url', 'Pas Foto'], ['scan_kk_url', 'Kartu Keluarga'], ['scan_akta_url', 'Akta Kelahiran'],
  ['scan_kelakuan_baik_url', 'Surat Kelakuan Baik'], ['scan_ktp_ortu_url', 'KTP Orang Tua'],
  ['scan_rapor_url', 'Rapor'], ['scan_sertifikat_prestasi_url', 'Sertifikat Prestasi'],
]

export function DetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<{ pendaftar: any; prestasi: any[] } | null>(null)

  useEffect(() => {
    getDetailPendaftar(id).then((r) => setData({ pendaftar: r.pendaftar, prestasi: r.prestasi || [] }))
  }, [id])

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Detail Pendaftar</DialogTitle></DialogHeader>
        {!data ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !data.pendaftar ? (
          <p className="text-sm text-red-600">Data tidak ditemukan.</p>
        ) : (
          <div className="space-y-4 text-sm">
            <Section title="Identitas" rows={[
              ['No. Pendaftaran', data.pendaftar.no_pendaftaran], ['Jalur', data.pendaftar.jalur],
              ['NISN', data.pendaftar.nisn], ['NIK', data.pendaftar.nik],
              ['Nama', data.pendaftar.nama_lengkap], ['Jenis Kelamin', data.pendaftar.jenis_kelamin],
              ['TTL', `${data.pendaftar.tempat_lahir}, ${data.pendaftar.tanggal_lahir}`],
            ]} />
            <Section title="Alamat & Keluarga" rows={[
              ['Alamat', `${data.pendaftar.alamat_lengkap}, RT ${data.pendaftar.rt}/${data.pendaftar.rw}, ${data.pendaftar.desa_kelurahan}, ${data.pendaftar.kecamatan}, ${data.pendaftar.kabupaten_kota}`],
              ['Ayah', data.pendaftar.nama_ayah], ['Ibu', data.pendaftar.nama_ibu],
              ['WA Ortu', data.pendaftar.no_telepon_ortu],
            ]} />
            <Section title="Sekolah Asal" rows={[
              ['Asal Sekolah', data.pendaftar.asal_sekolah], ['NPSN', data.pendaftar.npsn_sekolah],
              ['Status', data.pendaftar.status_sekolah], ['Pesantren', data.pendaftar.pilihan_pesantren],
            ]} />

            <div>
              <h4 className="font-semibold mb-2">Berkas</h4>
              <div className="grid grid-cols-2 gap-2">
                {BERKAS.filter(([k]) => data.pendaftar[k]).map(([k, label]) => (
                  <a key={k} href={data.pendaftar[k]} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 border rounded-md px-3 py-2 hover:bg-muted text-blue-600">
                    <FileText className="h-4 w-4" />{label}<ExternalLink className="h-3 w-3 ml-auto" />
                  </a>
                ))}
              </div>
            </div>

            {data.prestasi.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Prestasi</h4>
                <ul className="list-disc pl-5 space-y-1">
                  {data.prestasi.map((p) => (
                    <li key={p.id}>{p.nama_lomba} — {p.tingkat} ({p.tahun_perolehan})
                      {p.sertifikat_url && <a href={p.sertifikat_url} target="_blank" rel="noreferrer" className="text-blue-600 ml-2">[sertifikat]</a>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.pendaftar.berkas_ditolak && (
              <p className="text-red-600">Alasan tolak: {data.pendaftar.berkas_ditolak}</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Section({ title, rows }: { title: string; rows: [string, any][] }) {
  return (
    <div>
      <h4 className="font-semibold mb-1">{title}</h4>
      <table className="w-full">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}><td className="text-muted-foreground py-0.5 pr-3 align-top w-36">{k}</td><td className="py-0.5">{v || '-'}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
