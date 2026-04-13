'use server'

import { getDB, dbInsert, dbUpdate } from '@/utils/db'
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
  hari: number
  jam_ke: number
}

export type JadwalPiket = {
  id: string
  hari: number
  shift_nama: string
}

export type ProgramUnggulan = {
  id: string
  label: string
}

export type JadwalGuruUtama = {
  kbm: JadwalKBM[]
  piket: JadwalPiket[]
  pu: ProgramUnggulan[]
}

export type MappingPPL = {
  jadwal_mengajar_id: string | null
  jadwal_piket_id: string | null
  pu_kelas_id: string | null
}

export type PplSummaryItem = {
  guruUtamaId: string
  guruUtamaNama: string
  kbm: number
  piket: number
  pu: number
}

export type PplWithSummary = GuruInfo & {
  substitutions: PplSummaryItem[]
  totalKbm: number
  totalPiket: number
  totalPu: number
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
      SUM(CASE WHEN m.jadwal_mengajar_id IS NOT NULL THEN 1 ELSE 0 END) as kbm,
      SUM(CASE WHEN m.jadwal_piket_id IS NOT NULL THEN 1 ELSE 0 END) as piket,
      SUM(CASE WHEN m.pu_kelas_id IS NOT NULL THEN 1 ELSE 0 END) as pu
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
        pu: Number(s.pu),
      }))

    return {
      ...ppl,
      substitutions: subs,
      totalKbm: subs.reduce((a, b) => a + b.kbm, 0),
      totalPiket: subs.reduce((a, b) => a + b.piket, 0),
      totalPu: subs.reduce((a, b) => a + b.pu, 0),
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
    WHERE u.id NOT IN (
      SELECT id FROM "user" WHERE role = 'guru_ppl'
    )
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
  if (!ta) return { kbm: [], piket: [], pu: [] }

  // Jadwal KBM (jadwal_mengajar)
  const kbmRes = await db.prepare(`
    SELECT jm.id, mp.nama_mapel, k.tingkat, k.nomor_kelas, k.kelompok, jm.hari, jm.jam_ke
    FROM jadwal_mengajar jm
    JOIN penugasan_mengajar pm ON pm.id = jm.penugasan_id
    JOIN mata_pelajaran mp ON mp.id = pm.mapel_id
    JOIN kelas k ON k.id = pm.kelas_id
    WHERE pm.guru_id = ? AND pm.tahun_ajaran_id = ?
    ORDER BY jm.hari ASC, jm.jam_ke ASC
  `).bind(guruUtamaId, ta.id).all<any>()

  const kbm: JadwalKBM[] = (kbmRes.results || []).map(r => ({
    id: r.id,
    mapel_nama: r.nama_mapel,
    kelas_label: formatNamaKelas(r.tingkat, r.nomor_kelas, r.kelompok),
    hari: r.hari,
    jam_ke: r.jam_ke
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

  // Program Unggulan — guru terhubung lewat pu_guru_kelas
  const puRes = await db.prepare(`
    SELECT pk.id, k.tingkat, k.nomor_kelas, k.kelompok
    FROM pu_guru_kelas pgk
    JOIN pu_kelas_unggulan pk ON pk.id = pgk.pu_kelas_id
    JOIN kelas k ON k.id = pk.kelas_id
    WHERE pgk.guru_id = ? AND pk.tahun_ajaran_id = ?
    ORDER BY k.tingkat ASC, k.kelompok ASC, k.nomor_kelas ASC
  `).bind(guruUtamaId, ta.id).all<any>()

  const pu: ProgramUnggulan[] = (puRes.results || []).map(r => ({
    id: r.id,
    label: `Kelas ${r.tingkat}${r.kelompok ?? ''}-${r.nomor_kelas} (Unggulan)`
  }))

  return { kbm, piket, pu }
}

// ============================================================
// 4. Ambil Mapping PPL yang sudah ada
// ============================================================
export async function getMappingPPL(guruPplId: string, guruUtamaId: string): Promise<MappingPPL[]> {
  const db = await getDB()
  const { results } = await db.prepare(`
    SELECT jadwal_mengajar_id, jadwal_piket_id, pu_kelas_id
    FROM guru_ppl_mapping
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

    const db = await getDB()

    // Hapus mapping existing untuk pasangan PPL & Guru Utama ini
    await db.prepare(`DELETE FROM guru_ppl_mapping WHERE guru_ppl_id = ? AND guru_utama_id = ?`).bind(guruPplId, guruUtamaId).run()

    if (data.length === 0) {
      revalidatePath('/dashboard/kelola-ppl')
      return { success: true }
    }

    // Insert new mappings
    const stmts = data.map(m => 
      db.prepare(`
        INSERT INTO guru_ppl_mapping (id, guru_ppl_id, guru_utama_id, jadwal_mengajar_id, jadwal_piket_id, pu_kelas_id)
        VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?)
      `).bind(
        guruPplId, guruUtamaId, 
        m.jadwal_mengajar_id || null, 
        m.jadwal_piket_id || null, 
        m.pu_kelas_id || null
      )
    )

    // Run in chunks of 50
    for (let i = 0; i < stmts.length; i += 50) {
      await db.batch(stmts.slice(i, i + 50))
    }

    revalidatePath('/dashboard/kelola-ppl')
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Gagal menyimpan mapping.' }
  }
}
