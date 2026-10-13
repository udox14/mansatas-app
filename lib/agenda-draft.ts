export const AGENDA_DRAFT_RESTORED_EVENT = 'mansatas-agenda-draft-restored'
const PREFIX = 'mansatas-agenda-draft-v1:'
const PENDING_CAMERA = 'mansatas-agenda-camera-pending'
const TTL = 24 * 60 * 60 * 1000

export type AgendaCameraPhoto = { path?: string; webPath?: string; format?: string }

export type AgendaDraft = {
  penugasanId: string
  materi: string
  updatedAt: number
  photoDataUrl?: string
  photoName?: string
  nativePhoto?: AgendaCameraPhoto
}

export function agendaDraftKey(userId: string, tanggal: string) {
  return `${PREFIX}${userId}:${tanggal}`
}

export function readAgendaDraft(key: string): AgendaDraft | null {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  let draft: AgendaDraft
  try { draft = JSON.parse(raw) as AgendaDraft } catch {
    localStorage.removeItem(key)
    throw new Error('Draft perangkat rusak dan tidak dapat dibaca. Isi materi dan ambil ulang foto sebelum mengirim.')
  }
  if (!draft || !draft.penugasanId || typeof draft.materi !== 'string' || !Number.isFinite(draft.updatedAt) || Date.now() - draft.updatedAt > TTL) {
    localStorage.removeItem(key)
    return null
  }
  return draft
}

export function saveAgendaDraft(key: string, draft: AgendaDraft) {
  try {
    // Hapus draft kedaluwarsa agar foto lama tidak memenuhi penyimpanan perangkat.
    for (const entry of Object.keys(localStorage)) {
      if (!entry.startsWith(PREFIX) || entry === key) continue
      try { readAgendaDraft(entry) } catch { /* draft rusak sudah dibersihkan */ }
    }
    localStorage.setItem(key, JSON.stringify(draft))
  } catch {
    throw new Error('Draft tidak dapat disimpan di perangkat. Penyimpanan mungkin penuh atau dibatasi. Kosongkan ruang penyimpanan lalu coba lagi; jangan tutup halaman ini.')
  }
}

export function clearAgendaDraft(key: string) {
  localStorage.removeItem(key)
  finishAgendaCamera(key)
}

export function beginAgendaCamera(key: string) {
  try {
    localStorage.setItem(PENDING_CAMERA, JSON.stringify({ key, at: Date.now(), route: window.location.pathname + window.location.search }))
  } catch { throw new Error('Pemulihan kamera gagal disiapkan karena penyimpanan perangkat tidak tersedia. Kosongkan ruang penyimpanan lalu coba lagi.') }
}

export function finishAgendaCamera(key: string) {
  const pending = localStorage.getItem(PENDING_CAMERA)
  if (pending && JSON.parse(pending).key === key) localStorage.removeItem(PENDING_CAMERA)
}

// Listener global diperlukan karena Android dapat kembali ke halaman awal setelah
// proses aplikasi dihentikan saat Activity kamera masih berjalan.
export function saveAgendaCameraPhoto(key: string, photo: AgendaCameraPhoto) {
  if (!photo.path && !photo.webPath) throw new Error('Lokasi foto tidak tersedia. Materi tetap disimpan; ambil ulang foto.')
  const draft = readAgendaDraft(key)
  if (!draft) throw new Error('Draft materi tidak tersedia. Isi materi dan ambil ulang foto.')
  // Simpan URI sebelum pembacaan/kompresi agar pemuatan ulang tidak kehilangan foto.
  saveAgendaDraft(key, { ...draft, photoDataUrl: undefined, photoName: undefined,
    nativePhoto: { path: photo.path, webPath: photo.webPath, format: photo.format }, updatedAt: Date.now() })
}

export function restoreAgendaCamera(photo: AgendaCameraPhoto): string | null {
  const raw = localStorage.getItem(PENDING_CAMERA)
  if (!raw || (!photo.path && !photo.webPath)) return null
  const pending = JSON.parse(raw) as { key: string; at: number; route: string }
  if (!pending.key.startsWith(PREFIX) || !Number.isFinite(pending.at) || Date.now() - pending.at > TTL ||
    !/^\/dashboard\/agenda(?:\?|$)/.test(pending.route)) return null
  const draft = readAgendaDraft(pending.key)
  if (!draft) return null
  saveAgendaCameraPhoto(pending.key, photo)
  finishAgendaCamera(pending.key)
  return pending.route
}

export async function photoToFile(photo: AgendaCameraPhoto): Promise<File> {
  if (!photo.path && !photo.webPath) throw new Error('Lokasi foto tidak tersedia. Materi tetap disimpan; ambil ulang foto.')
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let blob: Blob
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('timeout')) }, 20_000)
    })
    blob = await Promise.race([readCameraPhoto(photo, controller.signal), timeout])
  } catch {
    throw new Error(controller.signal.aborted ? 'Pembacaan foto melewati 20 detik. Materi tetap disimpan; ambil ulang foto.' : 'Foto dari kamera tidak dapat dibaca. Materi tetap disimpan; ambil ulang foto.')
  } finally { clearTimeout(timer) }
  if (!blob.size) throw new Error('Foto dari kamera kosong. Materi tetap disimpan; ambil ulang foto.')
  const ext = photo.format === 'png' ? 'png' : 'jpg'
  return new File([blob], `agenda_${Date.now()}.${ext}`, { type: blob.type || (ext === 'png' ? 'image/png' : 'image/jpeg') })
}

async function readCameraPhoto(photo: AgendaCameraPhoto, signal: AbortSignal): Promise<Blob> {
  const { Capacitor } = await import('@capacitor/core')
  signal.throwIfAborted()
  if (Capacitor.isNativePlatform()) {
    // Draft lama hanya menyimpan webPath. Pulihkan URI lokalnya tanpa request
    // HTTP yang bisa dicegat service worker dan dikirim ke server remote.
    const legacyPath = photo.webPath?.match(/\/_capacitor_file_(\/[^?#]*)/)?.[1]
    const path = photo.path || (legacyPath ? `file://${decodeURIComponent(legacyPath)}` : undefined)
    if (path) {
      const { Filesystem } = await import('@capacitor/filesystem')
      signal.throwIfAborted()
      const { data } = await Filesystem.readFile({ path })
      if (typeof data !== 'string') return data
      const bytes = Uint8Array.from(atob(data), char => char.charCodeAt(0))
      return new Blob([bytes], { type: photo.format === 'png' ? 'image/png' : 'image/jpeg' })
    }
  }
  if (!photo.webPath) throw new Error('Lokasi foto tidak tersedia')
  const response = await fetch(photo.webPath, { signal })
  if (!response.ok) throw new Error('Foto dari kamera tidak dapat dibaca')
  return response.blob()
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    const timer = setTimeout(() => {
      reader.abort()
      reject(new Error('Penyimpanan draft foto terlalu lama. Materi tetap disimpan; ambil ulang foto.'))
    }, 10_000)
    reader.onload = () => { clearTimeout(timer); resolve(String(reader.result)) }
    reader.onerror = () => { clearTimeout(timer); reject(new Error('Foto gagal disimpan sebagai draft. Ambil ulang foto sebelum mengirim.')) }
    try { reader.readAsDataURL(file) } catch {
      clearTimeout(timer)
      reject(new Error('Foto gagal dibaca untuk menyimpan draft. Ambil ulang foto sebelum mengirim.'))
    }
  })
}

export async function draftPhotoFile(draft: AgendaDraft): Promise<File | null> {
  if (draft.photoDataUrl) {
    const blob = await (await fetch(draft.photoDataUrl)).blob()
    return new File([blob], draft.photoName || 'agenda.webp', { type: blob.type })
  }
  return draft.nativePhoto ? photoToFile(draft.nativePhoto) : null
}
