export type SignatureSettings = {
  signature_enabled: number
  signature_x_mm: number
  signature_y_mm: number
  signature_width_mm: number
}

export const DEFAULT_KEPALA_SIGNATURE_SETTINGS: SignatureSettings = {
  signature_enabled: 0,
  signature_x_mm: 14,
  signature_y_mm: 12,
  signature_width_mm: 38,
}

function bounded(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === 'number' || (typeof value === 'string' && value.trim()) ? Number(value) : NaN
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback
}

export function normalizeKepalaPrintSettings(settings: Partial<SignatureSettings>): SignatureSettings {
  return {
    signature_enabled: Number(settings.signature_enabled) === 1 ? 1 : 0,
    signature_x_mm: bounded(settings.signature_x_mm, 14, -20, 80),
    signature_y_mm: bounded(settings.signature_y_mm, 12, -20, 80),
    signature_width_mm: bounded(settings.signature_width_mm, 38, 10, 150),
  }
}

export type KepalaPrintParams = { kepalaSignature?: string; kepalaX?: string; kepalaY?: string; kepalaWidth?: string }

export function parseKepalaPrintSettings(params: KepalaPrintParams): SignatureSettings {
  return normalizeKepalaPrintSettings({
    signature_enabled: params.kepalaSignature === '1' ? 1 : 0,
    signature_x_mm: Number(params.kepalaX?.trim() || 14),
    signature_y_mm: Number(params.kepalaY?.trim() || 12),
    signature_width_mm: Number(params.kepalaWidth?.trim() || 38),
  })
}

export function canManageKepalaSignature(roles: string[]) {
  return roles.includes('super_admin') || roles.includes('admin_tu')
}
