import { z } from 'zod'

const text = z.string().trim().default('')
const list = z.array(z.string().trim()).default([])
const columns = z.array(z.string().trim()).max(5).default([])

const block = z.discriminatedUnion('jenis', [
  z.object({ jenis: z.literal('teks'), teks: text }),
  z.object({ jenis: z.literal('daftar'), poin: list }),
  z.object({ jenis: z.literal('tabel'), kolom: columns, baris: z.array(z.array(z.string().trim())).default([]) }),
]).superRefine((value, ctx) => {
  if (value.jenis !== 'tabel') return
  value.baris.forEach((row, index) => {
    if (row.length !== value.kolom.length || row.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['baris', index], message: 'Jumlah sel harus sama dengan jumlah kolom.' })
    }
  })
})

const answer = z.discriminatedUnion('jenis', [
  z.object({ jenis: z.literal('garis'), jumlah: z.number().int().min(1).max(10) }),
  z.object({ jenis: z.literal('area') }),
  z.object({ jenis: z.literal('tabel'), kolom: columns, jumlah_baris: z.number().int().min(1).max(12) }),
])

export const RPPM_RUBRIC_SCORES = ['skor_1', 'skor_2', 'skor_3', 'skor_4'] as const
const indicator = z.object({
  indikator: text,
  kegiatan: text,
  skor_1: text,
  skor_2: text,
  skor_3: text,
  skor_4: text,
})

export const rppmAttachmentsSchema = z.object({
  ringkasan_materi: z.object({
    pengantar: text,
    konsep: z.array(block).default([]),
    contoh: z.array(block).default([]),
  }).prefault({}),
  lkpd: z.object({
    identitas: z.enum(['individu', 'kelompok']).optional(),
    tujuan: text,
    stimulus: z.array(block).default([]),
    petunjuk: list,
    tugas: z.array(z.object({ instruksi: text, jawaban: answer.optional() })).default([]),
    refleksi: text,
  }).prefault({}),
  rubrik: z.object({
    petunjuk: text,
    proses: z.array(indicator).default([]),
    sikap: z.array(indicator.extend({ acuan: text })).default([]),
  }).prefault({}),
})

export type RppmAttachments = z.infer<typeof rppmAttachmentsSchema>
export type RppmBlock = z.infer<typeof block>
export type RppmAnswer = z.infer<typeof answer>
export type RppmIndicator = z.infer<typeof indicator> & { acuan?: string }

export const RPPM_ATTACHMENT_TITLES = [
  'Ringkasan Materi',
  'Lembar Kerja Peserta Didik (LKPD)',
  'Rubrik Observasi Proses dan Penilaian Sikap',
] as const

export const RPPM_RUBRIC_COLUMNS = ['Indikator dan momen', 'Deskripsi skor', 'Skor', 'Catatan']
export const RPPM_RUBRIC_WIDTHS = [27, 45, 11, 17]

export function rppmRubricCells(item: RppmIndicator): string[][] {
  return [
    [item.indikator, item.kegiatan, ...(item.acuan ? [item.acuan] : [])],
    RPPM_RUBRIC_SCORES.map((key, index) => `${index + 1}. ${item[key]}`),
    [''],
    [''],
  ]
}

export function validateRppmAttachments(value?: RppmAttachments) {
  const errors: { path: string; label: string; message: string }[] = []
  const check = (valid: unknown, path: string, label: string) => {
    if (!valid) errors.push({ path: `lampiran.${path}`, label, message: `${label} wajib dilengkapi.` })
  }
  const checkBlocks = (blocks: RppmBlock[], path: string, label: string) => {
    check(blocks.length, path, label)
    blocks.forEach((item, index) => {
      const valid = item.jenis === 'teks' ? item.teks
        : item.jenis === 'daftar' ? item.poin.length && item.poin.every(Boolean)
        : item.kolom.length && item.kolom.every(Boolean) && item.baris.length && item.baris.every(row => row.some(Boolean))
      check(valid, `${path}.${index}`, `${label}, bagian ${index + 1}`)
    })
  }
  if (!value) {
    check(false, 'ringkasan_materi', 'Ringkasan Materi')
    check(false, 'lkpd', 'LKPD')
    check(false, 'rubrik', 'Rubrik Observasi Proses dan Penilaian Sikap')
    return errors
  }

  const { ringkasan_materi: summary, lkpd, rubrik } = value
  check(summary.pengantar, 'ringkasan_materi.pengantar', 'Pengantar Ringkasan Materi')
  checkBlocks(summary.konsep, 'ringkasan_materi.konsep', 'Konsep inti')
  checkBlocks(summary.contoh, 'ringkasan_materi.contoh', 'Contoh materi')
  check(lkpd.identitas, 'lkpd.identitas', 'Jenis identitas LKPD')
  check(lkpd.tujuan, 'lkpd.tujuan', 'Tujuan LKPD')
  checkBlocks(lkpd.stimulus, 'lkpd.stimulus', 'Stimulus LKPD')
  check(lkpd.petunjuk.length && lkpd.petunjuk.every(Boolean), 'lkpd.petunjuk', 'Petunjuk LKPD')
  check(lkpd.tugas.length, 'lkpd.tugas', 'Tugas LKPD')
  lkpd.tugas.forEach(({ instruksi, jawaban }, index) => {
    check(instruksi, `lkpd.tugas.${index}.instruksi`, `Instruksi tugas LKPD ${index + 1}`)
    check(jawaban && (jawaban.jenis !== 'tabel' || (jawaban.kolom.length && jawaban.kolom.every(Boolean))),
      `lkpd.tugas.${index}.jawaban`, `Ruang jawaban tugas LKPD ${index + 1}`)
  })
  check(lkpd.refleksi, 'lkpd.refleksi', 'Refleksi LKPD')
  check(rubrik.petunjuk, 'rubrik.petunjuk', 'Petunjuk rubrik')

  for (const kind of ['proses', 'sikap'] as const) {
    check(rubrik[kind].length, `rubrik.${kind}`, `Indikator ${kind}`)
    rubrik[kind].forEach((item: RppmIndicator, index) => {
      const path = `rubrik.${kind}.${index}`
      const label = `indikator ${kind} ${index + 1}`
      check(item.indikator, `${path}.indikator`, `Nama ${label}`)
      check(item.kegiatan, `${path}.kegiatan`, `Momen pengamatan ${label}`)
      if (kind === 'sikap') check(item.acuan, `${path}.acuan`, `DPL atau Panca Cinta untuk ${label}`)
      RPPM_RUBRIC_SCORES.forEach((key, score) => {
        check(item[key], `${path}.${key}`, `Deskripsi skor ${score + 1} untuk ${label}`)
      })
    })
  }
  return errors
}

export const RPPM_ATTACHMENT_EXAMPLE = {
  ringkasan_materi: {
    pengantar: '',
    konsep: [{ jenis: 'teks', teks: '' }],
    contoh: [{ jenis: 'daftar', poin: [''] }],
  },
  lkpd: {
    identitas: 'individu',
    tujuan: '',
    stimulus: [{ jenis: 'tabel', kolom: [''], baris: [['']] }],
    petunjuk: [''],
    tugas: [{ instruksi: '', jawaban: { jenis: 'garis', jumlah: 3 } }],
    refleksi: '',
  },
  rubrik: {
    petunjuk: '',
    proses: [{ indikator: '', kegiatan: '', skor_1: '', skor_2: '', skor_3: '', skor_4: '' }],
    sikap: [{ indikator: '', kegiatan: '', acuan: '', skor_1: '', skor_2: '', skor_3: '', skor_4: '' }],
  },
}

export const RPPM_ATTACHMENT_INSTRUCTIONS = [
  'Susun tiga lampiran yang dapat digunakan langsung dan mengikuti tujuan, kelas, alokasi waktu, model, kegiatan, dan bukti asesmen RPPM.',
  'Ringkasan Materi berisi pengantar, konsep inti dan contoh yang membantu murid mengerjakan LKPD. Gunakan bahan dari guru bila ada. Tandai data tambahan sebagai contoh pembelajaran.',
  'LKPD berisi identitas individu atau kelompok, tujuan, stimulus lengkap, petunjuk, tugas bertahap, ruang jawaban dan pertanyaan refleksi. Berikan isi bacaan/data yang dibutuhkan, bukan sekadar instruksi mencari bahan.',
  'Pilih bentuk blok sesuai materi: {"jenis":"teks","teks":"..."}, {"jenis":"daftar","poin":["..."]}, atau {"jenis":"tabel","kolom":["..."],"baris":[["..."]]}. Tabel maksimal 5 kolom dengan jumlah sel yang sama di setiap baris.',
  'Pilih ruang jawaban per tugas: {"jenis":"garis","jumlah":3} untuk jawaban singkat (1–10 garis), {"jenis":"area"} untuk perhitungan atau uraian, atau {"jenis":"tabel","kolom":["..."],"jumlah_baris":3} untuk pengamatan (1–12 baris dan maksimal 5 kolom).',
  'Rubrik berisi petunjuk dan dua daftar indikator. Setiap indikator menyebut kegiatan tempat guru mengamati perilaku dan memiliki deskripsi berbeda untuk skor 1 sampai 4. Untuk sikap, tulis DPL atau Panca Cinta yang dipilih pada acuan. Gunakan perilaku yang bisa diamati, tanpa menyimpulkan sifat pribadi murid.',
  'Sebelum mengeluarkan JSON, periksa hubungan tujuan → kegiatan → tugas LKPD → bukti asesmen → indikator rubrik. Pastikan format sesuai contoh struktur dan isi tiap field dengan materi spesifik.',
].join('\n')
