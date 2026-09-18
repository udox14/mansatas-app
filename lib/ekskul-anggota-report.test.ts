import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import JSZip from 'jszip'
import {
  getEkskulAnggotaReport,
  getEkskulResidenceOptions,
  parseEkskulResidenceFilter,
  residenceFilterLabel,
} from './ekskul-anggota-report'
import { buildEkskulAnggotaHtml } from './pdf/ekskul-anggota-template'
import { buildEkskulAnggotaDocxBytes } from './docx/ekskul-anggota-template'

describe('laporan anggota ekstrakurikuler', () => {
  let sqlite: DatabaseSync
  let db: D1Database

  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:')
    sqlite.exec(`
      CREATE TABLE ekstrakurikuler(id TEXT PRIMARY KEY, nama TEXT, status TEXT);
      CREATE TABLE siswa(id TEXT PRIMARY KEY, nama_lengkap TEXT, tempat_tinggal TEXT, status TEXT);
      CREATE TABLE ekstrakurikuler_anggota(ekstrakurikuler_id TEXT, siswa_id TEXT, status TEXT);
      INSERT INTO ekstrakurikuler VALUES
        ('pramuka','Pramuka','aktif'),
        ('paskibra','Paskibra','aktif'),
        ('lama','Ekskul Lama','nonaktif'),
        ('kosong','Ekskul Kosong','aktif');
      INSERT INTO siswa VALUES
        ('ani','Ani <Putri>','Pesantren Sukahideng','aktif'),
        ('budi','Budi','Non-Pesantren','aktif'),
        ('cici','Cici','Pesantren Sukamanah','aktif'),
        ('keluar','Siswa Keluar','Non-Pesantren','keluar');
      INSERT INTO ekstrakurikuler_anggota VALUES
        ('pramuka','budi','aktif'),
        ('pramuka','ani','aktif'),
        ('paskibra','cici','aktif'),
        ('lama','budi','aktif'),
        ('kosong','keluar','aktif');
    `)
    db = {
      prepare(sql: string) {
        let params: Array<string | number | bigint | null | Uint8Array> = []
        const statement = {
          bind(...values: Array<string | number | bigint | null | Uint8Array>) { params = values; return statement },
          async all<T>() { return { results: sqlite.prepare(sql).all(...params) as T[] } },
        }
        return statement
      },
    } as unknown as D1Database
  })

  afterEach(() => sqlite.close())

  it('memetakan filter domisili yang didukung dan menolak nilai tidak valid', () => {
    expect(parseEkskulResidenceFilter(null)).toEqual({ kind: 'all' })
    expect(parseEkskulResidenceFilter('pesantren')).toEqual({ kind: 'pesantren' })
    expect(parseEkskulResidenceFilter('non_pesantren')).toEqual({ kind: 'non_pesantren' })
    expect(parseEkskulResidenceFilter('exact:Pesantren Sukahideng')).toEqual({ kind: 'exact', value: 'Pesantren Sukahideng' })
    expect(parseEkskulResidenceFilter('exact:')).toBeNull()
    expect(parseEkskulResidenceFilter('lain')).toBeNull()
    expect(residenceFilterLabel({ kind: 'pesantren' })).toBe('Semua siswa pesantren')
  })

  it('mencetak semua ekskul aktif, mengurutkan siswa, dan melewati ekskul tanpa hasil', async () => {
    const report = await getEkskulAnggotaReport(db, { scope: 'all', residence: { kind: 'all' } })
    expect(report.groups.map(group => group.ekskul_nama)).toEqual(['Paskibra', 'Pramuka'])
    expect(report.groups[1].rows.map(row => row.nama_lengkap)).toEqual(['Ani <Putri>', 'Budi'])
    expect(report.groups.some(group => group.ekskul_nama === 'Ekskul Lama')).toBe(false)
    expect(report.groups.some(group => group.ekskul_nama === 'Ekskul Kosong')).toBe(false)
  })

  it('mengambil pilihan domisili hanya dari anggota aktif pada ekskul aktif', async () => {
    await expect(getEkskulResidenceOptions(db)).resolves.toEqual([
      'Non-Pesantren',
      'Pesantren Sukahideng',
      'Pesantren Sukamanah',
    ])
  })

  it('menerapkan filter pesantren, non-pesantren, dan nilai spesifik', async () => {
    const pesantren = await getEkskulAnggotaReport(db, { scope: 'all', residence: { kind: 'pesantren' } })
    const nonPesantren = await getEkskulAnggotaReport(db, { scope: 'all', residence: { kind: 'non_pesantren' } })
    const specific = await getEkskulAnggotaReport(db, {
      scope: 'all',
      residence: { kind: 'exact', value: 'Pesantren Sukamanah' },
    })

    expect(pesantren.groups.flatMap(group => group.rows).map(row => row.nama_lengkap)).toEqual(['Cici', 'Ani <Putri>'])
    expect(nonPesantren.groups.flatMap(group => group.rows).map(row => row.nama_lengkap)).toEqual(['Budi'])
    expect(specific.groups.map(group => group.ekskul_nama)).toEqual(['Paskibra'])
  })

  it('membentuk PDF dengan empat kolom, sel tulis kosong, escaping, dan pemisah halaman', async () => {
    const report = await getEkskulAnggotaReport(db, { scope: 'all', residence: { kind: 'all' } })
    const html = buildEkskulAnggotaHtml({
      ...report,
      kopUrl: 'https://app.test/kopsurat.png',
      baseUrl: 'https://app.test',
      printedAt: new Date('2026-09-18T00:00:00Z'),
    })

    expect(html).toContain('DAFTAR SISWA EKSTRAKURIKULER')
    expect(html).toContain('<th>No</th>')
    expect(html).toContain('<th>Nama Lengkap</th>')
    expect(html).toContain('<th>Tempat Tinggal</th>')
    expect(html).toContain('<th>Asrama/Kamar</th>')
    expect(html).toContain('class="continuation-spacer"')
    expect(html).toContain('.continuation-spacer th { height:7mm; padding:0; border:0; background:#fff; }')
    expect(html).toContain('<td class="write-cell">&nbsp;</td>')
    expect(html).toContain('Ani &lt;Putri&gt;')
    expect(html).toContain('.ekskul-page { min-height:330mm; padding:0 14mm 12mm; break-before:page; page-break-before:always; }')
    expect(html.match(/<section class="ekskul-page">/g)).toHaveLength(2)
  })

  it('membentuk Word yang dapat diedit dengan kop, tabel, dan pemisah halaman', async () => {
    const report = await getEkskulAnggotaReport(db, { scope: 'all', residence: { kind: 'all' } })
    const bytes = buildEkskulAnggotaDocxBytes({
      ...report,
      letterheadPng: new Uint8Array([137, 80, 78, 71]),
      printedAt: new Date('2026-09-18T00:00:00Z'),
    })
    const archive = await JSZip.loadAsync(bytes)
    const documentXml = await archive.file('word/document.xml')!.async('string')
    const relationships = await archive.file('word/_rels/document.xml.rels')!.async('string')

    expect(archive.file('word/media/kopsurat.png')).not.toBeNull()
    expect(documentXml).toContain('DAFTAR SISWA EKSTRAKURIKULER')
    expect(documentXml).toContain('Nama Lengkap')
    expect(documentXml).toContain('Tempat Tinggal')
    expect(documentXml).toContain('Asrama/Kamar')
    expect(documentXml).toContain('Ani &lt;Putri&gt;')
    expect(documentXml.match(/w:type="page"/g)).toHaveLength(1)
    expect(documentXml.match(/<w:tblHeader\/>/g)).toHaveLength(4)
    expect(documentXml).toContain('<w:gridSpan w:val="4"/>')
    expect(documentXml).toContain('<w:trHeight w:val="397" w:hRule="exact"/>')
    expect(relationships).toContain('rIdLetterhead')
  })
})
