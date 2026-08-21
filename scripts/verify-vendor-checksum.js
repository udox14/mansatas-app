const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const vendorPath = path.join(process.cwd(), 'public', 'vendor', 'xlsx-0.20.3.full.min.js')
const checksumPath = path.join(process.cwd(), 'public', 'vendor', 'xlsx-0.20.3.sha256')
const expected = fs.readFileSync(checksumPath, 'utf8').trim().split(/\s+/)[0].toLowerCase()
const actual = crypto.createHash('sha256').update(fs.readFileSync(vendorPath)).digest('hex')

if (!/^[a-f0-9]{64}$/.test(expected) || actual !== expected) {
  console.error(`SheetJS vendor checksum mismatch: expected=${expected} actual=${actual}`)
  process.exit(1)
}

console.log(`SheetJS vendor checksum verified: ${actual}`)
