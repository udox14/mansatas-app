export function normalizeTahunAjaran(nama: string | null | undefined) {
  const clean = nama?.trim()
  return clean || '-'
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
