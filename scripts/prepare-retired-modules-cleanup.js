// Explicit archive-backed exception for populated WA outbox. The normal migration
// still rejects any data. This prepares SQL only; it does not contact production.
const { DatabaseSync } = require('node:sqlite')
const { readFileSync, writeFileSync } = require('node:fs')
const { resolve, sep } = require('node:path')

function literal(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}
function identifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`
}

function buildArchivedCleanup(archiveSql, migrationSql) {
  // A single-table archive keeps references to shared tables that are intentionally
  // not imported into this isolated verifier.
  const archive = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false })
  try {
    archive.exec(archiveSql)
    const columns = archive.prepare('PRAGMA table_info(wa_outbox)').all().map(row => String(row.name))
    if (!columns.includes('id')) throw new Error('Archive must contain wa_outbox with an id column')
    const rows = archive.prepare('SELECT * FROM wa_outbox ORDER BY id').all()
    if (rows.length === 0) throw new Error('Use the normal migration when the outbox archive is empty')
    const docs = rows.map(row => `(${literal(row.id)},${literal(JSON.stringify(row))})`)
    const inserts = []
    let chunk = []
    let size = 0
    for (const doc of docs) {
      const bytes = Buffer.byteLength(doc)
      if (bytes > 45_000) throw new Error('Archived message exceeds safe SQL statement size; manual review required')
      if (size + bytes > 45_000 || chunk.length >= 50) {
        inserts.push(`INSERT INTO _retired_wa_archive VALUES ${chunk.join(',')};`)
        chunk = []
        size = 0
      }
      chunk.push(doc)
      size += bytes
    }
    if (chunk.length) inserts.push(`INSERT INTO _retired_wa_archive VALUES ${chunk.join(',')};`)
    const currentJson = `json_object(${columns.flatMap(column => [literal(column), `w.${identifier(column)}`]).join(',')})`
    return `-- Apply this WHOLE file atomically only after deployment and verified backup.
-- Every current message must exactly match the archived row; races abort cleanup.
CREATE TABLE _retired_wa_archive (id TEXT PRIMARY KEY, row_json TEXT NOT NULL);
${inserts.join('\n')}
CREATE TABLE _retired_wa_archive_guard (ok INTEGER CONSTRAINT wa_archive_must_match_current_outbox CHECK(ok=1));
INSERT INTO _retired_wa_archive_guard SELECT
  (SELECT COUNT(*) FROM wa_outbox) = ${rows.length}
  AND NOT EXISTS (
    SELECT 1 FROM wa_outbox w LEFT JOIN _retired_wa_archive a ON a.id=w.id
    WHERE a.id IS NULL OR a.row_json <> ${currentJson}
  );
-- SQLite needs the referenced parent schema even when campaign_id is NULL.
CREATE TABLE IF NOT EXISTS wa_campaigns (id TEXT PRIMARY KEY);
DELETE FROM wa_outbox;
${migrationSql}
DROP TABLE _retired_wa_archive_guard;
DROP TABLE _retired_wa_archive;
`
  } finally { archive.close() }
}

if (require.main === module) {
  const [archivePath, outputPath] = process.argv.slice(2)
  if (!archivePath || !outputPath || process.argv.length !== 4) {
    throw new Error('Usage: node scripts/prepare-retired-modules-cleanup.js <wa-outbox-archive.sql> <output.sql>')
  }
  const root = resolve(__dirname, '..')
  const output = resolve(outputPath)
  if (!output.startsWith(root + sep)) throw new Error('Output must stay inside the workspace')
  const sql = buildArchivedCleanup(readFileSync(archivePath, 'utf8'), readFileSync(resolve(root, 'migrations/0113_remove_sarpras_whatsapp.sql'), 'utf8'))
  writeFileSync(output, sql)
  console.log(`Prepared archive-verified cleanup: ${output}`)
}

module.exports = { buildArchivedCleanup }
