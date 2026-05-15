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
  konteks_topik?: string
  tanggal_ttd?: string
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
  methodText: string
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
  konteks_topik: '',
  tanggal_ttd: '',
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
    methodText: 'tanya-jawab, diskusi, presentasi, penugasan',
    intiHints: {
      memahami: ['Guru menyajikan informasi berupa bahan, media, kasus, teks, gambar, video, atau fenomena yang langsung terkait topik pembelajaran.'],
      mengaplikasi: [
        'Guru mengorganisir murid ke dalam tim-tim belajar.',
        'Tiap kelompok mengumpulkan berbagai informasi yang relevan dari berbagai sumber tentang topik pembelajaran.',
        'Guru membantu kerja tim belajar ketika murid mengolah data/informasi dan menafsirkan hasilnya.',
      ],
      merefleksi: [
        'Guru mengevaluasi proses kerja kelompok.',
        'Murid mengomunikasikan kesimpulan sebagai hasil diskusi kelompok di depan kelas.',
        'Guru memberikan penghargaan kepada murid atas hasil kerja berupa pujian, applause, atau bentuk apresiasi lain.',
      ],
    },
  },
  {
    type: 'discovery-learning',
    label: 'Discovery Learning',
    shortLabel: 'Discovery',
    modelLabel: 'Discovery Learning',
    description: 'Stimulation, problem statement, data collecting, processing, verification, generalization.',
    methodText: 'tanya-jawab, diskusi, presentasi, penugasan',
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
    methodText: 'tanya-jawab, diskusi, presentasi, penugasan',
    intiHints: {
      memahami: [
        'Literasi: murid membaca, mengamati, menyimak, atau menelaah sumber belajar sesuai topik.',
        'Orientasi: guru mengarahkan fokus konsep, masalah, nilai KBC, dan tujuan aktivitas.',
      ],
      mengaplikasi: ['Kolaborasi: murid bekerja bersama untuk mengolah informasi, menyelesaikan tugas, dan menyusun hasil belajar.'],
      merefleksi: ['Refleksi: murid dan guru meninjau proses, hasil, nilai KBC, serta tindak lanjut pembelajaran.'],
    },
  },
  {
    type: 'pbl',
    label: 'Problem Based Learning',
    shortLabel: 'PBL',
    modelLabel: 'Problem Based Learning',
    description: 'Orientasi masalah, penyelidikan, presentasi solusi, dan evaluasi proses.',
    methodText: 'tanya-jawab, diskusi, presentasi, penugasan',
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
    methodText: 'tanya-jawab, diskusi, presentasi, penugasan proyek',
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
    const parsed = JSON.parse(stripJsonFence(raw))
    return { content: normalizeRppmContent(parsed, fallbackSpec), error: null }
  } catch {
    return { content: null, error: 'Teks yang dipaste tidak berisi JSON yang valid.' }
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
  const modelFrame = buildModelFrame(template)
  const kerangkaFrame = buildKerangkaFrame(template, spec)
  const contentContract = buildContentContract(template)

  return [
    'Anda adalah penyusun RPPM KBC madrasah. Tugas Anda mengisi template RPPM, bukan membuat format baru.',
    `Gunakan MODEL PEMBELAJARAN: ${template.modelLabel}.`,
    'Output harus sangat setia pada struktur template RPPM KBC: A Spesifikasi, B Identifikasi, C Desain Pembelajaran, D Pengalaman Belajar, E Asesmen Pembelajaran.',
    'Jangan menambah bagian baru, jangan mengubah nama bagian, dan jangan menghilangkan baris template.',
    '',
    'DATA SPESIFIKASI YANG WAJIB DIPAKAI APA ADANYA:',
    `- Satuan Pendidikan: ${spec.satuan_pendidikan || '[isi satuan pendidikan]'}`,
    `- Mata Pelajaran: ${spec.mata_pelajaran || '[isi mata pelajaran]'}`,
    `- Kelas / Semester: ${spec.kelas_semester || '[isi kelas/semester]'}`,
    `- Topik Pembelajaran: ${spec.topik_pembelajaran || '[isi topik]'}`,
    `- Alokasi Waktu: ${spec.alokasi_waktu || '[isi alokasi waktu]'}`,
    `- Konteks Topik / Catatan Pengarah: ${spec.konteks_topik || '[tidak ada konteks tambahan]'}`,
    '',
    'ATURAN PENGGUNAAN KONTEKS TOPIK:',
    '- Konteks Topik hanya untuk mengarahkan isi pembelajaran, bukan untuk mengganti Topik Pembelajaran.',
    '- Jika Topik Pembelajaran adalah judul ringkas, tetap gunakan judul itu pada field spesifikasi.topik_pembelajaran.',
    '- Gunakan Konteks Topik untuk menentukan fokus pembahasan, batasan materi, contoh, teks bacaan, perbandingan, atau kasus yang harus muncul dalam kegiatan belajar.',
    '- Jangan menyalin seluruh Konteks Topik ke field spesifikasi.topik_pembelajaran.',
    '- Jika ada teks bacaan dalam Konteks Topik, gunakan sebagai sumber aktivitas, pertanyaan pemantik, bahan memahami, mengaplikasi, atau asesmen.',
    '',
    'DAFTAR DPL YANG BOLEH DIPILIH:',
    RPPM_DPL_OPTIONS.map(item => `- ${item}`).join('\n'),
    '',
    'DAFTAR TOPIK PANCA CINTA YANG BOLEH DIPILIH:',
    RPPM_PANCA_CINTA_OPTIONS.map(item => `- ${item}`).join('\n'),
    '',
    'ATURAN PEMILIHAN DPL DAN PANCA CINTA:',
    '- Jangan memasukkan semua DPL atau semua Topik Panca Cinta secara otomatis.',
    '- Pilih hanya yang benar-benar relevan, alami, dan bisa dipertanggungjawabkan untuk topik/materi pembelajaran.',
    '- Jika hanya 1-3 DPL yang kuat, gunakan 1-3 saja.',
    '- Jika hanya 1 topik Panca Cinta yang cocok, gunakan 1 saja.',
    '- Jelaskan materi integrasi KBC sesuai pilihan Topik Panca Cinta yang dipilih, jangan memaksakan topik yang tidak nyambung.',
    '',
    'KERANGKA PEMBELAJARAN HARUS MENGIKUTI TEMPLATE INI:',
    kerangkaFrame,
    '',
    'PENGALAMAN BELAJAR HARUS MENGIKUTI TEMPLATE INI:',
    contentContract,
    '',
    `SINTAKS KEGIATAN INTI KHUSUS MODEL ${template.modelLabel.toUpperCase()}:`,
    modelFrame,
    '',
    'ATURAN KESETIAAN TERHADAP TEMPLATE:',
    '- Bagian kegiatan_awal harus memuat salam/doa, kondisi siap belajar, presensi/apresiasi kehadiran, motivasi/ice breaking, apersepsi/refleksi awal, pertanyaan pemantik, tujuan/kegiatan/teknik penilaian.',
    '- Bagian kegiatan_penutup harus memuat penguatan, kesimpulan, refleksi, umpan balik, Exit Ticket, informasi kegiatan berikutnya/tindak lanjut, doa, dan salam.',
    '- Bagian asesmen_proses harus berfungsi sebagai asesmen untuk perbaikan proses pembelajaran dan umpan balik progres belajar.',
    '- Bagian asesmen_akhir harus mengukur capaian pembelajaran pada akhir pembelajaran.',
    '- Gunakan istilah Memahami, Mengaplikasi, dan Merefleksi persis sesuai template.',
    '- Isi harus konkret sesuai mata pelajaran, kelas/semester, topik, dan alokasi waktu.',
    '- Jangan membuat isi generik seperti "materi ajar" jika data topik sudah tersedia; ganti dengan topik spesifik.',
    '',
    'ATURAN FORMAT JSON:',
    '- Kembalikan hanya JSON valid tanpa markdown, tanpa komentar, tanpa teks pembuka/penutup.',
    '- Untuk field array, isi setiap poin sebagai 1 item array, tanpa nomor manual.',
    '- Untuk field string yang berisi lebih dari satu subbagian, pisahkan setiap subbagian dengan baris baru.',
    '- Jangan menulis paragraf panjang yang mencampur banyak kegiatan dalam satu kalimat.',
    '- Pastikan semua field dalam schema terisi.',
    '',
    'SCHEMA JSON WAJIB:',
    JSON.stringify(schema, null, 2),
  ].join('\n')
}

function buildKerangkaFrame(template: RppmTemplateConfig, spec: RppmSpec) {
  const topic = spec.topik_pembelajaran || '[topik pembelajaran]'
  return [
    `Praktik Pedagogis Model Pembelajaran: ${template.modelLabel}`,
    `Metode: ${template.methodText}`,
    'Kemitraan pembelajaran (opsional):',
    '- Kolaborasi guru dengan murid.',
    '- Kolaborasi guru dengan wali kelas.',
    '- Kolaborasi antarmurid (peer teaching).',
    'Lingkungan Pembelajaran:',
    '- Lingkungan Fisik: ruang kelas fleksibel dan kondusif dalam setting kelompok dengan perangkat audio visual.',
    '- Ruang virtual: daring jika diperlukan, misalnya Google Meet/Zoom/kelas digital.',
    '- Budaya Belajar: kolaboratif, interaktif, dan dukungan guru untuk mengaktifkan murid.',
    'Pemanfaatan Digital (opsional):',
    `- Video/Animasi: guru menggunakan video/animasi tentang ${topic} sebagai stimulus.`,
    `- Pencarian Informasi: murid menggunakan browser, Qur'an digital, perpustakaan digital, atau sumber relevan terkait ${topic}.`,
    `- Pembuatan Produk: murid dapat memakai PowerPoint/Google Slides, Canva/PosterMyWall, MindMeister/XMind, atau alat digital relevan untuk menyajikan hasil belajar tentang ${topic}.`,
    '',
    'Masukkan kerangka di atas ke field desain_pembelajaran.kerangka_pembelajaran sebagai string multi-baris. Sesuaikan detailnya dengan topik, tetapi pertahankan subjudul Metode, Kemitraan, Lingkungan Pembelajaran, dan Pemanfaatan Digital.',
  ].join('\n')
}

function buildContentContract(template: RppmTemplateConfig) {
  return [
    'kegiatan_awal harus berupa array 6-8 poin yang mengadaptasi redaksi template:',
    '- Mengucapkan salam dan mengajak berdoa.',
    '- Mengkondisikan murid siap untuk belajar.',
    '- Mempresensi dan mengapresiasi kehadiran.',
    '- Memotivasi murid dengan ice breaking/permainan atau aktivitas menggembirakan.',
    '- Apersepsi/refleksi awal dengan mengaitkan materi sebelumnya.',
    '- Mengajukan pertanyaan pemantik sesuai topik.',
    '- Menyampaikan tujuan, kegiatan, dan teknik penilaian.',
    '',
    'kegiatan_inti wajib dibagi tepat menjadi:',
    '- memahami: array poin sesuai sintaks Memahami.',
    '- mengaplikasi: array poin sesuai sintaks Mengaplikasi.',
    '- merefleksi: array poin sesuai sintaks Merefleksi.',
    '',
    'kegiatan_penutup harus berupa array 5-6 poin yang mengadaptasi redaksi template:',
    '- Penguatan, penarikan kesimpulan, refleksi, dan umpan balik.',
    '- Exit Ticket: asesmen formatif sederhana di akhir pembelajaran.',
    '- Murid menjawab pertanyaan singkat sebelum meninggalkan kelas.',
    '- Guru menyampaikan informasi kegiatan yang akan datang sebagai rencana tindak lanjut.',
    '- Guru menutup kegiatan dengan mengajak murid bersyukur, berdoa, dan mengucapkan salam.',
    '',
    'asesmen_pembelajaran harus mengikuti karakter template:',
    '- asesmen_proses: jelaskan asesmen untuk perbaikan proses pembelajaran, umpan balik progres murid, dan refleksi guru; contoh bisa penilaian sejawat, penilaian diri, observasi, jurnal, pertanyaan diagnostik, atau umpan balik formatif.',
    '- asesmen_akhir: jelaskan asesmen untuk mengukur capaian pembelajaran akhir; pilih contoh yang relevan dengan model/topik, misalnya proyek, produk, portofolio, kinerja, tes tertulis, atau tes lisan.',
    '',
    `Pastikan semua isi kegiatan inti menggunakan model ${template.modelLabel}, bukan model lain.`,
  ].join('\n')
}

function buildModelFrame(template: RppmTemplateConfig) {
  return [
    'Memahami:',
    ...template.intiHints.memahami.map(item => `- ${item}`),
    '',
    'Mengaplikasi:',
    ...template.intiHints.mengaplikasi.map(item => `- ${item}`),
    '',
    'Merefleksi:',
    ...template.intiHints.merefleksi.map(item => `- ${item}`),
  ].join('\n')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stripJsonFence(raw: string) {
  const text = raw.trim()
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced ? fenced[1].trim() : text
}

function cleanSpec(value: Record<string, unknown>): Partial<RppmSpec> {
  return {
    satuan_pendidikan: cleanText(value.satuan_pendidikan),
    mata_pelajaran: cleanText(value.mata_pelajaran),
    kelas_semester: cleanText(value.kelas_semester),
    topik_pembelajaran: cleanText(value.topik_pembelajaran),
    alokasi_waktu: cleanText(value.alokasi_waktu),
    konteks_topik: cleanText(value.konteks_topik),
    tanggal_ttd: cleanText(value.tanggal_ttd),
  }
}

export function formatTanggalRppm(dateStr?: string) {
  if (!dateStr) return ''
  const date = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
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
  if (value.filter(item => item.trim()).length === 0) errors.push({ path, label, message: `${label} wajib diisi minimal 1 poin.` })
}

function cleanMargin(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0 || n > 50) return 20
  return n
}
