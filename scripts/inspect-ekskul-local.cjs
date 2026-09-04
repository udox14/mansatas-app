// Read-only recovery diagnostic: print counts, never student or staff data.
const fs = require('node:fs')
const path = require('node:path')
const { DatabaseSync } = require('node:sqlite')
const dir = path.resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject')
for (const file of fs.readdirSync(dir).filter(name => name.endsWith('.sqlite'))) {
  const db = new DatabaseSync(path.join(dir, file), { readOnly: true })
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'ekstrakurikuler%'").all()
    console.log(JSON.stringify({ file, tables: tables.map(({ name }) => ({
      table: name,
      count: db.prepare(`SELECT COUNT(*) AS n FROM "${name.replaceAll('"', '""')}"`).get().n,
    })) }))
  } finally { db.close() }
}
