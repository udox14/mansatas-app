import {
  RPPM_ATTACHMENT_TITLES,
  RPPM_RUBRIC_COLUMNS,
  RPPM_RUBRIC_WIDTHS,
  rppmRubricCells,
  type RppmAttachments,
  type RppmBlock,
} from './rppm-attachments'
import type { RppmSpec } from './rppm'

type AttachmentElement =
  | { kind: 'text'; text: string; style?: 'heading' | 'task' }
  | { kind: 'list'; items: string[]; ordered?: boolean }
  | { kind: 'table'; headers: string[]; rows: string[][][]; widths?: number[]; minRowMm?: number }
  | { kind: 'answer'; lines: number; ruled: boolean }

function blocks(items: RppmBlock[]): AttachmentElement[] {
  return items.flatMap((item): AttachmentElement[] => {
    if (item.jenis === 'teks') return [{ kind: 'text', text: item.teks }]
    if (item.jenis === 'daftar') return [{ kind: 'list', items: item.poin }]
    if (!item.kolom.length) return []
    return [{ kind: 'table', headers: item.kolom, rows: item.baris.map(row => row.map(value => [value])) }]
  })
}

export function rppmAttachmentPages(value: RppmAttachments, spec: RppmSpec) {
  const { ringkasan_materi: summary, lkpd, rubrik } = value
  const meta = [spec.mata_pelajaran, spec.kelas_semester, spec.topik_pembelajaran].filter(Boolean).join(' · ')
  const heading = (text: string): AttachmentElement => ({ kind: 'text', text, style: 'heading' })
  const text = (value: string): AttachmentElement => ({ kind: 'text', text: value })
  const identity = (group: boolean) => text(group
    ? 'Kelompok ........................................     Tanggal ........................\nAnggota ................................................................................'
    : 'Nama ........................................     Kelas ............     Tanggal ........................')
  const tasks = lkpd.tugas.flatMap(({ instruksi, jawaban }, index): AttachmentElement[] => {
    const task: AttachmentElement = { kind: 'text', style: 'task', text: `${index + 1}. ${instruksi}` }
    if (!jawaban) return [task]
    if (jawaban.jenis === 'tabel') {
      if (!jawaban.kolom.length) return [task]
      return [task, {
        kind: 'table', headers: jawaban.kolom, minRowMm: 9,
        rows: Array.from({ length: jawaban.jumlah_baris }, () => jawaban.kolom.map(() => [''])),
      }]
    }
    return [task, { kind: 'answer', lines: jawaban.jenis === 'garis' ? jawaban.jumlah : 5, ruled: jawaban.jenis === 'garis' }]
  })
  const rubricTable = (kind: 'proses' | 'sikap'): AttachmentElement => ({
    kind: 'table',
    headers: RPPM_RUBRIC_COLUMNS,
    widths: RPPM_RUBRIC_WIDTHS,
    rows: rubrik[kind].map(rppmRubricCells),
  })
  const pages: AttachmentElement[][] = [
    [text(summary.pengantar), heading('Konsep Inti'), ...blocks(summary.konsep), heading('Contoh'), ...blocks(summary.contoh)],
    [
      identity(lkpd.identitas === 'kelompok'), heading('Tujuan'), text(lkpd.tujuan), heading('Stimulus'), ...blocks(lkpd.stimulus),
      heading('Petunjuk'), { kind: 'list', items: lkpd.petunjuk, ordered: true },
      heading('Tugas'), ...tasks, heading('Refleksi'), { kind: 'text', text: lkpd.refleksi, style: 'task' },
      { kind: 'answer', lines: 3, ruled: true },
    ],
    [
      text('Nama atau kelompok ........................................     Tanggal ........................'),
      heading('Petunjuk Penggunaan'), text(rubrik.petunjuk),
      heading('Observasi Proses'), rubricTable('proses'),
      heading('Penilaian Sikap'), rubricTable('sikap'),
    ],
  ]
  return pages.map((elements, index) => ({
    label: `Lampiran ${index + 1}`,
    title: RPPM_ATTACHMENT_TITLES[index],
    meta,
    elements,
  }))
}

export const RPPM_MAIN_TABLE_WIDTHS = [5, 30, 65]
export const RPPM_SIGNATURE_WIDTHS = [44, 18, 38]

export function rppmKerangkaDetails(value: string) {
  return value.split('\n').filter(line => !/^\s*praktik pedagogis(?:\s|:)/i.test(line)).join('\n')
}
