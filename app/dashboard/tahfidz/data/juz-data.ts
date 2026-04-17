// app/dashboard/tahfidz/data/juz-data.ts
import { SURAH_LIST, Surah } from '@/app/dashboard/tahfidz/data/quran-data'

export type JuzData = {
  juz: number;
  surahList: Surah[];
}

export const JUZ_SCOPE = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30]

const getSurahRange = (startNomor: number, endNomor: number) => {
  return SURAH_LIST.filter(s => s.nomor >= startNomor && s.nomor <= endNomor)
}

export const JUZ_DATA: JuzData[] = [
  { juz: 1,  surahList: getSurahRange(1, 2) },    // Al-Fatihah - Al-Baqarah
  { juz: 2,  surahList: getSurahRange(3, 3) },    // Ali Imran
  { juz: 3,  surahList: getSurahRange(4, 4) },    // An-Nisa
  { juz: 4,  surahList: getSurahRange(5, 5) },    // Al-Ma'idah
  { juz: 5,  surahList: getSurahRange(6, 6) },    // Al-An'am
  { juz: 6,  surahList: getSurahRange(7, 7) },    // Al-A'raf
  { juz: 7,  surahList: getSurahRange(8, 9) },    // Al-Anfal - At-Tawbah
  { juz: 8,  surahList: getSurahRange(10, 11) },  // Yunus - Hud
  { juz: 9,  surahList: getSurahRange(12, 13) },  // Yusuf - Ar-Ra'd
  { juz: 10, surahList: getSurahRange(14, 15) },  // Ibrahim - Al-Hijr
  { juz: 11, surahList: getSurahRange(16, 17) },  // An-Nahl - Al-Isra
  { juz: 12, surahList: getSurahRange(18, 19) },  // Al-Kahf - Maryam
  { juz: 13, surahList: getSurahRange(20, 21) },  // Ta-Ha - Al-Anbiya
  { juz: 14, surahList: getSurahRange(22, 23) },  // Al-Hajj - Al-Mu'minun
  { juz: 15, surahList: getSurahRange(24, 25) },  // An-Nur - Al-Furqan
  { juz: 16, surahList: getSurahRange(26, 27) },  // Asy-Syu'ara - An-Naml
  { juz: 17, surahList: getSurahRange(28, 29) },  // Al-Qasas - Al-Ankabut
  { juz: 18, surahList: getSurahRange(30, 31) },  // Ar-Rum - Luqman
  { juz: 19, surahList: getSurahRange(32, 33) },  // As-Sajdah - Al-Ahzab
  { juz: 20, surahList: getSurahRange(34, 35) },  // Saba - Fatir
  { juz: 21, surahList: getSurahRange(36, 37) },  // Ya-Sin - As-Saffat
  { juz: 22, surahList: getSurahRange(38, 39) },  // Sad - Az-Zumar
  { juz: 23, surahList: getSurahRange(40, 41) },  // Ghafir - Fussilat
  { juz: 24, surahList: getSurahRange(42, 43) },  // Asy-Syura - Az-Zukhruf
  { juz: 25, surahList: getSurahRange(44, 45) },  // Ad-Dukhan - Al-Jasiyah
  { juz: 26, surahList: getSurahRange(46, 50) },  // Al-Ahqaf - Qaf
  { juz: 27, surahList: getSurahRange(51, 57) },  // Az-Zariyat - Al-Hadid
  { juz: 28, surahList: getSurahRange(58, 66) },  // Al-Mujadalah - At-Tahrim
  { juz: 29, surahList: getSurahRange(67, 77) },  // Al-Mulk - Al-Mursalat
  { juz: 30, surahList: getSurahRange(78, 114) }, // An-Naba - An-Nas
]

export const getTotalAyatInJuz = (juz: number) => {
  const juzData = JUZ_DATA.find(j => j.juz === juz);
  if (!juzData) return 0;
  return juzData.surahList.reduce((total, surah) => total + surah.jumlahAyat, 0);
}
