export const IMPORT_MAX_ROWS = 500
export const IMPORT_MAX_BYTES = 1024 * 1024

export function isImportChunkWithinLimits(value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || value.length > IMPORT_MAX_ROWS) return false
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength <= IMPORT_MAX_BYTES
  } catch {
    return false
  }
}
