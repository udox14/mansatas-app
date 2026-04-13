/**
 * lib/tunjangan.ts
 * Utility murni (non-server) untuk logika tunjangan pegawai.
 * Bisa diimport dari client component maupun server action.
 */

export type JamMasukTier = {
  sampai_jam: string | null  // "HH:MM:SS" atau null (catch-all)
  persen: number
  label: string
}

/** Default tiers — dipakai jika DB belum dikonfigurasi ulang */
export function getDefaultJamTiers(): JamMasukTier[] {
  return [
    { sampai_jam: '07:15:00', persen: 100, label: 's/d 07.15' },
    { sampai_jam: '07:30:00', persen: 75,  label: '07.15 – 07.30' },
    { sampai_jam: '08:00:00', persen: 50,  label: '07.30 – 08.00' },
    { sampai_jam: null,       persen: 0,   label: '> 08.00' },
  ]
}

/**
 * Hitung persen tunjangan untuk 1 hari berdasarkan jam_masuk dan tiers.
 * jam_masuk: "HH:MM" atau "HH:MM:SS". Null = tidak hadir → 0%.
 */
export function hitungPersenHari(jamMasuk: string | null, tiers: JamMasukTier[]): number {
  if (!jamMasuk) return 0
  const jam = jamMasuk.length === 5 ? jamMasuk + ':00' : jamMasuk
  for (const tier of tiers) {
    if (tier.sampai_jam === null) return tier.persen  // catch-all
    if (jam <= tier.sampai_jam) return tier.persen
  }
  return 0
}
