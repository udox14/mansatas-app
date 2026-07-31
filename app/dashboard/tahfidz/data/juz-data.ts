// app/dashboard/tahfidz/data/juz-data.ts
import { SURAH_LIST } from '@/app/dashboard/tahfidz/data/quran-data'

export type JuzSurah = {
  nomor: number
  nama: string
  namaLatin: string
  startAyat: number
  endAyat: number
  jumlahAyat: number // Total ayat dalam juz ini (endAyat - startAyat + 1)
}

export type JuzData = {
  juz: number
  surahList: JuzSurah[]
}

export const JUZ_SCOPE = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30]

const s = (nomor: number, startAyat: number, endAyat: number): JuzSurah => {
  const surah = SURAH_LIST.find(item => item.nomor === nomor)
  if (!surah) throw new Error(`Surah ${nomor} tidak ditemukan`)
  return {
    nomor: surah.nomor,
    nama: surah.nama,
    namaLatin: surah.namaLatin,
    startAyat,
    endAyat,
    jumlahAyat: endAyat - startAyat + 1
  }
}

const fullSurahs = (startNomor: number, endNomor: number): JuzSurah[] => {
  return SURAH_LIST.filter(item => item.nomor >= startNomor && item.nomor <= endNomor).map(surah => ({
    nomor: surah.nomor,
    nama: surah.nama,
    namaLatin: surah.namaLatin,
    startAyat: 1,
    endAyat: surah.jumlahAyat,
    jumlahAyat: surah.jumlahAyat
  }))
}

export const JUZ_DATA: JuzData[] = [
  { juz: 1,  surahList: [s(1, 1, 7), s(2, 1, 141)] },
  { juz: 2,  surahList: [s(2, 142, 252)] },
  { juz: 3,  surahList: [s(2, 253, 286), s(3, 1, 92)] },
  { juz: 4,  surahList: [s(3, 93, 200), s(4, 1, 23)] },
  { juz: 5,  surahList: [s(4, 24, 147)] },
  { juz: 6,  surahList: [s(4, 148, 176), s(5, 1, 81)] },
  { juz: 7,  surahList: [s(5, 82, 120), s(6, 1, 110)] },
  { juz: 8,  surahList: [s(6, 111, 165), s(7, 1, 87)] },
  { juz: 9,  surahList: [s(7, 88, 206), s(8, 1, 40)] },
  { juz: 10, surahList: [s(8, 41, 75), s(9, 1, 92)] },
  { juz: 11, surahList: [s(9, 93, 129), s(10, 1, 109), s(11, 1, 5)] },
  { juz: 12, surahList: [s(11, 6, 123), s(12, 1, 52)] },
  { juz: 13, surahList: [s(12, 53, 111), s(13, 1, 43), s(14, 1, 52)] },
  { juz: 14, surahList: [s(15, 1, 99), s(16, 1, 128)] },
  { juz: 15, surahList: [s(17, 1, 111), s(18, 1, 74)] },
  { juz: 16, surahList: [s(18, 75, 110), s(19, 1, 98), s(20, 1, 135)] },
  { juz: 17, surahList: [s(21, 1, 112), s(22, 1, 78)] },
  { juz: 18, surahList: [s(23, 1, 118), s(24, 1, 64), s(25, 1, 20)] },
  { juz: 19, surahList: [s(25, 21, 77), s(26, 1, 227), s(27, 1, 55)] },
  { juz: 20, surahList: [s(27, 56, 93), s(28, 1, 88), s(29, 1, 45)] },
  { juz: 21, surahList: [s(29, 46, 69), s(30, 1, 60), s(31, 1, 34), s(32, 1, 30), s(33, 1, 30)] },
  { juz: 22, surahList: [s(33, 31, 73), s(34, 1, 54), s(35, 1, 45), s(36, 1, 27)] },
  { juz: 23, surahList: [s(36, 28, 83), s(37, 1, 182), s(38, 1, 88), s(39, 1, 31)] },
  { juz: 24, surahList: [s(39, 32, 75), s(40, 1, 85), s(41, 1, 46)] },
  { juz: 25, surahList: [s(41, 47, 54), s(42, 1, 53), s(43, 1, 89), s(44, 1, 59), s(45, 1, 37)] },
  { juz: 26, surahList: [s(46, 1, 35), s(47, 1, 38), s(48, 1, 29), s(49, 1, 18), s(50, 1, 45), s(51, 1, 30)] },
  { juz: 27, surahList: [s(51, 31, 60), s(52, 1, 49), s(53, 1, 62), s(54, 1, 55), s(55, 1, 78), s(56, 1, 96), s(57, 1, 29)] },
  { juz: 28, surahList: fullSurahs(58, 66) },
  { juz: 29, surahList: fullSurahs(67, 77) },
  { juz: 30, surahList: fullSurahs(78, 114) },
]

export const getTotalAyatInJuz = (juz: number) => {
  const juzData = JUZ_DATA.find(j => j.juz === juz)
  if (!juzData) return 0
  return juzData.surahList.reduce((total, surah) => total + surah.jumlahAyat, 0)
}
