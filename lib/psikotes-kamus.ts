export type PsikotesKamusItem = {
  kode: string
  nama: string
  deskripsi: string
  kategori: 'IQ' | 'Bakat' | 'Minat' | 'Gaya Belajar' | 'Karir' | 'Kepribadian' | 'MBTI'
}

export const PSIKOTES_KAMUS: PsikotesKamusItem[] = [
  { kode: 'CFIT', nama: 'Culture Fair Intelligence Test', deskripsi: 'Tes kecerdasan yang bebas pengaruh budaya dan bahasa, mengukur kemampuan berpikir murni.', kategori: 'IQ' },
  { kode: 'VER', nama: 'Verbal', deskripsi: 'Kemampuan memahami dan menggunakan bahasa secara efektif, termasuk kosakata dan pemahaman bacaan.', kategori: 'Bakat' },
  { kode: 'NUM', nama: 'Numerikal', deskripsi: 'Kemampuan berhitung, memahami pola angka, dan logika matematis.', kategori: 'Bakat' },
  { kode: 'SKL', nama: 'Skolastik', deskripsi: 'Kemampuan belajar akademis secara umum, mencerminkan potensi keberhasilan di sekolah.', kategori: 'Bakat' },
  { kode: 'ABS', nama: 'Abstrak', deskripsi: 'Kemampuan berpikir non-verbal, memahami pola, bentuk, dan hubungan visual.', kategori: 'Bakat' },
  { kode: 'MEK (Bakat)', nama: 'Mekanikal', deskripsi: 'Kemampuan memahami prinsip mekanis, fisika terapan, dan cara kerja alat.', kategori: 'Bakat' },
  { kode: 'RR', nama: 'Relasi Ruang', deskripsi: 'Kemampuan visualisasi dan manipulasi objek dalam ruang tiga dimensi.', kategori: 'Bakat' },
  { kode: 'KKK', nama: 'Kecepatan & Ketelitian Klerikal', deskripsi: 'Kemampuan bekerja cepat, teliti, dan akurat dalam tugas administratif atau data.', kategori: 'Bakat' },
  { kode: 'PS', nama: 'Personal-Sosial', deskripsi: 'Minat bekerja dengan dan untuk orang lain, membantu, mendidik, dan berinteraksi sosial.', kategori: 'Minat' },
  { kode: 'NAT', nama: 'Natural', deskripsi: 'Minat terhadap alam, biologi, lingkungan, dan ilmu pengetahuan alam.', kategori: 'Minat' },
  { kode: 'MEK (Minat)', nama: 'Mekanikal', deskripsi: 'Minat terhadap mesin, teknologi, teknik, dan cara kerja peralatan.', kategori: 'Minat' },
  { kode: 'BIS', nama: 'Bisnis', deskripsi: 'Minat di bidang ekonomi, kewirausahaan, manajemen, dan dunia bisnis.', kategori: 'Minat' },
  { kode: 'ART', nama: 'Artistik', deskripsi: 'Minat terhadap seni, kreativitas, estetika, musik, dan ekspresi diri.', kategori: 'Minat' },
  { kode: 'SI', nama: 'Sains-Investigatif', deskripsi: 'Minat meneliti, menganalisis, dan memecahkan masalah ilmiah.', kategori: 'Minat' },
  { kode: 'V', nama: 'Visual', deskripsi: 'Gaya belajar dengan melihat: diagram, grafik, video, dan presentasi visual.', kategori: 'Gaya Belajar' },
  { kode: 'M', nama: 'Auditori', deskripsi: 'Gaya belajar dengan mendengar: ceramah, diskusi, musik, dan penjelasan lisan.', kategori: 'Gaya Belajar' },
  { kode: 'K', nama: 'Kinestetik', deskripsi: 'Gaya belajar dengan bergerak dan menyentuh: praktik, eksperimen, dan simulasi.', kategori: 'Gaya Belajar' },
  { kode: 'RIASEC', nama: 'Holland Occupational Themes', deskripsi: 'Model kepribadian karir: Realistic (praktis), Investigative (analitis), Artistic (kreatif), Social (sosial), Enterprising (pemimpin), Conventional (teratur).', kategori: 'Karir' },
  { kode: 'MBTI', nama: 'Myers-Briggs Type Indicator', deskripsi: '16 tipe kepribadian berdasarkan 4 dimensi: E/I (Ekstrover/Introver), S/N (Sensing/Intuition), T/F (Thinking/Feeling), J/P (Judging/Perceiving).', kategori: 'Kepribadian' },
  { kode: 'ISTJ', nama: 'Inspektur', deskripsi: 'Tenang, serius, bertanggung jawab. Menghargai tradisi dan kesetiaan. Cocok: auditor, akuntan, manajer.', kategori: 'MBTI' },
  { kode: 'ISFJ', nama: 'Pelindung', deskripsi: 'Hangat, teliti, perhatian. Berkomitmen tinggi dan ingin membuat perbedaan. Cocok: perawat, guru, konselor.', kategori: 'MBTI' },
  { kode: 'INFJ', nama: 'Penasihat', deskripsi: 'Penuh wawasan dan inspiratif. Berprinsip kuat dan visioner. Cocok: psikolog, penulis, dokter.', kategori: 'MBTI' },
  { kode: 'INTJ', nama: 'Arsitek', deskripsi: 'Strategis, mandiri, analitis. Perfeksionis dengan standar tinggi. Cocok: ilmuwan, insinyur, pengacara.', kategori: 'MBTI' },
  { kode: 'ISTP', nama: 'Pengrajin', deskripsi: 'Toleran, fleksibel, praktis. Suka menganalisis cara kerja sesuatu. Cocok: mekanik, teknisi, pilot.', kategori: 'MBTI' },
  { kode: 'ISFP', nama: 'Seniman', deskripsi: 'Tenang, ramah, peka. Menikmati momen sekarang. Cocok: desainer, musisi, fotografer.', kategori: 'MBTI' },
  { kode: 'INFP', nama: 'Mediator', deskripsi: 'Idealis, setia pada nilai. Ingin memahami dan membantu orang lain. Cocok: penulis, konselor, aktivis.', kategori: 'MBTI' },
  { kode: 'INTP', nama: 'Pemikir', deskripsi: 'Tenang, analitis, skeptis. Suka teori dan ide abstrak. Cocok: filsuf, arsitek, programmer.', kategori: 'MBTI' },
  { kode: 'ESTP', nama: 'Pengusaha', deskripsi: 'Spontan, energik, suka memecahkan masalah langsung. Cocok: pengusaha, polisi, paramedis.', kategori: 'MBTI' },
  { kode: 'ESFP', nama: 'Penghibur', deskripsi: 'Spontan, semangat, suka membuat orang senang. Cocok: aktor, guru, event organizer.', kategori: 'MBTI' },
  { kode: 'ENFP', nama: 'Penggagas', deskripsi: 'Kreatif, antusias, imajinatif. Melihat potensi di mana-mana. Cocok: jurnalis, konsultan, seniman.', kategori: 'MBTI' },
  { kode: 'ENTP', nama: 'Pendebat', deskripsi: 'Cepat, cerdas, suka berdebat. Pandai menemukan solusi inovatif. Cocok: pengacara, ilmuwan, entrepreneur.', kategori: 'MBTI' },
  { kode: 'ESTJ', nama: 'Eksekutif', deskripsi: 'Praktis, realistis, tegas. Suka mengorganisasi orang dan proyek. Cocok: manajer, hakim, kepala sekolah.', kategori: 'MBTI' },
  { kode: 'ESFJ', nama: 'Konsul', deskripsi: 'Hangat, bertanggung jawab, suka harmoni. Ingin menyenangkan orang lain. Cocok: guru, dokter, perawat.', kategori: 'MBTI' },
  { kode: 'ENFJ', nama: 'Protagonis', deskripsi: 'Karismatik, empatik, pemimpin alami. Sensitif terhadap kebutuhan orang lain. Cocok: guru, konselor, politisi.', kategori: 'MBTI' },
  { kode: 'ENTJ', nama: 'Komandan', deskripsi: 'Tegas, berani, imajinatif. Selalu menemukan cara untuk mencapai tujuan. Cocok: CEO, pengacara, direktur.', kategori: 'MBTI' },
]

export const BAKAT_FIELDS = [
  { key: 'bakat_ver', code: 'VER', label: 'Verbal', description: 'Pemahaman bahasa, kosakata, dan bacaan' },
  { key: 'bakat_num', code: 'NUM', label: 'Numerikal', description: 'Berhitung, pola angka, dan logika matematis' },
  { key: 'bakat_skl', code: 'SKL', label: 'Skolastik', description: 'Potensi belajar akademis secara umum' },
  { key: 'bakat_abs', code: 'ABS', label: 'Abstrak', description: 'Penalaran non-verbal, pola, dan bentuk' },
  { key: 'bakat_mek', code: 'MEK', label: 'Mekanikal', description: 'Prinsip mekanis dan cara kerja alat' },
  { key: 'bakat_rr', code: 'RR', label: 'Relasi Ruang', description: 'Visualisasi objek dan ruang 3 dimensi' },
  { key: 'bakat_kkk', code: 'KKK', label: 'Ketelitian Klerikal', description: 'Kecepatan dan ketelitian mengolah data' },
] as const

export const MINAT_FIELDS = [
  { key: 'minat_ps', code: 'PS', label: 'Personal-Sosial', description: 'Membantu, mengajar, dan berinteraksi sosial' },
  { key: 'minat_nat', code: 'NAT', label: 'Natural', description: 'Alam, biologi, lingkungan, dan IPA' },
  { key: 'minat_mek', code: 'MEK', label: 'Mekanikal', description: 'Mesin, teknik, dan teknologi terapan' },
  { key: 'minat_bis', code: 'BIS', label: 'Bisnis', description: 'Ekonomi, manajemen, dan kewirausahaan' },
  { key: 'minat_art', code: 'ART', label: 'Artistik', description: 'Seni, musik, desain, dan kreativitas' },
  { key: 'minat_si', code: 'SI', label: 'Sains-Investigatif', description: 'Riset, analisis, dan pemecahan masalah ilmiah' },
] as const

export const GAYA_BELAJAR_SCORE_FIELDS = [
  { key: 'minat_v', code: 'V', label: 'Visual', description: 'Belajar melalui gambar, grafik, dan catatan rapi' },
  { key: 'minat_m', code: 'M', label: 'Auditori', description: 'Belajar melalui penjelasan lisan dan diskusi' },
  { key: 'minat_k', code: 'K', label: 'Kinestetik', description: 'Belajar melalui praktik langsung dan eksperimen' },
] as const

const RIASEC_MEANINGS: Record<string, { label: string; description: string }> = {
  REALISTIC: { label: 'Realistic (Praktis)', description: 'Menyukai aktivitas teknis, praktik lapangan, dan alat nyata.' },
  INVESTIGATIVE: { label: 'Investigative (Analitis)', description: 'Gemar meneliti, mengamati, dan memecahkan persoalan logis.' },
  ARTISTIC: { label: 'Artistic (Kreatif)', description: 'Menyukai ekspresi kreatif, seni, tulisan, dan gagasan orisinal.' },
  SOCIAL: { label: 'Social (Sosial)', description: 'Senang membantu, membimbing, mengajar, dan bekerja sama.' },
  ENTERPRISING: { label: 'Enterprising (Kepemimpinan)', description: 'Tertarik memimpin, bernegosiasi, dan merintis usaha.' },
  CONVENTIONAL: { label: 'Conventional (Terstruktur)', description: 'Teliti terhadap data, keteraturan, dan administrasi rapi.' },
}

export function getMbtiInfo(mbti: string | null | undefined) {
  const code = String(mbti || '').trim().toUpperCase()
  if (!code) return null
  return PSIKOTES_KAMUS.find(item => item.kategori === 'MBTI' && item.kode === code) || null
}

export function getGayaBelajarInfo(gaya: string | null | undefined) {
  const normalized = String(gaya || '').trim().toUpperCase()
  if (!normalized) return null
  const match = GAYA_BELAJAR_SCORE_FIELDS.find(item => item.label.toUpperCase() === normalized || item.code === normalized)
  return match || null
}

export function getRiasecInfo(raw: string | null | undefined) {
  if (!raw) return []
  return String(raw)
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const upper = part.toUpperCase()
      const meta = RIASEC_MEANINGS[upper]
      return {
        raw: part,
        label: meta?.label || part,
        description: meta?.description || null,
      }
    })
}
