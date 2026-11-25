export type RencanaKategori =
  | 'KULIAH'
  | 'BEKERJA'
  | 'WIRAUSAHA'
  | 'TNI_POLRI'
  | 'MENIKAH'
  | 'PESANTREN'
  | 'KURSUS_PELATIHAN'
  | 'BELUM_MENENTUKAN'
  | 'LAINNYA'

export type Kampus = {
  id: string
  nama: string
  singkatan: string
  kota: string
  provinsi: string
  jenis: string
  npsn?: string
}

export type Prodi = { kode: string; nama: string; jenjang: string }

export const RENCANA_OPTIONS: { value: RencanaKategori; label: string }[] = [
  { value: 'KULIAH', label: 'Kuliah / Melanjutkan Pendidikan' },
  { value: 'BEKERJA', label: 'Bekerja' },
  { value: 'WIRAUSAHA', label: 'Wirausaha' },
  { value: 'TNI_POLRI', label: 'TNI / Polri (non-akademi)' },
  { value: 'MENIKAH', label: 'Menikah' },
  { value: 'PESANTREN', label: 'Pesantren' },
  { value: 'KURSUS_PELATIHAN', label: 'Kursus / Pelatihan' },
  { value: 'BELUM_MENENTUKAN', label: 'Belum Menentukan' },
  { value: 'LAINNYA', label: 'Lainnya' },
]

export const RENCANA_LABEL = Object.fromEntries(
  RENCANA_OPTIONS.map(option => [option.value, option.label])
) as Record<RencanaKategori, string>

export function prodiValue(prodi: Prodi) {
  return `${prodi.kode}|${prodi.jenjang}|${prodi.nama}`
}

export function findProdiByValue(prodiByKampus: Record<string, Prodi[]>, kampusId: string, value: string) {
  return (prodiByKampus[kampusId] ?? []).find(prodi => prodiValue(prodi) === value)
}

export function findProdiValueByName(prodiByKampus: Record<string, Prodi[]>, kampusId: string, name?: string | null) {
  if (!name) return ''
  const found = (prodiByKampus[kampusId] ?? []).find(prodi => prodi.nama === name)
  return found ? prodiValue(found) : ''
}
