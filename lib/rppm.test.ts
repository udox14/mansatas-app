import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { buildRppmDocxBlob } from './rppm-docx'
import {
  DEFAULT_RPPM_PRINT_SETTINGS,
  buildRppmAttachmentsPrompt,
  buildRppmPrompt,
  emptyRppmPackage,
  getRppmTemplate,
  normalizeRppmContent,
  parseRppmPackage,
  replaceRppmAttachments,
  validateRppmOutput,
  type RppmSpec,
  type RppmTemplateType,
} from './rppm'
import type { RppmAnswer, RppmBlock } from './rppm-attachments'

const scenarios = [
  {
    model: 'cooperative-learning', mapel: 'Bahasa Indonesia', topik: 'Klaim dan bukti dalam teks argumentasi',
    konsep: 'Klaim adalah pendapat yang dipertahankan. Bukti adalah informasi yang dapat diperiksa untuk mendukung klaim.',
    stimulus: { jenis: 'teks', teks: 'Perpustakaan perlu menambah jam buka. Dalam survei kelas, 18 dari 25 murid meminta akses selepas pelajaran.' },
    tujuan: 'Membedakan klaim dan bukti serta menjelaskan keterkaitannya.',
    kegiatan: 'Tim membaca usulan jam buka perpustakaan dan saling memeriksa penandaan klaim serta bukti.',
    tugas: 'Tulis klaim, kutip satu bukti, lalu jelaskan mengapa bukti itu mendukung klaim.',
    bukti: 'Klaim, kutipan hasil survei, dan alasan yang tertulis.',
    jawaban: { jenis: 'garis', jumlah: 4 },
  },
  {
    model: 'discovery-learning', mapel: 'Matematika', topik: 'Penafsiran tabel frekuensi',
    konsep: 'Frekuensi menyatakan jumlah kemunculan sebuah nilai. Jumlah frekuensi sama dengan jumlah pengamatan.',
    stimulus: { jenis: 'tabel', kolom: ['Buku dibaca', 'Jumlah murid'], baris: [['1', '4'], ['2', '9'], ['3', '5']] },
    tujuan: 'Menentukan nilai yang paling sering muncul dan menafsirkannya dengan data.',
    kegiatan: 'Murid menduga nilai yang paling sering muncul, lalu memeriksa dugaan dengan membandingkan frekuensi pada tabel.',
    tugas: 'Tentukan jumlah murid dan nilai yang paling sering muncul. Tunjukkan perhitungan dan data pendukung.',
    bukti: 'Jumlah 18 murid dan kesimpulan 2 buku, didukung frekuensi 9 murid.',
    jawaban: { jenis: 'area' },
  },
  {
    model: 'lok-r', mapel: 'Sejarah', topik: 'Membedakan kesaksian dan catatan administrasi',
    konsep: 'Kesaksian mencatat pengalaman seseorang, sedangkan catatan administrasi merekam keputusan atau tindakan lembaga.',
    stimulus: { jenis: 'daftar', poin: ['Contoh kesaksian: warga mulai memakai pasar sebelum peresmian.', 'Contoh catatan: pengelola menetapkan tanggal peresmian 12 Mei.'] },
    tujuan: 'Menjelaskan perbedaan informasi dari dua jenis sumber.',
    kegiatan: 'Setelah membaca dua sumber contoh, murid membandingkan sudut pandang dan informasi yang dapat diperiksa.',
    tugas: 'Catat jenis sumber, informasi yang didukung, dan satu hal yang perlu diverifikasi untuk masing-masing sumber.',
    bukti: 'Tabel perbandingan memisahkan awal pemakaian pasar dari tanggal peresmian.',
    jawaban: { jenis: 'tabel', kolom: ['Jenis sumber', 'Informasi', 'Perlu diperiksa'], jumlah_baris: 2 },
  },
  {
    model: 'pbl', mapel: 'Biologi', topik: 'Pengaruh limpasan terhadap kualitas air',
    konsep: 'Limpasan permukaan dapat membawa tanah dan bahan lain ke badan air. Kekeruhan dapat meningkat karena partikel tersuspensi.',
    stimulus: { jenis: 'teks', teks: 'Kasus simulasi. Air di hilir kebun terlihat lebih keruh setelah hujan. Air di titik hulu tampak lebih jernih.' },
    tujuan: 'Mengusulkan penjelasan dan cara memeriksa dugaan tentang sumber kekeruhan.',
    kegiatan: 'Kelompok menyelidiki kasus, membandingkan hulu dan hilir, lalu mempresentasikan pemeriksaan yang diusulkan.',
    tugas: 'Jelaskan dugaan penyebab, pilih dua titik pengamatan, dan jelaskan data yang dibutuhkan untuk menguji dugaan.',
    bukti: 'Usulan membandingkan kekeruhan di hulu dan hilir pada waktu pengamatan yang sama.',
    jawaban: { jenis: 'area' },
  },
  {
    model: 'pjbl', mapel: 'Informatika', topik: 'Prototipe pencatat sampah kelas',
    konsep: 'Tabel pencatatan perlu kolom yang konsisten agar data dapat dijumlahkan dan diuji dengan benar.',
    stimulus: { jenis: 'tabel', kolom: ['Jenis sampah', 'Berat contoh (gram)'], baris: [['Kertas', '350'], ['Plastik', '200']] },
    tujuan: 'Menyusun prototipe tabel dan menguji rekap dengan data contoh.',
    kegiatan: 'Tim membagi tugas, membuat prototipe, lalu saling menguji hasil rekap sebelum mempresentasikannya.',
    tugas: 'Susun rencana pembuatan dan pengujian prototipe, lalu catat hasil uji tiap tahap.',
    bukti: 'Prototipe mencatat jenis dan berat serta menghasilkan total uji 550 gram.',
    jawaban: { jenis: 'tabel', kolom: ['Tahap', 'Penanggung jawab', 'Hasil uji'], jumlah_baris: 3 },
  },
] satisfies {
  model: RppmTemplateType
  mapel: string
  topik: string
  konsep: string
  stimulus: RppmBlock
  tujuan: string
  kegiatan: string
  tugas: string
  bukti: string
  jawaban: RppmAnswer
}[]

function sample(scenario = scenarios[1]) {
  const spec: RppmSpec = {
    satuan_pendidikan: 'MAN 1 Tasikmalaya',
    mata_pelajaran: scenario.mapel,
    kelas_semester: 'XI / Ganjil',
    topik_pembelajaran: scenario.topik,
    alokasi_waktu: '2 JP (90 menit)',
    konteks_topik: 'Gunakan stimulus dan data yang disediakan.',
    tanggal_ttd: '2026-11-11',
  }
  const dpl = 'DPL 3 Penalaran Kritis'
  const raw = {
    identifikasi: {
      asesmen_awal: 'Guru meminta murid menyebut informasi yang dapat diperiksa dari stimulus.',
      dimensi_profil_lulusan: [dpl],
      topik_panca_cinta: ['Topik 2 Cinta Ilmu'],
      materi_integrasi_kbc: 'Murid memeriksa dasar simpulan dan memperbaiki catatan jika menemukan kekeliruan.',
    },
    desain_pembelajaran: {
      tujuan_pembelajaran: scenario.tujuan,
      kerangka_pembelajaran: `Praktik Pedagogis Model Pembelajaran: ${getRppmTemplate(scenario.model).modelLabel}\nMetode: telaah stimulus dan pembahasan temuan.\nLingkungan Pembelajaran: ruang kelas dengan meja diskusi.`,
    },
    pengalaman_belajar: {
      kegiatan_awal: ['Salam, doa, dan presensi (5 menit).', 'Guru menjelaskan tujuan dan mengajukan pertanyaan awal (10 menit).'],
      kegiatan_inti: {
        memahami: ['Murid menelaah stimulus dan konsep dari Ringkasan Materi (15 menit).'],
        mengaplikasi: [`${scenario.kegiatan} Murid mencatat hasil di LKPD (30 menit).`],
        merefleksi: ['Murid memeriksa bukti pada jawaban dan memperbaiki simpulan (15 menit).'],
      },
      kegiatan_penutup: ['Murid mengerjakan refleksi, menerima umpan balik, dan menutup kegiatan (15 menit).'],
    },
    asesmen_pembelajaran: {
      asesmen_proses: 'Gunakan Rubrik Observasi Proses dan Penilaian Sikap saat murid memeriksa bukti. Beri umpan balik pada dasar simpulannya.',
      asesmen_akhir: `${scenario.bukti} Murid yang belum tuntas meninjau kembali stimulus dengan contoh terbimbing.`,
    },
    lampiran: {
      ringkasan_materi: {
        pengantar: `Bacaan singkat untuk memulai kegiatan ${scenario.topik.toLowerCase()}.`,
        konsep: [{ jenis: 'teks', teks: scenario.konsep }],
        contoh: [scenario.stimulus],
      },
      lkpd: {
        identitas: 'kelompok',
        tujuan: scenario.tujuan,
        stimulus: [scenario.stimulus],
        petunjuk: ['Baca stimulus. Bahas hasil sebelum menuliskan jawaban.'],
        tugas: [{ instruksi: scenario.tugas, jawaban: scenario.jawaban }],
        refleksi: 'Bukti mana yang paling membantu? Apa yang Anda perbaiki setelah memeriksa kembali jawaban?',
      },
      rubrik: {
        petunjuk: 'Amati tiap indikator selama kegiatan yang disebutkan. Beri skor 1–4 berdasarkan bukti dan catat contoh perilaku.',
        proses: [{
          indikator: 'Menggunakan bukti dari stimulus',
          kegiatan: scenario.kegiatan,
          skor_1: 'Menuliskan simpulan tanpa mengambil informasi dari stimulus.',
          skor_2: 'Mengutip informasi yang kurang relevan dengan simpulan.',
          skor_3: 'Memakai satu bukti relevan untuk mendukung simpulan.',
          skor_4: `Memakai bukti yang tepat dan menjelaskan hubungannya dengan hasil. ${scenario.bukti}`,
        }],
        sikap: [{
          indikator: 'Memeriksa dasar jawaban secara teliti',
          kegiatan: 'Saat memeriksa jawaban sebelum refleksi.',
          acuan: dpl,
          skor_1: 'Melewati pemeriksaan meski sudah diminta.',
          skor_2: 'Memeriksa satu bagian setelah diingatkan.',
          skor_3: 'Memeriksa bukti sebelum menyerahkan jawaban.',
          skor_4: 'Menjelaskan hasil pemeriksaan dan mencatat perbaikan bila diperlukan.',
        }],
      },
    },
  }
  return { raw, spec, content: parseRppmPackage(JSON.stringify(raw), scenario.model, spec) }
}

const signer = { id: 'guru', nama_lengkap: 'Guru Pengampu', nip: null, jabatan_cetak: 'Guru' }

describe('RPPM paket dan lampiran', () => {
  it.each(scenarios)('mempertahankan konteks dan tugas untuk $model', scenario => {
    const { spec, raw, content } = sample(scenario)
    expect(validateRppmOutput(scenario.model, content)).toEqual([])
    expect(content.lampiran?.lkpd.tugas[0]).toEqual(raw.lampiran.lkpd.tugas[0])
    const prompt = buildRppmPrompt(scenario.model, spec, true)
    expect(prompt).toContain(getRppmTemplate(scenario.model).modelLabel)
    expect(prompt).toContain(spec.topik_pembelajaran)
    expect(prompt).toContain('"lampiran"')
    expect(buildRppmAttachmentsPrompt(scenario.model, content)).toContain(scenario.kegiatan)
  })

  it('menerima blok JSON dan memakai spesifikasi formulir', () => {
    const { spec, raw } = sample()
    const json = JSON.stringify({ ...raw, spesifikasi: { topik_pembelajaran: 'Judul dari AI', tanggal_ttd: '' } })
    expect(parseRppmPackage('\x60\x60\x60json\n' + json + '\n\x60\x60\x60', 'discovery-learning', spec).spesifikasi).toEqual(spec)
  })

  it('melaporkan lokasi kesalahan dan mengizinkan paket parsial sebagai draft', () => {
    const { raw, spec } = sample()
    expect(() => parseRppmPackage('{', 'discovery-learning', spec)).toThrow(SyntaxError)
    expect(() => parseRppmPackage('[]', 'discovery-learning', spec)).toThrow('objek JSON')
    expect(() => parseRppmPackage('{"identifikasi":{"asesmen_awal":42}}', 'discovery-learning', spec))
      .toThrow('identifikasi.asesmen_awal')
    const badTable = structuredClone(raw)
    badTable.lampiran.lkpd.stimulus = [{ jenis: 'tabel', kolom: ['Kategori', 'Frekuensi'], baris: [['9']] }]
    expect(() => parseRppmPackage(JSON.stringify(badTable), 'discovery-learning', spec))
      .toThrow('lampiran.lkpd.stimulus.0.baris.0')
    const partial = parseRppmPackage(JSON.stringify({ ...raw, lampiran: { rubrik: { proses: [{}] } } }), 'discovery-learning', spec)
    expect(validateRppmOutput('discovery-learning', partial).map(error => error.path)).toContain('lampiran.rubrik.proses.0.skor_4')
    expect(normalizeRppmContent(JSON.parse(JSON.stringify(emptyRppmPackage(spec)))).format).toBe('paket-v1')
  })

  it('hanya mengganti satu set lampiran lengkap dari naskah yang masih sesuai', () => {
    const { content, raw } = sample()
    const refresh = structuredClone(raw)
    refresh.lampiran.ringkasan_materi.pengantar = 'Pengantar hasil pembaruan.'
    const updated = replaceRppmAttachments(JSON.stringify(refresh), 'discovery-learning', content)
    expect(updated).toEqual({ ...content, lampiran: refresh.lampiran })
    refresh.lampiran.rubrik.sikap[0].skor_4 = ''
    expect(() => replaceRppmAttachments(JSON.stringify(refresh), 'discovery-learning', content)).toThrow('Deskripsi skor 4')
    expect(content.lampiran).toEqual(raw.lampiran)
    expect(() => replaceRppmAttachments(JSON.stringify(raw), 'pbl', content)).toThrow('spesifikasi terkini')
  })

  it('menyimpan acuan impor melalui serialisasi dan mengabaikan tanggal tanda tangan', () => {
    const { content } = sample()
    const reopened = normalizeRppmContent(JSON.parse(JSON.stringify(content)))
    reopened.spesifikasi.tanggal_ttd = '2026-11-12'
    expect(validateRppmOutput('discovery-learning', reopened)).toEqual([])
    reopened.spesifikasi.konteks_topik = 'Gunakan data pengamatan lain.'
    const edited = normalizeRppmContent(JSON.parse(JSON.stringify(reopened)))
    expect(validateRppmOutput('discovery-learning', edited)[0].path).toBe('acuan_import')
  })

  it.each(['A4', 'F4'] as const)('menulis lampiran Word dan memakai lebar yang tersedia pada %s', async paper => {
    const { content } = sample()
    const settings = { paper, margins: { top: 20, right: 50, bottom: 20, left: 50 } }
    const file = buildRppmDocxBlob('discovery-learning', content, settings, signer, null)
    const zip = await JSZip.loadAsync(await file.arrayBuffer())
    const document = await zip.file('word/document.xml')!.async('string')
    const width = (paper === 'A4' ? 11906 : 12242) - 2 * 2835
    expect(document).toContain(`<w:tblW w:w="${width}" w:type="dxa"/>`)
    expect(document.match(/<w:pageBreakBefore\/>/g)).toHaveLength(3)
    expect(document.match(/<w:tblHeader\/>/g)).toHaveLength(4)
    expect(document.indexOf('GURU PENGAMPU')).toBeLessThan(document.indexOf('Lampiran 1'))
    expect(document.indexOf('Lampiran 1')).toBeLessThan(document.indexOf('Lampiran 2'))
    expect(document.indexOf('Lampiran 2')).toBeLessThan(document.indexOf('Lampiran 3'))
    expect(document).toContain('Penafsiran tabel frekuensi')
    expect(document).toContain('<w:cantSplit/>')
    expect(document).toContain('<w:pBdr><w:top')
  })

  it('menjaga format Word lama tanpa syarat lampiran', async () => {
    const { raw, spec } = sample()
    const legacy = normalizeRppmContent({ ...raw, spesifikasi: spec })
    expect(validateRppmOutput('discovery-learning', legacy)).toEqual([])
    const file = buildRppmDocxBlob('discovery-learning', legacy, DEFAULT_RPPM_PRINT_SETTINGS, signer, null)
    const zip = await JSZip.loadAsync(await file.arrayBuffer())
    const document = await zip.file('word/document.xml')!.async('string')
    expect(document).toContain('<w:gridCol w:w="510"/><w:gridCol w:w="2700"/><w:gridCol w:w="6540"/>')
    expect(document).toContain('GURU PENGAMPU')
    expect(document).not.toContain('Lampiran 1')
    expect(document).not.toContain('<w:pageBreakBefore/>')
  })
})
