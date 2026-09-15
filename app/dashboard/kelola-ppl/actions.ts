'use server'

import { dbInsert, dbUpdate } from '@/utils/db'
import { getDB as getRawDB } from '@/utils/db-server'
import { requireActionAccess } from '@/lib/action-security'

async function getDB() {
  await requireActionAccess('kelola-ppl', 'read')
  return getRawDB()
}
import { getCurrentUser } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'
import { formatNamaKelas } from '@/lib/utils'

// ============================================================
// TYPES
// ============================================================
export type GuruInfo = {
  id: string
  nama_lengkap: string
  role: string
}

export type JadwalKBM = {
  id: string
  mapel_nama: string
  kelas_label: string
  jadwal_label: string
}

export type JadwalPiket = {
  id: string
  hari: number
  shift_nama: string
}


export type JadwalGuruUtama = {
  kbm: JadwalKBM[]
  piket: JadwalPiket[]
}

export type MappingPPL = {
  penugasan_mengajar_id: string | null
  jadwal_piket_id: string | null
}

export type PplSummaryItem = {
  guruUtamaId: string
  guruUtamaNama: string
  kbm: number
  piket: number
}

export type PplWithSummary = GuruInfo & {
  substitutions: PplSummaryItem[]
  totalKbm: number
  totalPiket: number
}

// ============================================================
// 1. Ambil daftar Guru PPL
// ============================================================
export async function getDaftarGuruPPL(): Promise<GuruInfo[]> {
  const db = await getDB()
  const { results } = await db.prepare(`
    SELECT DISTINCT u.id, u.nama_lengkap, u.role
    FROM "user" u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    WHERE u.role = 'guru_ppl' OR ur.role = 'guru_ppl'
    ORDER BY u.nama_lengkap ASC
  `).all<any>()
  return results || []
}

export async function getDaftarGuruPPLWithSummary(): Promise<PplWithSummary[]> {
  const db = await getDB()
  const pplList = await getDaftarGuruPPL()

  const { results } = await db.prepare(`
    SELECT 
      m.guru_ppl_id,
      m.guru_utama_id,
      u.nama_lengkap as guru_utama_nama,
      SUM(CASE WHEN m.penugasan_mengajar_id IS NOT NULL THEN 1 ELSE 0 END) as kbm,
      SUM(CASE WHEN m.jadwal_piket_id IS NOT NULL THEN 1 ELSE 0 END) as piket
    FROM guru_ppl_mapping m
    JOIN "user" u ON u.id = m.guru_utama_id
    GROUP BY m.guru_ppl_id, m.guru_utama_id
    ORDER BY u.nama_lengkap ASC
  `).all<any>()

  const summary = results || []

  return pplList.map(ppl => {
    const subs = summary
      .filter((s: any) => s.guru_ppl_id === ppl.id)
      .map((s: any) => ({
        guruUtamaId: s.guru_utama_id,
        guruUtamaNama: s.guru_utama_nama,
        kbm: Number(s.kbm),
        piket: Number(s.piket),
      }))

    return {
      ...ppl,
      substitutions: subs,
      totalKbm: subs.reduce((a, b) => a + b.kbm, 0),
      totalPiket: subs.reduce((a, b) => a + b.piket, 0),
    }
  })
}

// ============================================================
// 2. Ambil daftar Guru Utama (semua guru selain PPL)
// ============================================================
export async function getDaftarGuruUtama(): Promise<GuruInfo[]> {
  const db = await getDB()
  const { results } = await db.prepare(`
    SELECT DISTINCT u.id, u.nama_lengkap, u.role
    FROM "user" u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    WHERE u.role <> 'guru_ppl'
    AND NOT EXISTS (SELECT 1 FROM user_roles ppl_role WHERE ppl_role.user_id = u.id AND ppl_role.role = 'guru_ppl')
    AND (u.role IN ('guru', 'wali_kelas', 'guru_bk', 'guru_piket', 'wakamad', 'kepsek') 
         OR ur.role IN ('guru', 'wali_kelas', 'guru_bk', 'guru_piket', 'wakamad', 'kepsek'))
    ORDER BY u.nama_lengkap ASC
  `).all<any>()
  return results || []
}

// ============================================================
// 3. Ambil jadwal lengkap dari Guru Utama
// ============================================================
export async function getJadwalGuruUtama(guruUtamaId: string): Promise<JadwalGuruUtama> {
  const db = await getDB()
  const ta = await db.prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<any>()
  if (!ta) return { kbm: [], piket: [] }

  // Jadwal KBM (jadwal_mengajar)
  const kbmRes = await db.prepare(`
    SELECT pm.id, mp.nama_mapel, k.tingkat, k.nomor_kelas, k.kelompok,
      GROUP_CONCAT(jm.hari || ':' || jm.jam_ke) AS jadwal_label
    FROM penugasan_mengajar pm
    JOIN jadwal_mengajar jm ON jm.penugasan_id = pm.id
    JOIN mata_pelajaran mp ON mp.id = pm.mapel_id
    JOIN kelas k ON k.id = pm.kelas_id
    WHERE pm.guru_id = ? AND pm.tahun_ajaran_id = ?
    GROUP BY pm.id, mp.nama_mapel, k.tingkat, k.nomor_kelas, k.kelompok
    ORDER BY k.tingkat, k.kelompok, CAST(k.nomor_kelas AS INTEGER), mp.nama_mapel
  `).bind(guruUtamaId, ta.id).all<any>()

  const kbm: JadwalKBM[] = (kbmRes.results || []).map(r => ({
    id: r.id,
    mapel_nama: r.nama_mapel,
    kelas_label: formatNamaKelas(r.tingkat, r.nomor_kelas, r.kelompok),
    jadwal_label: r.jadwal_label || ''
  }))

  // Jadwal Piket
  const piketRes = await db.prepare(`
    SELECT j.id, j.hari, p.nama_shift
    FROM jadwal_guru_piket j
    JOIN pengaturan_shift_piket p ON p.id = j.shift_id
    WHERE j.user_id = ?
    ORDER BY j.hari ASC, p.jam_mulai ASC
  `).bind(guruUtamaId).all<any>()

  const piket: JadwalPiket[] = (piketRes.results || []).map(r => ({
    id: r.id,
    hari: r.hari,
    shift_nama: r.nama_shift
  }))


  return { kbm, piket }
}

// ============================================================
// 4. Ambil Mapping PPL yang sudah ada
// ============================================================
export async function getMappingPPL(guruPplId: string, guruUtamaId: string): Promise<MappingPPL[]> {
  const db = await getDB()
  const { results } = await db.prepare(`
    SELECT penugasan_mengajar_id, jadwal_piket_id FROM guru_ppl_mapping
    WHERE guru_ppl_id = ? AND guru_utama_id = ?
  `).bind(guruPplId, guruUtamaId).all<any>()
  
  return results || []
}

// ============================================================
// 5. Simpan Mapping PPL
// ============================================================
export async function simpanMappingPPL(
  guruPplId: string, 
  guruUtamaId: string, 
  data: MappingPPL[]
): Promise<{ success?: boolean; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) return { error: 'Unauthorized' }

    await requireActionAccess('kelola-ppl', 'update')
    const db = await getRawDB()
    if (guruPplId === guruUtamaId) return { error: 'Guru PPL tidak dapat menggantikan dirinya sendiri.' }

    const [pplValid, guruValid] = await Promise.all([
      db.prepare(`SELECT 1 FROM "user" u LEFT JOIN user_roles ur ON ur.user_id=u.id WHERE u.id=? AND (u.role='guru_ppl' OR ur.role='guru_ppl') LIMIT 1`).bind(guruPplId).first(),
      db.prepare(`SELECT 1 FROM "user" u LEFT JOIN user_roles ur ON ur.user_id=u.id WHERE u.id=? AND (u.role IN ('guru','wali_kelas','guru_bk','guru_piket','wakamad','kepsek') OR ur.role IN ('guru','wali_kelas','guru_bk','guru_piket','wakamad','kepsek')) AND u.role <> 'guru_ppl' AND NOT EXISTS (SELECT 1 FROM user_roles pr WHERE pr.user_id=u.id AND pr.role='guru_ppl') LIMIT 1`).bind(guruUtamaId).first(),
    ])
    if (!pplValid || !guruValid) return { error: 'Pasangan Guru PPL dan Guru Utama tidak valid.' }

    const invalidShape = data.some(m => (!!m.penugasan_mengajar_id) === (!!m.jadwal_piket_id))
    if (invalidShape) return { error: 'Setiap mapping harus berisi tepat satu penugasan KBM atau jadwal piket.' }
    const penugasanIds = [...new Set(data.flatMap(m => m.penugasan_mengajar_id ? [m.penugasan_mengajar_id] : []))]
    const piketIds = [...new Set(data.flatMap(m => m.jadwal_piket_id ? [m.jadwal_piket_id] : []))]
    if (penugasanIds.length) {
      const rows = await db.prepare(`SELECT pm.id FROM penugasan_mengajar pm JOIN tahun_ajaran ta ON ta.id=pm.tahun_ajaran_id AND ta.is_active=1 WHERE pm.guru_id=? AND pm.id IN (${penugasanIds.map(() => '?').join(',')})`).bind(guruUtamaId, ...penugasanIds).all<any>()
      if ((rows.results || []).length !== penugasanIds.length) return { error: 'Ada penugasan KBM yang bukan milik Guru Utama.' }
    }
    if (piketIds.length) {
      const rows = await db.prepare(`SELECT id FROM jadwal_guru_piket WHERE user_id=? AND id IN (${piketIds.map(() => '?').join(',')})`).bind(guruUtamaId, ...piketIds).all<any>()
      if ((rows.results || []).length !== piketIds.length) return { error: 'Ada jadwal piket yang bukan milik Guru Utama.' }
    }

    const normalized: MappingPPL[] = [
      ...penugasanIds.map(id => ({ penugasan_mengajar_id: id, jadwal_piket_id: null })),
      ...piketIds.map(id => ({ penugasan_mengajar_id: null, jadwal_piket_id: id })),
    ]
    const stmts = normalized.map(m =>
      db.prepare(`
        INSERT INTO guru_ppl_mapping (id, guru_ppl_id, guru_utama_id, penugasan_mengajar_id, jadwal_piket_id)
        VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?)
      `).bind(
        guruPplId, guruUtamaId, 
        m.penugasan_mengajar_id || null,
        m.jadwal_piket_id || null
      )
    )
    const remove = db.prepare(`DELETE FROM guru_ppl_mapping WHERE guru_ppl_id = ? AND guru_utama_id = ?`).bind(guruPplId, guruUtamaId)
    await db.batch([remove, ...stmts])

    revalidatePath('/dashboard/kelola-ppl')
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Gagal menyimpan mapping.' }
  }
}
