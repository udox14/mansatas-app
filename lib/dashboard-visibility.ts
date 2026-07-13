// lib/dashboard-visibility.ts
// Registry item-item dashboard yang bisa di-show/hide per role + helper.
// Dipakai server (page dashboard & settings) dan client (UI pengaturan).

export type DashItem = { id: string; label: string; desc?: string }
export type DashGroup = { key: string; label: string; items: DashItem[] }

// Item shared yang muncul di banyak dashboard
const SHARED: DashItem[] = [
  { id: 'kehadiran_pribadi', label: 'Kartu Kehadiran Pribadi', desc: 'Presensi pribadi pegawai/guru' },
  { id: 'jadwal_mengajar', label: 'Jadwal Mengajar Hari Ini', desc: 'Daftar jam mengajar hari ini' },
]

// ── Registry: 1 group = 1 dashboard ────────────────────────────────────────
export const DASHBOARD_GROUPS: DashGroup[] = [
  {
    key: 'admin',
    label: 'Super Admin / Admin TU',
    items: [
      ...SHARED,
      { id: 'statistik', label: 'Kartu Statistik', desc: 'Siswa aktif, guru, agenda, delegasi' },
      { id: 'perlu_perhatian', label: 'Seksi Perlu Perhatian', desc: 'Aktivitas sistem & log penting' },
      { id: 'siswa_demografi', label: 'Seksi Siswa & Demografi', desc: 'Gender, angkatan, domisili' },
      { id: 'kehadiran_kedisiplinan', label: 'Seksi Kehadiran & Kedisiplinan', desc: 'Tren pelanggaran, presensi pegawai' },
    ],
  },
  {
    key: 'kepsek',
    label: 'Kepala Madrasah',
    items: [
      ...SHARED,
      { id: 'monitoring_agenda', label: 'Monitoring Agenda', desc: 'Pengisian jurnal hari ini' },
      { id: 'tren_pelanggaran', label: 'Tren Pelanggaran', desc: 'Grafik 7 hari terakhir' },
    ],
  },
  {
    key: 'wakamad',
    label: 'Wakil Kepala Madrasah',
    items: [
      ...SHARED,
      { id: 'rekap_agenda', label: 'Rekap Agenda Guru', desc: 'Status pengisian jurnal hari ini' },
      { id: 'kehadiran_siswa', label: 'Kehadiran Siswa', desc: 'Estimasi hadir & izin hari ini' },
    ],
  },
  {
    key: 'guru_bk',
    label: 'Guru BK',
    items: [
      ...SHARED,
      { id: 'summary_hari_ini', label: 'Ringkasan Hari Ini', desc: 'Siswa bermasalah, izin, belum kembali' },
      { id: 'siswa_prioritas', label: 'Siswa Prioritas', desc: 'Poin pelanggaran tertinggi' },
      { id: 'kasus_terbaru', label: 'Kasus Terbaru', desc: '5 pelanggaran terakhir' },
      { id: 'tren_jenis_pelanggaran', label: 'Jenis Pelanggaran Terbanyak', desc: '30 hari terakhir' },
    ],
  },
  {
    key: 'wali_kelas',
    label: 'Wali Kelas',
    items: [
      { id: 'top_cards', label: 'Kartu Atas', desc: 'Kehadiran pribadi & jadwal mengajar' },
      { id: 'today_summary', label: 'Ringkasan Absensi Hari Ini', desc: 'Hadir, sakit, izin, alfa, dll' },
      { id: 'menu_navigasi', label: 'Menu Navigasi', desc: 'Keputusan, siswa, rekap, perhatian, agenda' },
    ],
  },
  {
    key: 'guru_piket',
    label: 'Guru Piket',
    items: [...SHARED],
  },
  {
    key: 'resepsionis',
    label: 'Resepsionis',
    items: [
      ...SHARED,
      { id: 'live_counter', label: 'Live Counter', desc: 'Siswa di luar & sudah kembali' },
      { id: 'log_perizinan', label: 'Log Perizinan Hari Ini', desc: 'Catatan keluar komplek' },
    ],
  },
  {
    key: 'guru_ppl',
    label: 'Guru PPL',
    items: [
      { id: 'status_praktik', label: 'Status Praktik', desc: 'Ringkasan guru yang disubstitusi' },
      { id: 'menu_cepat', label: 'Menu Cepat', desc: 'Isi agenda & nilai harian' },
    ],
  },
  {
    key: 'bendahara',
    label: 'Bendahara Komite / Pengurus Koperasi',
    items: [
      { id: 'kehadiran_pribadi', label: 'Kartu Kehadiran Pribadi', desc: 'Presensi pribadi pegawai' },
      { id: 'quick_links', label: 'Tautan Cepat', desc: 'DSPT, SPP, Export, Kas, Laporan' },
      { id: 'stat_keuangan', label: 'Kartu Statistik Keuangan', desc: 'Ringkasan DSPT & SPP' },
      { id: 'kas_transaksi', label: 'Kas Keluar & Transaksi Terbaru', desc: 'Kas bulan ini & transaksi' },
    ],
  },
  {
    key: 'guru',
    label: 'Guru Mapel / Guru Tahfidz',
    items: [...SHARED],
  },
]

// Map role → group key dashboard
export function dashboardKeyForRole(role: string): string {
  switch (role) {
    case 'super_admin':
    case 'admin_tu':
      return 'admin'
    case 'kepsek': return 'kepsek'
    case 'wakamad': return 'wakamad'
    case 'guru_bk': return 'guru_bk'
    case 'wali_kelas': return 'wali_kelas'
    case 'guru_piket': return 'guru_piket'
    case 'resepsionis': return 'resepsionis'
    case 'guru_ppl': return 'guru_ppl'
    case 'bendahara_komite':
    case 'pengurus_koperasi':
      return 'bendahara'
    case 'guru':
    case 'guru_tahfidz':
    default:
      return 'guru'
  }
}

export const DASHBOARD_VISIBILITY_KEY = 'dashboard_item_visibility'

export type VisibilityMap = Record<string, Record<string, boolean>>

export function parseVisibility(raw: string | null | undefined): VisibilityMap {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as VisibilityMap
  } catch {
    return {}
  }
}

// Item dianggap tampil kecuali eksplisit di-set false
export function isVisible(vis: Record<string, boolean> | undefined, itemId: string): boolean {
  return vis?.[itemId] !== false
}
