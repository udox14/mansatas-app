const PREFIX = 'mansatas-attendance-correction-v1:'
export function validAttendanceDraftStatus(value: unknown, nullable = false) {
  return (nullable && value === null) || ['HADIR', 'SAKIT', 'IZIN', 'ALFA'].includes(value as string)
}
export function attendanceDraftKey(userId: string, scope: string) {
  return `${PREFIX}${encodeURIComponent(userId)}:${encodeURIComponent(scope)}`
}
export function readAttendanceDraft(key: string): unknown | null {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  const record = JSON.parse(raw)
  if (record?.version !== 1 || !('changes' in record)) throw new Error('Draft koreksi perangkat tidak dapat dibaca. Jangan hapus penyimpanan sebelum diperiksa.')
  return record.changes
}
export function writeAttendanceDraft(key: string, changes: unknown) {
  try { localStorage.setItem(key, JSON.stringify({ version: 1, changes })) }
  catch { throw new Error('Koreksi belum tersimpan di perangkat. Penyimpanan penuh atau dibatasi; jangan refresh atau tutup halaman.') }
}
export function clearAttendanceDraft(key: string, expected: unknown) {
  // A confirmed response must not erase a newer draft from another tab.
  if (JSON.stringify(readAttendanceDraft(key)) === JSON.stringify(expected)) localStorage.removeItem(key)
}
