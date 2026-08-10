const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')

const input = process.argv[2]
if (!input || !fs.existsSync(input)) {
  throw new Error('Gunakan: node scripts/generate-prodi-data.js <Program-Studi.xlsx>')
}

const root = path.resolve(__dirname, '..')
const kampusPath = path.join(root, 'data', 'kampus.json')
const prodiPath = path.join(root, 'data', 'prodi.json')
const metadataPath = path.join(root, 'data', 'prodi.meta.json')
const allowed = new Set(['D1', 'D2', 'D3', 'D4', 'S1'])
const normalize = value => String(value || '')
  .normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, ' ').trim().toLowerCase()

const workbook = XLSX.readFile(input)
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])
const kampus = JSON.parse(fs.readFileSync(kampusPath, 'utf8'))
const byName = new Map()
const byId = new Map()
for (const item of kampus) {
  const key = normalize(item.nama)
  if (!byName.has(key)) byName.set(key, [])
  byName.get(key).push(item)
  byId.set(String(item.id).replace(/^0+/, ''), item)
}

const official = new Map()
for (const row of rows) {
  const npsn = String(row.npsn || '').trim()
  if (!npsn) continue
  if (!official.has(npsn)) official.set(npsn, row)
}

const canonicalId = new Map()
for (const [npsn, row] of official) {
  const nameMatches = byName.get(normalize(row.nama_pt)) || []
  let match = nameMatches.find(item => String(item.id).replace(/^0+/, '') === npsn.replace(/^0+/, ''))
    || (nameMatches.length === 1 ? nameMatches[0] : undefined)
    || byId.get(npsn.replace(/^0+/, ''))
  if (!match) {
    match = {
      id: `npsn:${npsn}`,
      nama: String(row.nama_pt || '').trim(),
      singkatan: '',
      kota: String(row.Kabupaten_pt || '').replace(/^(Kab\.|Kota)\s*/i, '').trim(),
      provinsi: String(row.Provinsi || row.provinsi_pt || '').replace(/^Prov\.\s*/i, '').trim(),
      jenis: String(row.kelompok_3 || row.Kelompok || 'PT').trim(),
    }
    kampus.push(match)
  }
  match.npsn = npsn
  canonicalId.set(npsn, match.id)
}

const grouped = {}
for (const row of rows) {
  const jenjang = String(row.nm_jenj_didik || '').replace(/[^A-Z0-9]/g, '')
  if (!allowed.has(jenjang)) continue
  const kampusId = canonicalId.get(String(row.npsn || '').trim())
  if (!kampusId) continue
  const item = {
    kode: String(row.kode_prodi || '').trim(),
    nama: String(row.nm_prodi || '').trim(),
    jenjang,
  }
  if (!grouped[kampusId]) grouped[kampusId] = []
  if (!grouped[kampusId].some(existing =>
    existing.kode === item.kode && existing.nama === item.nama && existing.jenjang === item.jenjang
  )) grouped[kampusId].push(item)
}

for (const list of Object.values(grouped)) {
  list.sort((a, b) => `${a.nama}|${a.jenjang}`.localeCompare(`${b.nama}|${b.jenjang}`, 'id'))
}
kampus.sort((a, b) => a.nama.localeCompare(b.nama, 'id'))

fs.writeFileSync(kampusPath, JSON.stringify(kampus))
fs.writeFileSync(prodiPath, JSON.stringify(grouped))

const prodiCount = Object.values(grouped).reduce((sum, list) => sum + list.length, 0)
fs.writeFileSync(metadataPath, JSON.stringify({
  source: 'https://data.kemdiktisaintek.go.id/dataset/data-program-studi-pendidikan-tinggi-tahun-2025',
  source_file: 'Program Studi.xlsx',
  publication_year: 2025,
  included_levels: [...allowed],
  generated_at: new Date().toISOString().slice(0, 10),
  campuses_with_programs: Object.keys(grouped).length,
  programs: prodiCount,
}, null, 2) + '\n')
console.log(JSON.stringify({ kampus: kampus.length, kampusDenganProdi: Object.keys(grouped).length, prodi: prodiCount }, null, 2))
