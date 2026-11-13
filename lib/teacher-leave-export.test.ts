import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { buildAgendaKelasDocxBytes } from './agenda-kelas-docx'
import { buildAgendaKelasXlsxBytes } from './agenda-kelas-xlsx'
import type { AgendaKelasPageData, AgendaKelasSignatureSettings } from '@/app/dashboard/agenda-kelas/actions'
import type { AgendaKelasExportAssets } from './agenda-kelas-export-assets'

const page: AgendaKelasPageData = {
  kelas: { id: 'kelas', label: 'X-1', wali_kelas_nama: 'Wali Kelas', wali_kelas_nip: null, wali_kelas_signature_url: null, km_nama: 'Ketua Kelas', km_nis: null },
  kepala: { nama: 'Kepala Madrasah', nip: null, signature_url: null },
  tanggal: '2026-08-03', hariNama: 'Senin',
  agendaRows: Array.from({ length: 10 }, (_, index) => ({
    jam_ke: index + 1, jam_label: String(index + 1), mapel_nama: 'Matematika', pokok_bahasan: '', tugas: 'Latihan',
    guru_nama: 'Guru Contoh', paraf: '', guru_status: index < 2 ? 'IS' : 'HADIR',
  })),
  absensiRows: [], rekap: { terisi: 8, tugas: 2, kosong: 0 },
  calendarStatus: { isEffective: true, reason: null, category: null }, hasActiveBlocks: true,
}
const settings: AgendaKelasSignatureSettings = {
  kepala: { enabled: 0, x_mm: 8, y_mm: 4, width_mm: 38 }, wali: { enabled: 0, x_mm: 8, y_mm: 4, width_mm: 38 },
}
const assets: AgendaKelasExportAssets = {
  logo: { data: new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')), contentType: 'image/png', extension: 'png', widthPx: 1, heightPx: 1 },
  kepalaSignature: null, waliSignatures: new Map(),
}

describe('ekspor Agenda Kelas membedakan izin sekolah', () => {
  it('menyimpan cuti dan nama pelaksana di Word dan Excel', async () => {
    const leavePage = {
      ...page,
      agendaRows: [{ ...page.agendaRows[0], guru_status: 'CUTI', pengganti_nama: 'Rina' }, ...page.agendaRows.slice(1)],
    }
    const [docx, xlsx] = await Promise.all([
      buildAgendaKelasDocxBytes([leavePage], settings, assets),
      buildAgendaKelasXlsxBytes([leavePage], settings, assets, { paperSize: 'F4' }),
    ])
    const xml = await Promise.all([
      JSZip.loadAsync(docx).then(zip => zip.file('word/document.xml')!.async('string')),
      JSZip.loadAsync(xlsx).then(zip => zip.file('xl/worksheets/sheet1.xml')!.async('string')),
    ])
    for (const contents of xml) {
      expect(contents).toContain('CUTI')
      expect(contents).toContain('Pengganti: Rina')
    }
  })
  it('Word menyimpan IS dan legenda dengan tinggi baris tetap', async () => {
    const zip = await JSZip.loadAsync(await buildAgendaKelasDocxBytes([page], settings, assets))
    const xml = await zip.file('word/document.xml')!.async('string')
    expect(xml).toContain('IS: Izin Sekolah')
    expect(xml.match(/>IS<\/w:t>/g)).toHaveLength(2)
    expect(xml).toContain('w:line="140"')
    expect(xml).toContain('w:sz w:val="13"')
  })
  it.each(['F4', 'A4'] as const)('Excel %s menyimpan kolom kehadiran, IS, dan legenda yang muat dalam header', async paperSize => {
    const zip = await JSZip.loadAsync(await buildAgendaKelasXlsxBytes([page], settings, assets, { paperSize }))
    const xml = await zip.file('xl/worksheets/sheet1.xml')!.async('string')
    const styles = await zip.file('xl/styles.xml')!.async('string')
    expect(xml).toContain('KEHADIRAN\nGURU\nIS: Izin Sekolah')
    expect(xml.match(/>IS<\/t>/g)).toHaveLength(2)
    expect(xml).toContain('s="28"')
    expect(styles).toContain('<fonts count="9"')
    expect(styles).toContain('<cellXfs count="29"')
    expect(styles).toContain('<sz val="7.5"')
  })
})
