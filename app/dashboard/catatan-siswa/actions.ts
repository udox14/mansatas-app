'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { logActivity } from '@/lib/activity-log'
import { STUDENT_NOTE_MAX_LENGTH } from '@/lib/student-note-shared'
import { formatNamaKelas } from '@/lib/utils'

type ActionResult = { success?: string; error?: string }

async function requireFeature() {
  const user = await getCurrentUser()
  if (!user) return { error: 'Sesi berakhir. Silakan login kembali.' } as const
  const db = await getDB()
  if (!(await checkFeatureAccess(db, user.id, 'catatan-siswa'))) {
    return { error: 'Anda tidak memiliki akses ke Catatan Siswa.' } as const
  }
  return { user, db } as const
}

function validateContent(raw: unknown) {
  const isi = String(raw || '').trim()
  if (!isi) return { error: 'Catatan tidak boleh kosong.' }
  if (isi.length > STUDENT_NOTE_MAX_LENGTH) return { error: `Catatan maksimal ${STUDENT_NOTE_MAX_LENGTH.toLocaleString('id-ID')} karakter.` }
  return { isi }
}

export async function createStudentNote(formData: FormData): Promise<ActionResult> {
  const auth = await requireFeature()
  if ('error' in auth) return auth
  const { user, db } = auth
  const siswaId = String(formData.get('siswa_id') || '').trim()
  const penugasanId = String(formData.get('penugasan_id') || '').trim()
  const validation = validateContent(formData.get('isi'))
  if ('error' in validation) return validation
  if (!siswaId || !penugasanId) return { error: 'Penugasan dan siswa wajib dipilih.' }

  const context = await db.prepare(`
    SELECT pm.id AS penugasan_id, pm.kelas_id, pm.mapel_id,
      mp.nama_mapel, k.tingkat, k.nomor_kelas, k.kelompok,
      ta.id AS tahun_ajaran_id, ta.nama AS tahun_ajaran_nama, ta.semester,
      u.nama_lengkap AS pencatat_nama,
      s.nama_lengkap AS siswa_nama
    FROM penugasan_mengajar pm
    JOIN tahun_ajaran ta ON ta.id = pm.tahun_ajaran_id AND ta.is_active = 1
    JOIN mata_pelajaran mp ON mp.id = pm.mapel_id
    JOIN kelas k ON k.id = pm.kelas_id
    JOIN siswa s ON s.id = ? AND s.kelas_id = pm.kelas_id AND s.status = 'aktif'
    JOIN "user" u ON u.id = ?
    WHERE pm.id = ? AND (
      pm.guru_id = ? OR pm.id IN (
        SELECT DISTINCT jm.penugasan_id FROM jadwal_mengajar jm
        JOIN guru_ppl_mapping gpm ON gpm.jadwal_mengajar_id = jm.id
        WHERE gpm.guru_ppl_id = ?
      )
    )
    LIMIT 1
  `).bind(siswaId, user.id, penugasanId, user.id, user.id).first<any>()
  if (!context) return { error: 'Akses ditolak. Siswa bukan bagian dari penugasan aktif Anda.' }

  const id = crypto.randomUUID()
  const kelasLabel = formatNamaKelas(context.tingkat, context.nomor_kelas, context.kelompok)
  const taLabel = `${context.tahun_ajaran_nama} · Semester ${context.semester}`
  await db.prepare(`
    INSERT INTO catatan_siswa (
      id, siswa_id, pencatat_id, penugasan_id, tahun_ajaran_id,
      kelas_id_saat_dibuat, mapel_id_saat_dibuat,
      pencatat_nama_snapshot, kelas_nama_snapshot, mapel_nama_snapshot,
      tahun_ajaran_snapshot, isi, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%d %H:%M:%f','now'), strftime('%Y-%m-%d %H:%M:%f','now'))
  `).bind(
    id, siswaId, user.id, context.penugasan_id, context.tahun_ajaran_id,
    context.kelas_id, context.mapel_id, context.pencatat_nama,
    kelasLabel, context.nama_mapel, taLabel, validation.isi,
  ).run()

  await logActivity({
    db,
    module: 'catatan-siswa',
    action: 'create',
    summary: `Menambahkan catatan siswa untuk ${context.siswa_nama}`,
    entityType: 'catatan_siswa',
    entityId: id,
    entityLabel: context.siswa_nama,
    metadata: { siswa_id: siswaId, penugasan_id: penugasanId, kelas: kelasLabel, mapel: context.nama_mapel },
  })
  revalidateStudentNotePaths(siswaId)
  return { success: 'Catatan siswa berhasil disimpan.' }
}

export async function updateStudentNote(formData: FormData): Promise<ActionResult> {
  const auth = await requireFeature()
  if ('error' in auth) return auth
  const { user, db } = auth
  const noteId = String(formData.get('note_id') || '').trim()
  const validation = validateContent(formData.get('isi'))
  if ('error' in validation) return validation
  const note = await db.prepare(`
    SELECT cs.id, cs.siswa_id, cs.pencatat_id, s.nama_lengkap AS siswa_nama
    FROM catatan_siswa cs JOIN siswa s ON s.id = cs.siswa_id
    WHERE cs.id = ? LIMIT 1
  `).bind(noteId).first<any>()
  if (!note || note.pencatat_id !== user.id) return { error: 'Anda hanya dapat mengubah catatan milik sendiri.' }

  await db.prepare(`UPDATE catatan_siswa SET isi = ?, updated_at = strftime('%Y-%m-%d %H:%M:%f','now') WHERE id = ?`)
    .bind(validation.isi, noteId).run()
  await logActivity({
    db,
    module: 'catatan-siswa',
    action: 'update',
    summary: `Memperbarui catatan siswa untuk ${note.siswa_nama}`,
    entityType: 'catatan_siswa',
    entityId: noteId,
    entityLabel: note.siswa_nama,
    metadata: { siswa_id: note.siswa_id },
  })
  revalidateStudentNotePaths(note.siswa_id)
  return { success: 'Catatan berhasil diperbarui.' }
}

export async function deleteStudentNote(formData: FormData): Promise<ActionResult> {
  const auth = await requireFeature()
  if ('error' in auth) return auth
  const { user, db } = auth
  const noteId = String(formData.get('note_id') || '').trim()
  const note = await db.prepare(`
    SELECT cs.id, cs.siswa_id, cs.pencatat_id, s.nama_lengkap AS siswa_nama
    FROM catatan_siswa cs JOIN siswa s ON s.id = cs.siswa_id
    WHERE cs.id = ? LIMIT 1
  `).bind(noteId).first<any>()
  if (!note || note.pencatat_id !== user.id) return { error: 'Anda hanya dapat menghapus catatan milik sendiri.' }

  await db.prepare('DELETE FROM catatan_siswa WHERE id = ?').bind(noteId).run()
  await logActivity({
    db,
    module: 'catatan-siswa',
    action: 'delete',
    severity: 'warning',
    summary: `Menghapus catatan siswa untuk ${note.siswa_nama}`,
    entityType: 'catatan_siswa',
    entityId: noteId,
    entityLabel: note.siswa_nama,
    metadata: { siswa_id: note.siswa_id },
  })
  revalidateStudentNotePaths(note.siswa_id)
  return { success: 'Catatan berhasil dihapus.' }
}

export async function markStudentNotesRead(kelasId: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Sesi berakhir.' }
  const db = await getDB()
  const isWali = await db.prepare('SELECT 1 FROM kelas WHERE id = ? AND wali_kelas_id = ? LIMIT 1')
    .bind(kelasId, user.id).first()
  if (!isWali) return { error: 'Akses ditolak.' }
  await db.prepare(`
    INSERT INTO catatan_siswa_read_state (user_id, kelas_id, last_read_at)
    VALUES (?, ?, strftime('%Y-%m-%d %H:%M:%f','now'))
    ON CONFLICT(user_id, kelas_id) DO UPDATE SET last_read_at = excluded.last_read_at
  `).bind(user.id, kelasId).run()
  revalidatePath('/dashboard/kelas-binaan')
  return { success: 'Dibaca.' }
}

function revalidateStudentNotePaths(siswaId: string) {
  revalidatePath('/dashboard/catatan-siswa')
  revalidatePath('/dashboard/kelas-binaan')
  revalidatePath(`/dashboard/siswa/${siswaId}`)
}
