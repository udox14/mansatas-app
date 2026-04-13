// app/dashboard/tahfidz/data/juz-data.ts
import { SURAH_LIST, Surah } from '@/app/dashboard/program-unggulan/kelola/quran-data'

export type JuzData = {
  juz: number;
  surahList: Surah[];
}

export const JUZ_SCOPE = [1, 26, 27, 28, 29, 30]

const getSurahRange = (startNomor: number, endNomor: number) => {
  return SURAH_LIST.filter(s => s.nomor >= startNomor && s.nomor <= endNomor)
}

export const JUZ_DATA: JuzData[] = [
  {
    juz: 1, // Al-Fatihah (1) - Al-Baqarah (2)
    surahList: getSurahRange(1, 2)
  },
  {
    juz: 26, // Al-Ahqaf (46) - Qaf (50)
    surahList: getSurahRange(46, 50)
  },
  {
    juz: 27, // Az-Zariyat (51) - Al-Hadid (57)
    surahList: getSurahRange(51, 57)
  },
  {
    juz: 28, // Al-Mujadalah (58) - At-Tahrim (66)
    surahList: getSurahRange(58, 66)
  },
  {
    juz: 29, // Al-Mulk (67) - Al-Mursalat (77)
    surahList: getSurahRange(67, 77)
  },
  {
    juz: 30, // An-Naba' (78) - An-Nas (114)
    surahList: getSurahRange(78, 114)
  }
]

export const getTotalAyatInJuz = (juz: number) => {
  const juzData = JUZ_DATA.find(j => j.juz === juz);
  if (!juzData) return 0;
  return juzData.surahList.reduce((total, surah) => total + surah.jumlahAyat, 0);
}
