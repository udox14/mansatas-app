export async function ensureRiwayatKelasSnapshotColumns(db: D1Database) {
  const tableInfo = await db.prepare('PRAGMA table_info(riwayat_kelas)').all<{ name: string }>()
  const columns = new Set((tableInfo.results ?? []).map(col => col.name))

  const additions: Array<[string, string]> = [
    ['kelas_tingkat', 'INTEGER'],
    ['kelas_nomor', 'TEXT'],
    ['kelas_kelompok', 'TEXT'],
    ['kelas_nama', 'TEXT'],
  ]

  for (const [name, type] of additions) {
    if (!columns.has(name)) {
      await db.prepare(`ALTER TABLE riwayat_kelas ADD COLUMN ${name} ${type}`).run()
    }
  }
}

export function formatKelasSnapshot(tingkat: number | string | null | undefined, nomor: string | number | null | undefined, kelompok: string | null | undefined) {
  const tingkatText = tingkat == null ? '' : String(tingkat)
  const nomorText = nomor == null ? '' : String(nomor)
  const kelompokText = kelompok && kelompok !== 'UMUM' ? ` ${kelompok}` : ''
  return `${tingkatText}-${nomorText}${kelompokText}`.trim()
}

/**
 * Sinkronisasi snapshot riwayat_kelas untuk seorang siswa pada tahun ajaran aktif (atau tertentu).
 * Dipanggil otomatis saat siswa dimasukkan ke kelas, dimutasi, atau diedit kelasnya.
 */
export async function syncSiswaRiwayatKelas(
  db: D1Database,
  siswaId: string,
  kelasId: string | null,
  options?: { tahunAjaranId?: string }
) {
  try {
    let taId = options?.tahunAjaranId
    if (!taId) {
      const activeTA = await db
        .prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1')
        .first<{ id: string }>()
      taId = activeTA?.id
    }
    if (!taId) return

    if (!kelasId) {
      await db
        .prepare('DELETE FROM riwayat_kelas WHERE siswa_id = ? AND tahun_ajaran_id = ?')
        .bind(siswaId, taId)
        .run()
      return
    }

    const k = await db
      .prepare('SELECT tingkat, nomor_kelas, kelompok FROM kelas WHERE id = ?')
      .bind(kelasId)
      .first<{ tingkat: number; nomor_kelas: string; kelompok: string }>()

    if (!k) return

    const kelasNama = formatKelasSnapshot(k.tingkat, k.nomor_kelas, k.kelompok)

    await db
      .prepare(`
        INSERT INTO riwayat_kelas (
          siswa_id, kelas_id, tahun_ajaran_id,
          kelas_tingkat, kelas_nomor, kelas_kelompok, kelas_nama
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(siswa_id, tahun_ajaran_id) DO UPDATE SET
          kelas_id = excluded.kelas_id,
          kelas_tingkat = excluded.kelas_tingkat,
          kelas_nomor = excluded.kelas_nomor,
          kelas_kelompok = excluded.kelas_kelompok,
          kelas_nama = excluded.kelas_nama
      `)
      .bind(siswaId, kelasId, taId, k.tingkat, k.nomor_kelas, k.kelompok, kelasNama)
      .run()
  } catch (err) {
    console.error(`[syncSiswaRiwayatKelas] Gagal menyinkronkan siswa ${siswaId} ke kelas ${kelasId}:`, err)
  }
}

