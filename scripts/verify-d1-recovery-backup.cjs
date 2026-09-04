// Read-only verification of an exported D1 SQL file. No row contents are printed.
const fs = require('node:fs')
const crypto = require('node:crypto')
const { DatabaseSync } = require('node:sqlite')
const source = process.argv[2]
if (!source) throw new Error('Provide the exported SQL file path.')
const sql = fs.readFileSync(source, 'utf8')
// Export order can put child tables before parents. This applies ONLY to the
// isolated in-memory verifier, never to the production D1 database.
const database = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false })
try {
  database.exec(sql)
  const integrity = database.prepare('PRAGMA integrity_check').all()
  const tables = ['ekstrakurikuler', 'ekstrakurikuler_pembina', 'ekstrakurikuler_anggota', 'ekstrakurikuler_pertemuan', 'ekstrakurikuler_absensi', 'ekstrakurikuler_nilai']
  const counts = Object.fromEntries(tables.map(table => [table, database.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n]))
  console.log(JSON.stringify({
    source,
    bytes: fs.statSync(source).size,
    sha256: crypto.createHash('sha256').update(sql).digest('hex'),
    integrity,
    counts,
  }, null, 2))
} finally { database.close() }
