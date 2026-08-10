const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const kampus = JSON.parse(fs.readFileSync(path.join(root, 'data', 'kampus.json'), 'utf8'))
const grouped = JSON.parse(fs.readFileSync(path.join(root, 'data', 'prodi.json'), 'utf8'))
const allowed = new Set(['D1', 'D2', 'D3', 'D4', 'S1'])
const ids = new Set(kampus.map(item => item.id))
const errors = []
let count = 0

for (const [kampusId, list] of Object.entries(grouped)) {
  if (!ids.has(kampusId)) errors.push(`Kampus tidak ditemukan: ${kampusId}`)
  const seen = new Set()
  for (const item of list) {
    count++
    if (!allowed.has(item.jenjang)) errors.push(`Jenjang tidak valid: ${item.jenjang}`)
    const key = `${item.kode}|${item.jenjang}|${item.nama}`
    if (seen.has(key)) errors.push(`Prodi duplikat pada ${kampusId}: ${key}`)
    seen.add(key)
  }
}
for (const required of ['AKMIL', 'AKPOL', 'STIN', 'IPDN']) {
  if (!ids.has(required)) errors.push(`Institusi wajib hilang: ${required}`)
}
if (errors.length) {
  console.error(errors.slice(0, 30).join('\n'))
  process.exit(1)
}
console.log(JSON.stringify({ valid: true, kampus: kampus.length, kampusDenganProdi: Object.keys(grouped).length, prodi: count }, null, 2))
