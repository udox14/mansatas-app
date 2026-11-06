import { getFinalAttendanceForClass } from './wali-kelas-attendance'

// Recheck in the write statement as well as in the normalized attendance view.
// This guards a review if a teacher or permissions clerk saves during the request.
export const correctionSourceSql = `json_array(
  (SELECT json_group_array(json(entry)) FROM (
    SELECT json_array(ab.penugasan_id, ab.jam_ke_mulai, ab.jam_ke_selesai, ab.catatan, ab.updated_at) entry
    FROM absensi_siswa ab WHERE ab.siswa_id = target.siswa_id AND ab.tanggal = target.tanggal AND ab.status = 'ALFA'
    ORDER BY ab.penugasan_id
  )),
  (SELECT json_group_array(json(entry)) FROM (
    SELECT json_array(itk.jam_pelajaran, itk.alasan, aik.hitung_sebagai_hadir, itk.keterangan) entry
    FROM izin_tidak_masuk_kelas itk LEFT JOIN alasan_izin_kelas aik ON aik.alasan = itk.alasan
    WHERE itk.siswa_id = target.siswa_id AND itk.tanggal = target.tanggal ORDER BY entry
  )),
  (SELECT json_group_array(json(entry)) FROM (
    SELECT json_array(ik.waktu_keluar, ik.waktu_kembali, ik.keterangan) entry
    FROM izin_keluar_komplek ik WHERE ik.siswa_id = target.siswa_id
      AND substr(ik.waktu_keluar, 1, 10) <= target.tanggal
      AND (ik.waktu_kembali IS NULL OR substr(ik.waktu_kembali, 1, 10) >= target.tanggal)
    ORDER BY entry
  ))
)`

export async function readCorrectionSource(db: D1Database, siswaId: string, tanggal: string) {
  const result = await db.prepare(`SELECT ${correctionSourceSql} AS snapshot
    FROM (SELECT ? AS siswa_id, ? AS tanggal) target`).bind(siswaId, tanggal).first<{ snapshot: string }>()
  return result?.snapshot ?? null
}

export async function readCorrectionSources(db: D1Database, siswaIds: string[], tanggal: string) {
  const result = await db.prepare(`SELECT target.siswa_id, ${correctionSourceSql} AS snapshot
    FROM (SELECT value AS siswa_id, ? AS tanggal FROM json_each(?)) target`)
    .bind(tanggal, JSON.stringify(siswaIds)).all<{ siswa_id: string; snapshot: string }>()
  return result.results || []
}

export function prepareCorrectionSourceFence(
  db: D1Database, tanggal: string, sources: Awaited<ReturnType<typeof readCorrectionSources>>,
) {
  // SQLite's lazy CASE raises only on a mismatch, rolling back the whole D1 batch.
  return db.prepare(`SELECT CASE WHEN EXISTS (
    SELECT 1 FROM (SELECT json_extract(value, '$.siswa_id') AS siswa_id,
      json_extract(value, '$.snapshot') AS snapshot, ? AS tanggal FROM json_each(?)) target
    WHERE ${correctionSourceSql} <> target.snapshot
  ) THEN json('attendance source changed') ELSE 1 END`).bind(tanggal, JSON.stringify(sources))
}

export async function attendanceSemesterForDate(db: D1Database, tanggal: string) {
  const year = Number(tanggal.slice(0, 4))
  const semester = Number(tanggal.slice(5, 7)) >= 7 ? 1 : 2
  const firstYear = semester === 1 ? year : year - 1
  const row = await db.prepare(`SELECT id FROM tahun_ajaran
    WHERE semester = ? AND instr(replace(nama, ' ', ''), ?) > 0
    ORDER BY is_active DESC, id LIMIT 1`).bind(semester, `${firstYear}/${firstYear + 1}`).first<{ id: string }>()
  return row?.id
}

export async function correctionAttendanceSnapshot(
  db: D1Database, kelasId: string, tanggal: string, siswaIds: string[], tahunAjaranId?: string,
) {
  return getFinalAttendanceForClass(db, kelasId, tanggal, tanggal, {
    tahunAjaranId: tahunAjaranId ?? await attendanceSemesterForDate(db, tanggal), siswaIds, fresh: true,
  })
}
