// utils/r2.ts
import { getCloudflareContext } from '@opennextjs/cloudflare'

// ============================================================
// KONSTANTA VALIDASI
// ============================================================
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const MAX_PDF_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

export function validateImageFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `Ukuran file terlalu besar. Maksimal 2MB (saat ini: ${(file.size / 1024 / 1024).toFixed(1)}MB)`
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return `Format file tidak didukung. Gunakan JPG, PNG, atau WebP`
  }
  return null
}

export function validatePdfFile(file: File): string | null {
  if (file.size > MAX_PDF_SIZE) {
    return `Ukuran file terlalu besar. Maksimal 5MB (saat ini: ${(file.size / 1024 / 1024).toFixed(1)}MB)`
  }
  const fileName = file.name.toLowerCase()
  if (file.type !== 'application/pdf' && !fileName.endsWith('.pdf')) {
    return 'Format file tidak didukung. Gunakan PDF'
  }
  return null
}

async function getR2(): Promise<R2Bucket> {
  const { env } = await getCloudflareContext({ async: true })
  return env.R2
}

// Ekstrak R2 key dari URL (mendukung format lama r2.dev dan format baru /api/media/)
function urlToKey(publicUrl: string): string | null {
  const cleanUrl = publicUrl.split('?')[0]

  // Format baru: /api/media/folder/file.jpg
  if (cleanUrl.startsWith('/api/media/')) {
    return cleanUrl.replace('/api/media/', '')
  }
  // Format lama: https://pub-xxx.r2.dev/folder/file.jpg (backward compat)
  const baseUrl = process.env.R2_PUBLIC_URL
  if (baseUrl && cleanUrl.startsWith(baseUrl)) {
    return cleanUrl.replace(`${baseUrl}/`, '')
  }
  return null
}

export async function uploadToR2(
  file: File,
  folder: string,
  customFileName?: string
): Promise<{ url: string | null; error: string | null }> {
  // Validasi wajib sebelum upload
  const validationError = validateImageFile(file)
  if (validationError) return { url: null, error: validationError }

  try {
    const r2 = await getR2()
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const fileName = customFileName
      ? `${folder}/${customFileName}`
      : `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`

    const buffer = await file.arrayBuffer()

    await r2.put(fileName, buffer, {
      httpMetadata: {
        contentType: file.type || 'image/jpeg',
        cacheControl: 'public, max-age=31536000',
      },
    })

    // Gunakan /api/media/ proxy agar foto bisa diakses dari semua perangkat
    const proxyUrl = `/api/media/${fileName}`
    return { url: proxyUrl, error: null }
  } catch (e: any) {
    return { url: null, error: e.message }
  }
}

export async function deleteFromR2(
  publicUrl: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const key = urlToKey(publicUrl)
    if (!key) return { success: true, error: null } // URL tidak dikenali, skip saja
    const r2 = await getR2()
    await r2.delete(key)
    return { success: true, error: null }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// Upload foto siswa — nama file tetap per siswa sehingga otomatis overwrite
// Tidak perlu hapus file lama karena key sama
export async function uploadFotoSiswa(siswaId: string, file: File) {
  const validationError = validateImageFile(file)
  if (validationError) return { url: null, error: validationError }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const fileName = `${siswaId}/foto.${ext}`
  return uploadToR2(file, 'foto_siswa', fileName)
}

// Upload avatar user — nama file tetap per user, otomatis overwrite
export async function uploadAvatar(userId: string, file: File) {
  const validationError = validateImageFile(file)
  if (validationError) return { url: null, error: validationError }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const fileName = `${userId}/avatar.${ext}`
  return uploadToR2(file, 'avatars', fileName)
}

export async function uploadSignature(userId: string, file: File) {
  const validationError = validateImageFile(file)
  if (validationError) return { url: null, error: validationError }

  const fileName = `${userId}/signature.png`
  return uploadToR2(file, 'signatures', fileName)
}

export async function uploadS36Pdf(userId: string, file: File) {
  const validationError = validatePdfFile(file)
  if (validationError) return { url: null, key: null, error: validationError }

  const key = `tpg/s36/${userId}.pdf`
  try {
    const r2 = await getR2()
    await r2.put(key, await file.arrayBuffer(), {
      httpMetadata: {
        contentType: 'application/pdf',
        cacheControl: 'private, max-age=0, must-revalidate',
      },
    })
    return { url: `/api/media/${key}`, key, error: null }
  } catch (e: any) {
    return { url: null, key: null, error: e.message }
  }
}

// Upload bukti foto pelanggaran — nama unik, perlu hapus manual saat delete/edit
export async function uploadBuktiFoto(file: File) {
  const validationError = validateImageFile(file)
  if (validationError) return { url: null, error: validationError }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const fileName = `bukti_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`
  return uploadToR2(file, 'pelanggaran', fileName)
}

// Upload foto presensi — nama file: presensi/{tanggal}/{userId}_{action}.jpg
export async function uploadFotoPresensi(file: File, userId: string, action: string, tanggal: string) {
  const validationError = validateImageFile(file)
  if (validationError) return { url: null, error: validationError }

  const fileName = `${userId}_${action}.jpg`
  const folder = `presensi/${tanggal}`
  return uploadToR2(file, folder, fileName)
}

export function getPresensiPhotoUrl(userId: string, action: string, tanggal: string) {
  return `/api/media/presensi/${tanggal}/${userId}_${action}.jpg`
}

// Upload foto sarpras — nama unik, perlu hapus manual saat delete/edit
export async function uploadFotoSarpras(file: File) {
  const validationError = validateImageFile(file)
  if (validationError) return { url: null, error: validationError }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const fileName = `aset_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`
  return uploadToR2(file, 'sarpras', fileName)
}
