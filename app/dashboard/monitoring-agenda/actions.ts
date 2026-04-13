// Lokasi: app/dashboard/monitoring-agenda/actions.ts
'use server'

import { getDB, dbUpdate, dbInsert } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'
import { formatNamaKelas } from '@/lib/utils'
import type { PolaJam, SlotJam } from '@/app/dashboard/settings/types'

// ============================================================
// HELPER
// ============================================================
function parsePolaJam(raw: string): PolaJam[] {
  try { return JSON.parse(raw) } catch { return [] }
}

function getSlotsForHari(polaList: PolaJam[], hari: number): SlotJam[] {
  return polaList.find(p => p.hari.includes(hari))?.slots ?? []
}

function getHariFromDate(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  return day === 0 ? 7 : day
}

const HARI_NAMA = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

// ============================================================
// 1. MONITORING HARIAN — semua guru yang punya jadwal di tanggal tertentu
//    Menampilkan siapa sudah isi & siapa ALFA
//    Efisien: 1 query join, tanpa N+1
// ============================================================
export async function getMonitoringHarian(tanggal: string, filterMode: 'semua' | 'guru' | 'kelas', filterId?: string) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', data: [] }

  const db = await getDB()
  const hari = getHariFromDate(tanggal)
  if (hari === 7) return { error: null, data: [], hariNama: 'Minggu' }

  const ta = await db.prepare(
    'SELECT id, jam_pelajaran FROM tahun_ajaran WHERE is_active = 1 LIMIT 1'
  ).first<any>()
  if (!ta) return { error: 'Tahun ajaran aktif belum diatur', data: [] }

  const polaList = parsePolaJam(ta.jam_pelajaran || '[]')
  const slots = getSlotsForHari(polaList, hari)

  // Query: semua jadwal hari itu + LEFT JOIN agenda_guru + LEFT JOIN delegasi_tugas
  let sql = `
    SELECT
      jm.penugasan_id,
      jm.jam_ke,
      pm.guru_id,
      u.nama_lengkap as guru_nama,
      mp.nama_mapel,
      k.id as kelas_id, k.tingkat, k.nomor_kelas, k.kelompok,
      ag.id as agenda_id,
      ag.materi,
      ag.foto_url,
      ag.status,
      ag.waktu_input,
      ag.catatan_admin,
      dtk.id as delegasi_kelas_id,
      u_pelaksana.nama_lengkap as pelaksana_nama
    FROM jadwal_mengajar jm
    JOIN penugasan_mengajar pm ON jm.penugasan_id = pm.id
    JOIN "user" u ON pm.guru_id = u.id
    JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
    JOIN kelas k ON pm.kelas_id = k.id
    LEFT JOIN agenda_guru ag ON ag.penugasan_id = jm.penugasan_id AND ag.tanggal = ?
    LEFT JOIN delegasi_tugas_kelas dtk ON dtk.penugasan_mengajar_id = jm.penugasan_id
      AND dtk.delegasi_id IN (SELECT dt.id FROM delegasi_tugas dt WHERE dt.dari_user_id = pm.guru_id AND dt.tanggal = ?)
    LEFT JOIN delegasi_tugas dt_info ON dtk.delegasi_id = dt_info.id
    LEFT JOIN "user" u_pelaksana ON dt_info.kepada_user_id = u_pelaksana.id
    WHERE jm.tahun_ajaran_id = ? AND jm.hari = ?
  `
  const params: unknown[] = [tanggal, tanggal, ta.id, hari]

  if (filterMode === 'guru' && filterId) {
    sql += ' AND pm.guru_id = ?'
    params.push(filterId)
  } else if (filterMode === 'kelas' && filterId) {
    sql += ' AND pm.kelas_id = ?'
    params.push(filterId)
  }

  sql += ' ORDER BY u.nama_lengkap, jm.jam_ke'

  const result = await db.prepare(sql).bind(...params).all<any>()
  const rows = result.results || []

  // Group per penugasan
  const grouped = new Map<string, any[]>()
  for (const r of rows) {
    if (!grouped.has(r.penugasan_id)) grouped.set(r.penugasan_id, [])
    grouped.get(r.penugasan_id)!.push(r)
  }

  const data: any[] = []
  for (const [pid, pRows] of grouped) {
    const jamList = pRows.map(r => r.jam_ke).sort((a: number, b: number) => a - b)
    const first = pRows[0]
    const jamMulai = jamList[0]
    const jamSelesai = jamList[jamList.length - 1]
    const slotMulai = slots.find(s => s.id === jamMulai)
    const slotSelesai = slots.find(s => s.id === jamSelesai)

    // Tentukan status: agenda > delegasi (TUGAS) > ALFA
    let status: string
    if (first.agenda_id) {
      status = first.status
    } else if (first.delegasi_kelas_id) {
      status = 'TUGAS'
    } else {
      status = 'ALFA'
    }

    data.push({
      penugasan_id: pid,
      guru_id: first.guru_id,
      guru_nama: first.guru_nama,
      mapel_nama: first.nama_mapel,
      kelas_id: first.kelas_id,
      kelas_label: formatNamaKelas(first.tingkat, first.nomor_kelas, first.kelompok),
      jam_ke_mulai: jamMulai,
      jam_ke_selesai: jamSelesai,
      jam_label: jamMulai === jamSelesai ? `Jam ${jamMulai}` : `Jam ${jamMulai}-${jamSelesai}`,
      slot_mulai: slotMulai?.mulai ?? '-',
      slot_selesai: slotSelesai?.selesai ?? '-',
      // Agenda data (null jika belum isi = ALFA/TUGAS)
      agenda_id: first.agenda_id,
      materi: first.materi,
      foto_url: first.foto_url,
      status,
      waktu_input: first.waktu_input,
      catatan_admin: first.catatan_admin,
      pelaksana_nama: first.pelaksana_nama || null,
    })
  }

  return { error: null, data, hariNama: HARI_NAMA[hari] || '', slots }
}

// ============================================================
// 2. DAFTAR GURU & KELAS (untuk filter dropdown)
// ============================================================
export async function getFilterOptions() {
  const db = await getDB()
  const ta = await db.prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<any>()
  if (!ta) return { guru: [], kelas: [] }

  const [guruRes, kelasRes] = await Promise.all([
    db.prepare(`
      SELECT DISTINCT u.id, u.nama_lengkap
      FROM penugasan_mengajar pm
      JOIN "user" u ON pm.guru_id = u.id
      WHERE pm.tahun_ajaran_id = ?
      ORDER BY u.nama_lengkap
    `).bind(ta.id).all<any>(),
    db.prepare('SELECT id, tingkat, nomor_kelas, kelompok FROM kelas ORDER BY tingkat, kelompok, nomor_kelas').all<any>(),
  ])

  return {
    guru: (guruRes.results || []).map((g: any) => ({ id: g.id, nama: g.nama_lengkap })),
    kelas: (kelasRes.results || []).map((k: any) => ({
      id: k.id,
      label: formatNamaKelas(k.tingkat, k.nomor_kelas, k.kelompok),
    })),
  }
}

// ============================================================
// 3. REKAP KEHADIRAN GURU (rentang tanggal)
//    Hitung total: TEPAT_WAKTU, TELAT, ALFA, SAKIT, IZIN per guru
// ============================================================
export async function getRekapKehadiranGuru(
  tanggalMulai: string,
  tanggalSelesai: string,
  sortBy: 'nama' | 'patuh' | 'alfa' = 'nama'
) {
  const db = await getDB()
  const ta = await db.prepare('SELECT id, jam_pelajaran FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<any>()
  if (!ta) return { error: 'Tahun ajaran aktif belum diatur', data: [] }

  // Hitung total jadwal per guru dalam rentang tanggal
  // Kita perlu hitung berapa blok mengajar per guru per hari kerja dalam range
  // Simplified approach: count distinct (penugasan_id) per hari dari jadwal

  // 1. Ambil semua penugasan guru + jadwal hari apa saja
  const jadwalRes = await db.prepare(`
    SELECT pm.guru_id, jm.penugasan_id, jm.hari
    FROM jadwal_mengajar jm
    JOIN penugasan_mengajar pm ON jm.penugasan_id = pm.id
    WHERE jm.tahun_ajaran_id = ?
  `).bind(ta.id).all<any>()

  // Group: guru_id → Map<penugasan_id, Set<hari>>
  const guruJadwal = new Map<string, Map<string, Set<number>>>()
  for (const row of jadwalRes.results || []) {
    if (!guruJadwal.has(row.guru_id)) guruJadwal.set(row.guru_id, new Map())
    const penMap = guruJadwal.get(row.guru_id)!
    if (!penMap.has(row.penugasan_id)) penMap.set(row.penugasan_id, new Set())
    penMap.get(row.penugasan_id)!.add(row.hari)
  }

  // 2. Hitung total blok per guru dalam rentang tanggal
  const start = new Date(tanggalMulai + 'T00:00:00')
  const end = new Date(tanggalSelesai + 'T00:00:00')
  const totalBlokPerGuru = new Map<string, number>()

  for (const [guruId, penMap] of guruJadwal) {
    let total = 0
    const d = new Date(start)
    while (d <= end) {
      const dayOfWeek = d.getDay()
      const hari = dayOfWeek === 0 ? 7 : dayOfWeek
      if (hari <= 6) { // Senin-Sabtu
        for (const [, hariSet] of penMap) {
          if (hariSet.has(hari)) total++
        }
      }
      d.setDate(d.getDate() + 1)
    }
    totalBlokPerGuru.set(guruId, total)
  }

  // 3. Ambil agenda yang tercatat
  const agendaRes = await db.prepare(`
    SELECT ag.guru_id, ag.status, COUNT(*) as cnt
    FROM agenda_guru ag
    WHERE ag.tanggal BETWEEN ? AND ?
    GROUP BY ag.guru_id, ag.status
  `).bind(tanggalMulai, tanggalSelesai).all<any>()

  // 3b. Ambil delegasi tugas (count per guru = berapa blok yang didelegasikan)
  const delegasiRes = await db.prepare(`
    SELECT dt.dari_user_id as guru_id, COUNT(DISTINCT dtk.penugasan_mengajar_id) as cnt
    FROM delegasi_tugas dt
    JOIN delegasi_tugas_kelas dtk ON dtk.delegasi_id = dt.id
    WHERE dt.tanggal BETWEEN ? AND ?
    GROUP BY dt.dari_user_id
  `).bind(tanggalMulai, tanggalSelesai).all<any>()

  const delegasiCountMap = new Map<string, number>()
  for (const row of delegasiRes.results || []) {
    delegasiCountMap.set(row.guru_id, row.cnt)
  }

  // Build rekap per guru
  const rekapMap = new Map<string, { tepat: number, telat: number, alfa: number, sakit: number, izin: number }>()
  for (const row of agendaRes.results || []) {
    if (!rekapMap.has(row.guru_id)) rekapMap.set(row.guru_id, { tepat: 0, telat: 0, alfa: 0, sakit: 0, izin: 0 })
    const r = rekapMap.get(row.guru_id)!
    if (row.status === 'TEPAT_WAKTU') r.tepat = row.cnt
    else if (row.status === 'TELAT') r.telat = row.cnt
    else if (row.status === 'ALFA') r.alfa = row.cnt
    else if (row.status === 'SAKIT') r.sakit = row.cnt
    else if (row.status === 'IZIN') r.izin = row.cnt
  }

  // 4. Ambil nama guru
  const guruIds = Array.from(guruJadwal.keys())
  if (guruIds.length === 0) return { error: null, data: [] }

  const placeholders = guruIds.map(() => '?').join(',')
  const guruRes = await db.prepare(
    `SELECT id, nama_lengkap FROM "user" WHERE id IN (${placeholders})`
  ).bind(...guruIds).all<any>()
  const guruNamaMap = new Map<string, string>()
  for (const g of guruRes.results || []) guruNamaMap.set(g.id, g.nama_lengkap)

  // 5. Compile data
  const data = guruIds.map(gid => {
    const totalBlok = totalBlokPerGuru.get(gid) || 0
    const r = rekapMap.get(gid) || { tepat: 0, telat: 0, alfa: 0, sakit: 0, izin: 0 }
    const tugasCount = delegasiCountMap.get(gid) || 0
    const totalIsi = r.tepat + r.telat + r.sakit + r.izin + r.alfa + tugasCount
    const alfaHitung = Math.max(0, totalBlok - totalIsi) + r.alfa
    const kepatuhan = totalBlok > 0 ? Math.round(((r.tepat + r.telat + tugasCount) / totalBlok) * 100) : 0

    return {
      guru_id: gid,
      guru_nama: guruNamaMap.get(gid) || 'Unknown',
      total_blok: totalBlok,
      tepat_waktu: r.tepat,
      telat: r.telat,
      tugas: tugasCount,
      alfa: alfaHitung,
      sakit: r.sakit,
      izin: r.izin,
      kepatuhan,
    }
  })

  // Sort
  if (sortBy === 'patuh') data.sort((a, b) => b.kepatuhan - a.kepatuhan)
  else if (sortBy === 'alfa') data.sort((a, b) => b.alfa - a.alfa)
  else data.sort((a, b) => a.guru_nama.localeCompare(b.guru_nama))

  return { error: null, data }
}

// ============================================================
// 4. ADMIN: EDIT STATUS AGENDA
//    Bisa ubah ALFA → SAKIT/IZIN/HADIR, dll
//    Jika belum ada record (ALFA), buat baru
// ============================================================
export async function editAgendaStatus(
  agendaId: string | null,
  penugasanId: string,
  tanggal: string,
  guruId: string,
  jamKeMulai: number,
  jamKeSelesai: number,
  newStatus: string,
  catatanAdmin: string
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const isAdmin = ['super_admin', 'admin_tu', 'kepsek'].includes(user.role)
  if (!isAdmin) return { error: 'Hanya admin yang bisa mengubah status.' }

  const db = await getDB()

  if (agendaId) {
    // Update existing record
    const result = await dbUpdate(db, 'agenda_guru', {
      status: newStatus,
      catatan_admin: catatanAdmin || null,
      diubah_oleh: user.id,
      updated_at: new Date().toISOString(),
    }, { id: agendaId })
    if (result.error) return { error: result.error }
  } else {
    // ALFA → create new record (guru tidak mengisi, admin override)
    const result = await dbInsert(db, 'agenda_guru', {
      guru_id: guruId,
      penugasan_id: penugasanId,
      tanggal,
      jam_ke_mulai: jamKeMulai,
      jam_ke_selesai: jamKeSelesai,
      materi: null,
      foto_url: null,
      status: newStatus,
      waktu_input: null,
      catatan_admin: catatanAdmin || null,
      diubah_oleh: user.id,
    })
    if (result.error) return { error: result.error }
  }

  revalidatePath('/dashboard/monitoring-agenda')
  return { success: `Status berhasil diubah menjadi ${newStatus}.` }
}

// ============================================================
// 5. DATA CETAK LAPORAN
// ============================================================
export async function getDataCetakLaporan(
  tanggalMulai: string,
  tanggalSelesai: string,
  guruId?: string
) {
  const db = await getDB()

  let sql = `
    SELECT ag.*,
      u.nama_lengkap as guru_nama,
      mp.nama_mapel,
      k.tingkat, k.nomor_kelas, k.kelompok
    FROM agenda_guru ag
    JOIN penugasan_mengajar pm ON ag.penugasan_id = pm.id
    JOIN "user" u ON ag.guru_id = u.id
    JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
    JOIN kelas k ON pm.kelas_id = k.id
    WHERE ag.tanggal BETWEEN ? AND ?
  `
  const params: unknown[] = [tanggalMulai, tanggalSelesai]

  if (guruId) {
    sql += ' AND ag.guru_id = ?'
    params.push(guruId)
  }

  sql += ' ORDER BY ag.tanggal ASC, u.nama_lengkap ASC, ag.jam_ke_mulai ASC'

  const result = await db.prepare(sql).bind(...params).all<any>()
  return result.results || []
}

// ============================================================
// 6. MONITORING PIKET HARIAN
//    Semua guru piket yang punya jadwal di tanggal tertentu
//    beserta status kehadiran (HADIR/TELAT/ALFA/SAKIT/IZIN)
// ============================================================
export async function getMonitoringPiketHarian(tanggal: string) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', data: [] }

  const db = await getDB()
  const hari = getHariFromDate(tanggal)
  if (hari === 7) return { error: null, data: [], hariNama: 'Minggu' }

  const ta = await db.prepare(
    'SELECT id, jam_pelajaran FROM tahun_ajaran WHERE is_active = 1 LIMIT 1'
  ).first<any>()

  const polaList = ta ? parsePolaJam(ta.jam_pelajaran || '[]') : []
  const slots = getSlotsForHari(polaList, hari)

  const result = await db.prepare(`
    SELECT
      j.id as jadwal_id,
      j.user_id,
      u.nama_lengkap as guru_nama,
      s.id as shift_id,
      s.nama_shift,
      s.jam_mulai,
      s.jam_selesai,
      ap.id as agenda_id,
      ap.foto_url,
      ap.status as agenda_status,
      ap.waktu_submit,
      ap.catatan_admin
    FROM jadwal_guru_piket j
    JOIN pengaturan_shift_piket s ON j.shift_id = s.id
    JOIN "user" u ON j.user_id = u.id
    LEFT JOIN agenda_piket ap ON ap.jadwal_id = j.id AND ap.tanggal = ?
    WHERE j.hari = ?
    ORDER BY u.nama_lengkap ASC, s.id ASC
  `).bind(tanggal, hari).all<any>()

  const rows = result.results || []

  const data = rows.map((r: any) => {
    const slotMulai = slots.find(s => s.id === r.jam_mulai)
    const slotSelesai = slots.find(s => s.id === r.jam_selesai)
    const status = r.agenda_id ? (r.agenda_status || 'HADIR') : 'ALFA'

    return {
      jadwal_id: r.jadwal_id,
      user_id: r.user_id,
      guru_nama: r.guru_nama,
      shift_id: r.shift_id,
      shift_nama: r.nama_shift,
      jam_mulai: r.jam_mulai,
      jam_selesai: r.jam_selesai,
      slot_mulai: slotMulai?.mulai ?? '-',
      slot_selesai: slotSelesai?.selesai ?? '-',
      agenda_id: r.agenda_id ?? null,
      foto_url: r.foto_url ?? null,
      status,
      waktu_submit: r.waktu_submit ?? null,
      catatan_admin: r.catatan_admin ?? null,
    }
  })

  return { error: null, data, hariNama: HARI_NAMA[hari] || '' }
}

// ============================================================
// 7. ADMIN: EDIT STATUS AGENDA PIKET
//    Bisa ubah ALFA → SAKIT/IZIN/HADIR, dll
//    Jika belum ada record, buat baru (tandai admin sebagai pembuat)
// ============================================================
export async function editAgendaPiketStatus(
  agendaId: string | null,
  jadwalId: string,
  userId: string,
  shiftId: number,
  tanggal: string,
  newStatus: string,
  catatanAdmin: string
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const isAdmin = ['super_admin', 'admin_tu', 'kepsek'].includes(user.role)
  if (!isAdmin) return { error: 'Hanya admin yang bisa mengubah status.' }

  const db = await getDB()

  if (agendaId) {
    const result = await dbUpdate(db, 'agenda_piket', {
      status: newStatus,
      catatan_admin: catatanAdmin || null,
      diubah_oleh: user.id,
    }, { id: agendaId })
    if (result.error) return { error: result.error }
  } else {
    const result = await dbInsert(db, 'agenda_piket', {
      user_id: userId,
      jadwal_id: jadwalId,
      shift_id: shiftId,
      tanggal,
      foto_url: null,
      status: newStatus,
      waktu_submit: null,
      catatan_admin: catatanAdmin || null,
      diubah_oleh: user.id,
    })
    if (result.error) return { error: result.error }
  }

  revalidatePath('/dashboard/monitoring-agenda')
  return { success: `Status piket berhasil diubah menjadi ${newStatus}.` }
}
