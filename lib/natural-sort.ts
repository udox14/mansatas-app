// Lokasi: lib/natural-sort.ts
// Collator & helper Natural Sort (urutan numerik + alfabet Indonesia).
// Dipakai konsisten di seluruh bagian modul TKA (dropdown, list, tabel).

export const idCollator = new Intl.Collator('id-ID', { numeric: true, sensitivity: 'base' })

/** Urutkan array secara natural (in-place copy baru) berdasarkan key string. */
export function naturalSort<T>(list: T[], key: (item: T) => string): T[] {
  return [...list].sort((a, b) => idCollator.compare(key(a), key(b)))
}
