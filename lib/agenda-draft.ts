export const AGENDA_DRAFT_RESTORED_EVENT = 'mansatas-agenda-draft-restored'
const PREFIX = 'mansatas-agenda-draft-v1:'
const PENDING_CAMERA = 'mansatas-agenda-camera-pending'
const TTL = 24 * 60 * 60 * 1000

export type AgendaDraft = {
  penugasanId: string
  materi: string
  updatedAt: number
  photoDataUrl?: string
  photoName?: string
  nativePhoto?: { webPath: string; format?: string }
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
export function restoreAgendaCamera(photo: { webPath?: string; format?: string }): string | null {
  const raw = localStorage.getItem(PENDING_CAMERA)
  if (!raw || !photo.webPath) return null
  const pending = JSON.parse(raw) as { key: string; at: number; route: string }
  if (!pending.key.startsWith(PREFIX) || !Number.isFinite(pending.at) || Date.now() - pending.at > TTL ||
    !/^\/dashboard\/agenda(?:\?|$)/.test(pending.route)) return null
  const draft = readAgendaDraft(pending.key)
  if (!draft) return null
  saveAgendaDraft(pending.key, { ...draft, nativePhoto: { webPath: photo.webPath, format: photo.format }, updatedAt: Date.now() })
  finishAgendaCamera(pending.key)
  return pending.route
}

export async function photoToFile(photo: { webPath?: string; format?: string }): Promise<File> {
  if (!photo.webPath) throw new Error('Lokasi foto tidak tersedia. Materi tetap disimpan; ambil ulang foto.')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  let blob: Blob
  try {
    const response = await fetch(photo.webPath, { signal: controller.signal })
    if (!response.ok) throw new Error('Foto dari kamera tidak dapat dibaca. Materi tetap disimpan; ambil ulang foto.')
    blob = await response.blob()
  } catch {
    throw new Error(controller.signal.aborted ? 'Pembacaan foto melewati 20 detik. Materi tetap disimpan; ambil ulang foto.' : 'Foto dari kamera tidak dapat dibaca. Materi tetap disimpan; ambil ulang foto.')
  } finally { clearTimeout(timer) }
  if (!blob.size) throw new Error('Foto dari kamera kosong. Materi tetap disimpan; ambil ulang foto.')
  const ext = photo.format === 'png' ? 'png' : 'jpg'
  return new File([blob], `agenda_${Date.now()}.${ext}`, { type: blob.type || (ext === 'png' ? 'image/png' : 'image/jpeg') })
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
