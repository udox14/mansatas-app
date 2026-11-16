export function normalizeTahunAjaran(nama: string | null | undefined) {
  const clean = nama?.trim()
  return clean || '-'
}

export function academicPeriodDates(nama: string, semester: number): { startDate: string | null; endDate: string | null } {
  const match = nama.match(/(\d{4})\s*\/\s*(\d{4})/)
  if (!match) return { startDate: null, endDate: null }
  return semester === 1
    ? { startDate: `${match[1]}-07-01`, endDate: `${match[1]}-12-31` }
    : { startDate: `${match[2]}-01-01`, endDate: `${match[2]}-06-30` }
}

export function getNextTahunAjaran(nama: string | null | undefined) {
  const clean = normalizeTahunAjaran(nama)
  const match = clean.match(/(\d{4})\s*\/\s*(\d{4})/)
  if (!match) return clean

  const start = Number(match[1])
  const end = Number(match[2])
  if (!Number.isFinite(start) || !Number.isFinite(end)) return clean

  return `${start + 1}/${end + 1}`
}

export function getKuitansiTahunAjaran(
  activeTahunAjaran: string | null | undefined,
  hasKelas: boolean,
) {
  return hasKelas ? normalizeTahunAjaran(activeTahunAjaran) : getNextTahunAjaran(activeTahunAjaran)
}
