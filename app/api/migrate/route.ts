import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true })
    const db = env.DB

    const stmts = [
      db.prepare(`
        CREATE TABLE IF NOT EXISTS sarpras_kategori (
          id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          nama        TEXT NOT NULL UNIQUE,
          created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS sarpras_aset (
          id                 TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          tanggal_pembukuan  TEXT NOT NULL,
          kategori_id        TEXT NOT NULL REFERENCES sarpras_kategori(id),
          nama_barang        TEXT NOT NULL,
          merek              TEXT,
          kuantitas          INTEGER NOT NULL DEFAULT 1,
          tahun_pembuatan    TEXT,
          asal_anggaran      TEXT,
          keadaan_barang     TEXT,
          harga              INTEGER,
          foto_url           TEXT,
          keterangan         TEXT,
          diinput_oleh       TEXT REFERENCES "user"(id),
          created_at         TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `),
      db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_sarpras_aset_kategori ON sarpras_aset(kategori_id);
      `),
      db.prepare(`
        INSERT OR IGNORE INTO role_features (role, feature_id) VALUES 
        ('super_admin', 'sarpras'), 
        ('admin_tu', 'sarpras');
      `)
    ]

    await db.batch(stmts)
    return NextResponse.json({ success: true, message: 'Migration applied!' })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
