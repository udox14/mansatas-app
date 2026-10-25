export const KEDISIPLINAN_TABS = ['riwayat', 'monitoring', 'analitik', 'kamus', 'klarifikasi'] as const

export type KedisiplinanTab = typeof KEDISIPLINAN_TABS[number]

export function resolveKedisiplinanTab(value?: string | null): KedisiplinanTab {
  if (value === 'pelanggar') return 'monitoring'
  return KEDISIPLINAN_TABS.includes(value as KedisiplinanTab) ? value as KedisiplinanTab : 'riwayat'
}

export function resolveLegacyMonitoringTab(value?: string | null): 'monitoring' | 'analitik' {
  return value === 'analitik' ? 'analitik' : 'monitoring'
}
