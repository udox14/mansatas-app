export const RPPM_TEMPLATE_TYPES = [
  'cooperative-learning',
  'discovery-learning',
  'lok-r',
  'pbl',
  'pjbl',
] as const

export type RppmTemplateType = typeof RPPM_TEMPLATE_TYPES[number]

export type RppmSpec = {
  satuan_pendidikan: string
  mata_pelajaran: string
  kelas_semester: string
  topik_pembelajaran: string
  alokasi_waktu: string
}

export type RppmContent = {
  spesifikasi: RppmSpec
  identifikasi: {
    asesmen_awal: string
    dimensi_profil_lulusan: string[]
    topik_panca_cinta: string[]
    materi_integrasi_kbc: string
  }
  desain_pembelajaran: {
    tujuan_pembelajaran: string
    kerangka_pembelajaran: string
  }
  pengalaman_belajar: {
    kegiatan_awal: string[]
    kegiatan_inti: {
      memahami: string[]
      mengaplikasi: string[]
      merefleksi: string[]
    }
    kegiatan_penutup: string[]
  }
  asesmen_pembelajaran: {
    asesmen_proses: string
    asesmen_akhir: string
  }
}

export type RppmPrintSettings = {
  paper: 'F4' | 'A4'
  margins: { top: number; right: number; bottom: number; left: number }
}

export type RppmValidationError = {
  path: string
  label: string
  message: string
}

export type RppmTemplateConfig = {
  type: RppmTemplateType
  label: string
  shortLabel: string
  modelLabel: string
  description: string
  intiHints: {
    memahami: string[]
    mengaplikasi: string[]
    merefleksi: string[]
  }
}

const EMPTY_SPEC: RppmSpec = {
  satuan_pendidikan: '',
  mata_pelajaran: '',
  kelas_semester: '',
  topik_pembelajaran: '',
  alokasi_waktu: '',
}

export const DEFAULT_RPPM_PRINT_SETTINGS: RppmPrintSettings = {
  paper: 'F4',
  margins: { top: 20, right: 20, bottom: 20, left: 20 },
}

export const RPPM_DPL_OPTIONS = [
  'DPL 1 Keimanan dan Ketakwaan kepada Tuhan YME',
  'DPL 2 Kewargaan',
  'DPL 3 Penalaran Kritis',
  'DPL 4 Kreativitas',
  'DPL 5 Kolaborasi',
  'DPL 6 Kemandirian',
  'DPL 7 Kesehatan',
  'DPL 8 Komunikasi',
]

export const RPPM_PANCA_CINTA_OPTIONS = [
  'Topik 1 Cinta Allah dan Rasul-Nya',
  'Topik 2 Cinta Ilmu',
  'Topik 3 Cinta Lingkungan',
  'Topik 4 Cinta Diri dan Sesama Manusia',
  'Topik 5 Cinta Tanah Air',
]

export const RPPM_TEMPLATES: RppmTemplateConfig[] = [
  {
    type: 'cooperative-learning',
    label: 'Cooperative Learning',
    shortLabel: 'Cooperative',
    modelLabel: 'Cooperative Learning',
    description: 'Pembelajaran tim, diskusi, presentasi, dan penghargaan kelompok.',
    intiHints: {
      memahami: ['Guru menyajikan informasi awal yang relevan dengan topik pembelajaran.'],
      mengaplikasi: [
        'Guru mengorganisir murid ke dalam tim belajar.',
        'Tiap kelompok mengumpulkan dan mengolah informasi dari berbagai sumber.',
        'Guru membantu kerja tim belajar sesuai kebutuhan.',
      ],
      merefleksi: [
        'Murid mengomunikasikan kesimpulan hasil diskusi kelompok.',
        'Guru memberi umpan balik dan penghargaan atas hasil kerja murid.',
      ],
    },
  },
  {
    type: 'discovery-learning',
    label: 'Discovery Learning',
    shortLabel: 'Discovery',
    modelLabel: 'Discovery Learning',
    description: 'Stimulation, problem statement, data collecting, processing, verification, generalization.',
    intiHints: {
      memahami: [
        'Stimulation: murid mengamati media, fenomena, masalah, atau bahan ajar.',
        'Problem statement: murid merumuskan pertanyaan atau dugaan awal.',
      ],
      mengaplikasi: [
        'Data collecting: murid mengumpulkan informasi dari sumber relevan.',
        'Data processing: murid mengolah dan menafsirkan data yang diperoleh.',
      ],
      merefleksi: [
        'Verification: murid memeriksa temuan untuk membuktikan dugaan awal.',
        'Generalization: murid menyimpulkan hasil pembelajaran.',
      ],
    },
  },
  {
    type: 'lok-r',
    label: 'LOK-R',
    shortLabel: 'LOK-R',
    modelLabel: 'LOK-R',
    description: 'Literasi, orientasi, kolaborasi, dan refleksi.',
    intiHints: {
      memahami: ['Literasi: murid membaca, mengamati, atau menyimak sumber belajar.', 'Orientasi: guru mengarahkan fokus masalah atau konsep utama.'],
      mengaplikasi: ['Kolaborasi: murid bekerja bersama untuk mengolah informasi dan menyelesaikan tugas.'],
      merefleksi: ['Refleksi: murid dan guru meninjau proses, hasil, dan tindak lanjut pembelajaran.'],
    },
  },
  {
    type: 'pbl',
    label: 'Problem Based Learning',
    shortLabel: 'PBL',
    modelLabel: 'Problem Based Learning',
    description: 'Orientasi masalah, penyelidikan, presentasi solusi, dan evaluasi proses.',
    intiHints: {
      memahami: [
        'Guru mengorientasikan murid pada permasalahan kontekstual terkait materi pembelajaran.',
        'Guru menyajikan studi kasus sebagai skenario masalah.',
      ],
      mengaplikasi: [
        'Murid dibagi ke dalam kelompok belajar.',
        'Murid melakukan penyelidikan mandiri dan kelompok dari berbagai referensi.',
        'Guru membimbing proses pemecahan masalah.',
      ],
      merefleksi: [
        'Murid mengembangkan dan menyajikan hasil pemecahan masalah.',
        'Murid bersama guru menganalisis serta mengevaluasi proses pemecahan masalah.',
      ],
    },
  },
  {
    type: 'pjbl',
    label: 'Project Based Learning',
    shortLabel: 'PjBL',
    modelLabel: 'Project Based Learning',
    description: 'Pertanyaan pemantik, perencanaan proyek, pelaksanaan, presentasi produk, dan evaluasi.',
    intiHints: {
      memahami: [
        'Murid menyiapkan pertanyaan atau penugasan proyek.',
        'Guru mengajukan pertanyaan pemantik dan menggali isu kontekstual.',
      ],
      mengaplikasi: [
        'Murid mendesain perencanaan proyek.',
        'Murid menyusun pedoman, instrumen, pembagian kelompok, dan jadwal proyek.',
        'Murid melaksanakan proyek sesuai rancangan.',
      ],
      merefleksi: [
        'Murid menguji hasil dan menyajikan produk.',
        'Murid mengevaluasi kegiatan atau pengalaman proyek secara individu dan kelompok.',
      ],
    },
  },
]

export function getRppmTemplate(type: string | null | undefined): RppmTemplateConfig {
  return RPPM_TEMPLATES.find(template => template.type === type) || RPPM_TEMPLATES[0]
}

export function emptyRppmContent(spec?: Partial<RppmSpec>): RppmContent {
  return {
    spesifikasi: { ...EMPTY_SPEC, ...cleanSpec(spec || {}) },
    identifikasi: {
      asesmen_awal: '',
      dimensi_profil_lulusan: [],
      topik_panca_cinta: [],
      materi_integrasi_kbc: '',
    },
    desain_pembelajaran: {
      tujuan_pembelajaran: '',
      kerangka_pembelajaran: '',
    },
    pengalaman_belajar: {
      kegiatan_awal: [],
      kegiatan_inti: {
        memahami: [],
        mengaplikasi: [],
        merefleksi: [],
      },
      kegiatan_penutup: [],
    },
    asesmen_pembelajaran: {
      asesmen_proses: '',
      asesmen_akhir: '',
    },
  }
}

export function normalizeRppmContent(value: unknown, fallbackSpec?: Partial<RppmSpec>): RppmContent {
  const base = emptyRppmContent(fallbackSpec)
  if (!isRecord(value)) return base

  const spesifikasi = isRecord(value.spesifikasi) ? value.spesifikasi : {}
  const identifikasi = isRecord(value.identifikasi) ? value.identifikasi : {}
  const desain = isRecord(value.desain_pembelajaran) ? value.desain_pembelajaran : {}
  const pengalaman = isRecord(value.pengalaman_belajar) ? value.pengalaman_belajar : {}
  const inti = isRecord(pengalaman.kegiatan_inti) ? pengalaman.kegiatan_inti : {}
  const asesmen = isRecord(value.asesmen_pembelajaran) ? value.asesmen_pembelajaran : {}

  return {
    spesifikasi: {
      ...base.spesifikasi,
      ...cleanSpec(spesifikasi),
    },
    identifikasi: {
      asesmen_awal: cleanText(identifikasi.asesmen_awal),
      dimensi_profil_lulusan: cleanTextArray(identifikasi.dimensi_profil_lulusan),
      topik_panca_cinta: cleanTextArray(identifikasi.topik_panca_cinta),
      materi_integrasi_kbc: cleanText(identifikasi.materi_integrasi_kbc),
    },
    desain_pembelajaran: {
      tujuan_pembelajaran: cleanText(desain.tujuan_pembelajaran),
      kerangka_pembelajaran: cleanText(desain.kerangka_pembelajaran),
    },
    pengalaman_belajar: {
      kegiatan_awal: cleanTextArray(pengalaman.kegiatan_awal),
      kegiatan_inti: {
        memahami: cleanTextArray(inti.memahami),
        mengaplikasi: cleanTextArray(inti.mengaplikasi),
        merefleksi: cleanTextArray(inti.merefleksi),
      },
      kegiatan_penutup: cleanTextArray(pengalaman.kegiatan_penutup),
    },
    asesmen_pembelajaran: {
      asesmen_proses: cleanText(asesmen.asesmen_proses),
      asesmen_akhir: cleanText(asesmen.asesmen_akhir),
    },
  }
}

export function parseRppmJson(raw: string, fallbackSpec?: Partial<RppmSpec>): { content: RppmContent | null; error: string | null } {
  try {
    const parsed = JSON.parse(raw)
    return { content: normalizeRppmContent(parsed, fallbackSpec), error: null }
  } catch {
    return { content: null, error: 'File tidak berisi JSON yang valid.' }
  }
}

export function validateRppmContent(content: RppmContent): RppmValidationError[] {
  const errors: RppmValidationError[] = []
  requireText(errors, content.spesifikasi.satuan_pendidikan, 'spesifikasi.satuan_pendidikan', 'Satuan Pendidikan')
  requireText(errors, content.spesifikasi.mata_pelajaran, 'spesifikasi.mata_pelajaran', 'Mata Pelajaran')
  requireText(errors, content.spesifikasi.kelas_semester, 'spesifikasi.kelas_semester', 'Kelas / Semester')
  requireText(errors, content.spesifikasi.topik_pembelajaran, 'spesifikasi.topik_pembelajaran', 'Topik Pembelajaran')
  requireText(errors, content.spesifikasi.alokasi_waktu, 'spesifikasi.alokasi_waktu', 'Alokasi Waktu')
  requireText(errors, content.identifikasi.asesmen_awal, 'identifikasi.asesmen_awal', 'Asesmen pada Awal Pembelajaran')
  requireArray(errors, content.identifikasi.dimensi_profil_lulusan, 'identifikasi.dimensi_profil_lulusan', 'Dimensi Profil Lulusan')
  requireArray(errors, content.identifikasi.topik_panca_cinta, 'identifikasi.topik_panca_cinta', 'Topik Panca Cinta')
  requireText(errors, content.identifikasi.materi_integrasi_kbc, 'identifikasi.materi_integrasi_kbc', 'Materi Integrasi KBC')
  requireText(errors, content.desain_pembelajaran.tujuan_pembelajaran, 'desain_pembelajaran.tujuan_pembelajaran', 'Tujuan Pembelajaran')
  requireText(errors, content.desain_pembelajaran.kerangka_pembelajaran, 'desain_pembelajaran.kerangka_pembelajaran', 'Kerangka Pembelajaran')
  requireArray(errors, content.pengalaman_belajar.kegiatan_awal, 'pengalaman_belajar.kegiatan_awal', 'Kegiatan Awal')
  requireArray(errors, content.pengalaman_belajar.kegiatan_inti.memahami, 'pengalaman_belajar.kegiatan_inti.memahami', 'Kegiatan Inti - Memahami')
  requireArray(errors, content.pengalaman_belajar.kegiatan_inti.mengaplikasi, 'pengalaman_belajar.kegiatan_inti.mengaplikasi', 'Kegiatan Inti - Mengaplikasi')
  requireArray(errors, content.pengalaman_belajar.kegiatan_inti.merefleksi, 'pengalaman_belajar.kegiatan_inti.merefleksi', 'Kegiatan Inti - Merefleksi')
  requireArray(errors, content.pengalaman_belajar.kegiatan_penutup, 'pengalaman_belajar.kegiatan_penutup', 'Kegiatan Penutup')
  requireText(errors, content.asesmen_pembelajaran.asesmen_proses, 'asesmen_pembelajaran.asesmen_proses', 'Asesmen Proses')
  requireText(errors, content.asesmen_pembelajaran.asesmen_akhir, 'asesmen_pembelajaran.asesmen_akhir', 'Asesmen Akhir')
  return errors
}

export function normalizePrintSettings(value: unknown): RppmPrintSettings {
  if (!isRecord(value)) return DEFAULT_RPPM_PRINT_SETTINGS
  const margins = isRecord(value.margins) ? value.margins : {}
  return {
    paper: value.paper === 'A4' ? 'A4' : 'F4',
    margins: {
      top: cleanMargin(margins.top),
      right: cleanMargin(margins.right),
      bottom: cleanMargin(margins.bottom),
      left: cleanMargin(margins.left),
    },
  }
}

export function buildRppmPrompt(templateType: RppmTemplateType, spec: RppmSpec): string {
  const template = getRppmTemplate(templateType)
  const schema = emptyRppmContent(spec)
  const hints = [
    `Memahami: ${template.intiHints.memahami.join(' ')}`,
    `Mengaplikasi: ${template.intiHints.mengaplikasi.join(' ')}`,
    `Merefleksi: ${template.intiHints.merefleksi.join(' ')}`,
  ].join('\n')

  return [
    'Anda adalah asisten penyusun RPPM KBC untuk madrasah.',
    `Buat Rencana Pelaksanaan Pembelajaran Mendalam Berbasis Cinta menggunakan model ${template.modelLabel}.`,
    '',
    'Spesifikasi:',
    `- Satuan Pendidikan: ${spec.satuan_pendidikan || '[isi satuan pendidikan]'}`,
    `- Mata Pelajaran: ${spec.mata_pelajaran || '[isi mata pelajaran]'}`,
    `- Kelas / Semester: ${spec.kelas_semester || '[isi kelas/semester]'}`,
    `- Topik Pembelajaran: ${spec.topik_pembelajaran || '[isi topik]'}`,
    `- Alokasi Waktu: ${spec.alokasi_waktu || '[isi alokasi waktu]'}`,
    '',
    'Acuan Dimensi Profil Lulusan:',
    RPPM_DPL_OPTIONS.map(item => `- ${item}`).join('\n'),
    '',
    'Acuan Topik Panca Cinta:',
    RPPM_PANCA_CINTA_OPTIONS.map(item => `- ${item}`).join('\n'),
    '',
    'Acuan kegiatan inti untuk model ini:',
    hints,
    '',
    'Kembalikan hanya JSON valid tanpa markdown, tanpa komentar, tanpa teks pembuka/penutup.',
    'Gunakan shape JSON berikut. Isi semua string dan array dengan konten final siap dipakai:',
    JSON.stringify(schema, null, 2),
  ].join('\n')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cleanSpec(value: Record<string, unknown>): Partial<RppmSpec> {
  return {
    satuan_pendidikan: cleanText(value.satuan_pendidikan),
    mata_pelajaran: cleanText(value.mata_pelajaran),
    kelas_semester: cleanText(value.kelas_semester),
    topik_pembelajaran: cleanText(value.topik_pembelajaran),
    alokasi_waktu: cleanText(value.alokasi_waktu),
  }
}

function cleanText(value: unknown): string {
  return String(value ?? '').replace(/\r\n/g, '\n').trim()
}

export function cleanTextArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(item => cleanText(item)).filter(Boolean)
  }
  const text = cleanText(value)
  if (!text) return []
  return text.split('\n').map(item => item.replace(/^[-*\d. )]+/, '').trim()).filter(Boolean)
}

function requireText(errors: RppmValidationError[], value: string, path: string, label: string) {
  if (!value.trim()) errors.push({ path, label, message: `${label} wajib diisi.` })
}

function requireArray(errors: RppmValidationError[], value: string[], path: string, label: string) {
  if (value.length === 0) errors.push({ path, label, message: `${label} wajib diisi minimal 1 poin.` })
}

function cleanMargin(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0 || n > 50) return 20
  return n
}
