// utils/cache.ts
// Helper query untuk data statis — dipanggil dari Server Components
// Next.js 16 + Cloudflare Workers: cache dihandle di level page via revalidatePath
// Tidak menggunakan unstable_cache / 'use cache' directive agar kompatibel

import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getDB } from './db'
import { todayWIB } from '@/lib/time'

// ============================================================
// TAHUN AJARAN AKTIF
// ============================================================
export async function getTahunAjaranAktifCached() {
  const db = await getDB()
  const row = await db
    .prepare('SELECT id, nama, semester, daftar_jurusan FROM tahun_ajaran WHERE is_active = 1 LIMIT 1')
    .first<any>()
  return row ?? null
}

// ============================================================
// MASTER PELANGGARAN
// ============================================================
export async function getMasterPelanggaranCached() {
  const db = await getDB()
  const result = await db
    .prepare('SELECT id, kategori, nama_pelanggaran, poin FROM master_pelanggaran ORDER BY poin ASC')
    .all<any>()
  return result.results ?? []
}

// ============================================================
// DAFTAR MAPEL
// ============================================================
export async function getDaftarMapelCached() {
  const db = await getDB()
  const result = await db
    .prepare('SELECT id, nama_mapel, kode_mapel, kelompok, tingkat, kategori FROM mata_pelajaran ORDER BY nama_mapel ASC')
    .all<any>()
  return result.results ?? []
}

// ============================================================
// STATISTIK DASHBOARD SUPER ADMIN
// Agregat school-wide (sama untuk semua admin) -> di-cache di KV 10 menit
// supaya tidak hit D1 tiap buka dashboard. Hanya COUNT/GROUP BY (hemat row-read).
// ============================================================
export type ActivitySeverityRow = { tgl: string; info: number; warning: number; danger: number }
export type PerluPerhatianRow = {
  created_at: string; module: string; action: string
  summary: string; actor_name: string | null; severity: string
}
export type SuperAdminDashboardStats = {
  generatedAt: string
  aktivitas7h: ActivitySeverityRow[]
  perluPerhatian: PerluPerhatianRow[]
  gender: { L: number; P: number }
  domisili: { label: string; count: number }[]
  pelanggaran14h: { tgl: string; cnt: number }[]
  topPelanggaran: { nama: string; count: number }[]
  presensiPegawai: { status: string; count: number }[]
}

const SUPERADMIN_STATS_KEY = 'dash:superadmin:v1'
const SUPERADMIN_STATS_TTL = 600 // 10 menit

async function getKV(): Promise<KVNamespace | null> {
  try {
    const { env } = await getCloudflareContext({ async: true })
    return (env.NEXT_INC_CACHE_KV as KVNamespace) ?? null
  } catch {
    return null
  }
}

async function computeSuperAdminDashboardStats(db: D1Database): Promise<SuperAdminDashboardStats> {
  const today = todayWIB()

  const [
    aktivitasRaw,
    perluPerhatian,
    genderRows,
    domisiliRows,
    pelanggaranRaw,
    topPelanggaranRows,
    presensiRows,
  ] = await Promise.all([
    db.prepare(`
      SELECT DATE(created_at) AS tgl, severity, COUNT(*) AS cnt
      FROM activity_logs
      WHERE created_at >= date(?, '-6 days')
      GROUP BY tgl, severity
    `).bind(today).all<{ tgl: string; severity: string; cnt: number }>(),

    db.prepare(`
      SELECT created_at, module, action, summary, actor_name, severity
      FROM activity_logs
      WHERE severity IN ('warning','danger')
      ORDER BY created_at DESC
      LIMIT 8
    `).all<PerluPerhatianRow>(),

    db.prepare(`
      SELECT jenis_kelamin AS jk, COUNT(*) AS c
      FROM siswa WHERE status = 'aktif'
      GROUP BY jenis_kelamin
    `).all<{ jk: string; c: number }>(),

    db.prepare(`
      SELECT tempat_tinggal AS label, COUNT(*) AS c
      FROM siswa WHERE status = 'aktif'
      GROUP BY tempat_tinggal
      ORDER BY c DESC
    `).all<{ label: string; c: number }>(),

    db.prepare(`
      SELECT DATE(tanggal) AS tgl, COUNT(*) AS cnt
      FROM siswa_pelanggaran
      WHERE tanggal >= date(?, '-13 days')
      GROUP BY tgl ORDER BY tgl
    `).bind(today).all<{ tgl: string; cnt: number }>(),

    db.prepare(`
      SELECT mp.nama_pelanggaran AS nama, COUNT(*) AS c
      FROM siswa_pelanggaran sp
      JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
      GROUP BY mp.id ORDER BY c DESC LIMIT 5
    `).all<{ nama: string; c: number }>(),

    db.prepare(`
      SELECT status, COUNT(*) AS c
      FROM presensi_pegawai
      WHERE tanggal = ?
      GROUP BY status
    `).bind(today).all<{ status: string; c: number }>(),
  ])

  // Pivot aktivitas -> per hari {info,warning,danger}
  const byDay = new Map<string, ActivitySeverityRow>()
  for (const r of aktivitasRaw.results ?? []) {
    const row = byDay.get(r.tgl) ?? { tgl: r.tgl, info: 0, warning: 0, danger: 0 }
    if (r.severity === 'warning') row.warning = r.cnt
    else if (r.severity === 'danger') row.danger = r.cnt
    else row.info = r.cnt
    byDay.set(r.tgl, row)
  }

  const gender = { L: 0, P: 0 }
  for (const r of genderRows.results ?? []) {
    if (r.jk === 'P') gender.P = r.c
    else gender.L = r.c
  }

  return {
    generatedAt: new Date().toISOString(),
    aktivitas7h: Array.from(byDay.values()).sort((a, b) => a.tgl.localeCompare(b.tgl)),
    perluPerhatian: perluPerhatian.results ?? [],
    gender,
    domisili: (domisiliRows.results ?? []).map(r => ({ label: r.label, count: r.c })),
    pelanggaran14h: pelanggaranRaw.results ?? [],
    topPelanggaran: (topPelanggaranRows.results ?? []).map(r => ({ nama: r.nama, count: r.c })),
    presensiPegawai: (presensiRows.results ?? []).map(r => ({ status: r.status, count: r.c })),
  }
}

export async function getSuperAdminDashboardStats(): Promise<SuperAdminDashboardStats> {
  const kv = await getKV()

  if (kv) {
    try {
      const cached = await kv.get(SUPERADMIN_STATS_KEY, 'json')
      if (cached) return cached as SuperAdminDashboardStats
    } catch {
      // abaikan error baca cache, fallback ke D1
    }
  }

  const db = await getDB()
  const stats = await computeSuperAdminDashboardStats(db)

  if (kv) {
    try {
      await kv.put(SUPERADMIN_STATS_KEY, JSON.stringify(stats), { expirationTtl: SUPERADMIN_STATS_TTL })
    } catch {
      // abaikan error tulis cache
    }
  }

  return stats
}

