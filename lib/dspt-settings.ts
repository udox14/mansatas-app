import { getSystemSettings } from '@/lib/system-settings'
import { dsptEntryModeSchema, dsptPackageSchema, type DsptEntryMode, type DsptPackage } from '@/lib/pmb-contract'

export const DSPT_SETTING_KEYS = {
  mode: 'keuangan_dspt_entry_mode', defaultAmount: 'keuangan_dspt_default_amount',
  packages: 'keuangan_dspt_packages', allowOverride: 'keuangan_dspt_allow_cashier_override',
} as const

export async function getDsptSettings(): Promise<{ mode: DsptEntryMode; defaultAmount: number; packages: DsptPackage[]; allowOverride: boolean }> {
  const values = await getSystemSettings({
    [DSPT_SETTING_KEYS.mode]: 'manual', [DSPT_SETTING_KEYS.defaultAmount]: '0',
    [DSPT_SETTING_KEYS.packages]: '[]', [DSPT_SETTING_KEYS.allowOverride]: '1',
  })
  let packages: DsptPackage[] = []
  try { packages = dsptPackageSchema.array().parse(JSON.parse(values[DSPT_SETTING_KEYS.packages] || '[]')).sort((a, b) => a.sortOrder - b.sortOrder) } catch { /* invalid stored settings become empty */ }
  return {
    mode: dsptEntryModeSchema.catch('manual').parse(values[DSPT_SETTING_KEYS.mode]),
    defaultAmount: Math.max(0, Number(values[DSPT_SETTING_KEYS.defaultAmount]) || 0), packages,
    allowOverride: values[DSPT_SETTING_KEYS.allowOverride] !== '0',
  }
}
