export const MAX_ROLE_MOBILE_NAV_ITEMS = 4

export function validateRoleMobileNav(
  value: unknown,
  allowedFeatureIds: readonly string[],
  knownMenuIds: readonly string[],
): string | null {
  if (!Array.isArray(value) || value.some(id => typeof id !== 'string')) {
    return 'Konfigurasi bottom navbar tidak valid.'
  }
  if (value.length > MAX_ROLE_MOBILE_NAV_ITEMS) {
    return `Maksimal ${MAX_ROLE_MOBILE_NAV_ITEMS} menu karena tombol Home selalu tampil di tengah.`
  }
  if (new Set(value).size !== value.length) {
    return 'Menu bottom navbar tidak boleh duplikat.'
  }

  const known = new Set(knownMenuIds)
  const allowed = new Set(allowedFeatureIds)
  if (value.includes('dashboard')) {
    return 'Dashboard tidak perlu dipilih karena tombol Home selalu tampil di tengah.'
  }
  if (value.some(id => !known.has(id))) {
    return 'Ada menu bottom navbar yang tidak dikenal. Muat ulang halaman.'
  }
  if (value.some(id => !allowed.has(id))) {
    return 'Ada menu yang tidak diizinkan untuk role ini. Perbarui akses fitur terlebih dahulu.'
  }
  return null
}

export function moveRoleMobileNavItem(ids: string[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction
  if (index < 0 || index >= ids.length || nextIndex < 0 || nextIndex >= ids.length) return ids
  const result = [...ids]
  ;[result[index], result[nextIndex]] = [result[nextIndex], result[index]]
  return result
}
