// lib/dashboard-widgets-meta.ts
// Metadata widget katalog — AMAN untuk client & server (tanpa komponen/DB).
// Registry komponen ada di lib/dashboard-widgets.tsx (server-only).

export type WidgetProps = {
  userId: string
  taAktif: { id?: string; nama: string; semester: number } | null
  isGuruPiket?: boolean
  userRoles: string[]
  primaryRole: string
  allowedFeatures: string[]
}

export type WidgetMeta = {
  id: string
  label: string
  description?: string
  // feature id (config/menu) yang wajib dimiliki user agar widget tampil.
  // undefined = tampil untuk semua role.
  feature?: string
}

// Katalog widget yang bisa ditambahkan admin ke dashboard manapun.
export const WIDGET_CATALOG_META: WidgetMeta[] = [
  {
    id: 'rekap_kehadiran_guru',
    label: 'Rekap Kehadiran Guru',
    description: 'Pengisian agenda mengajar guru hari ini (lengkap / belum)',
    feature: 'monitoring-agenda',
  },
  {
    id: 'kehadiran_siswa_sekolah',
    label: 'Kehadiran Siswa (Sekolah)',
    description: 'Estimasi hadir & izin tidak masuk se-sekolah hari ini',
    feature: 'rekap-absensi',
  },
  {
    id: 'tren_pelanggaran_sekolah',
    label: 'Tren Pelanggaran (Sekolah)',
    description: 'Grafik pelanggaran siswa 7 hari terakhir',
    feature: 'kedisiplinan',
  },
]

export const DASHBOARD_WIDGETS_CONFIG_KEY = 'dashboard_extra_widgets'

// { [dashboardKey]: orderedWidgetIds[] }
export type WidgetsConfigMap = Record<string, string[]>

export function parseWidgetsConfig(raw: string | null | undefined): WidgetsConfigMap {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: WidgetsConfigMap = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (Array.isArray(v)) out[k] = v.filter(x => typeof x === 'string')
    }
    return out
  } catch {
    return {}
  }
}

export function getWidgetMeta(id: string): WidgetMeta | undefined {
  return WIDGET_CATALOG_META.find(w => w.id === id)
}
