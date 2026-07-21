const SATUAN = [
  '', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan',
  'sepuluh', 'sebelas', 'dua belas', 'tiga belas', 'empat belas', 'lima belas',
  'enam belas', 'tujuh belas', 'delapan belas', 'sembilan belas',
]

function ucap(n: number): string {
  if (n === 0) return ''
  if (n < 20) return SATUAN[n]
  if (n < 100) {
    const puluhan = Math.floor(n / 10)
    const satuan = n % 10
    return (puluhan === 1 ? 'se' : SATUAN[puluhan]) + 'puluh' + (satuan ? ' ' + SATUAN[satuan] : '')
  }
  const ratus = Math.floor(n / 100)
  const sisa = n % 100
  return (ratus === 1 ? 'se' : SATUAN[ratus]) + 'ratus' + (sisa ? ' ' + ucap(sisa) : '')
}

export function terbilang(angka: number): string {
  if (angka === 0) return 'Nol'
  const groups = [
    { nilai: 1_000_000_000, label: 'miliar' },
    { nilai: 1_000_000, label: 'juta' },
    { nilai: 1_000, label: 'ribu' },
  ]
  let sisa = Math.round(Math.max(0, angka))
  const parts: string[] = []
  for (const g of groups) {
    if (sisa >= g.nilai) {
      const qty = Math.floor(sisa / g.nilai)
      parts.push(g.nilai === 1_000 && qty === 1 ? 'seribu' : `${ucap(qty)} ${g.label}`)
      sisa %= g.nilai
    }
  }
  if (sisa > 0) parts.push(ucap(sisa))
  const result = parts.join(' ').trim()
  return result.charAt(0).toUpperCase() + result.slice(1)
}
