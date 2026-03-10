// Lokasi: utils/r2.ts
import { getCloudflareContext } from '@opennextjs/cloudflare'

async function getR2(): Promise<R2Bucket> {
  const { env } = await getCloudflareContext({ async: true })
  return env.R2
}

export async function uploadToR2(
  file: File,
  folder: string,
  customFileName?: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    const r2 = await getR2()
    const ext = file.name.split('.').pop()
    const fileName = customFileName
      ? `${folder}/${customFileName}`
      : `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`

    const buffer = await file.arrayBuffer()

    await r2.put(fileName, buffer, {
      httpMetadata: {
        contentType: file.type || 'application/octet-stream',
        cacheControl: 'public, max-age=31536000',
      },
    })

    const publicUrl = `${process.env.R2_PUBLIC_URL}/${fileName}`
    return { url: publicUrl, error: null }
  } catch (e: any) {
    return { url: null, error: e.message }
  }
}

export async function deleteFromR2(
  publicUrl: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const r2 = await getR2()
    const baseUrl = process.env.R2_PUBLIC_URL!
    const key = publicUrl.replace(`${baseUrl}/`, '')
    await r2.delete(key)
    return { success: true, error: null }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function uploadFotoSiswa(siswaId: string, file: File) {
  const ext = file.name.split('.').pop()
  // Nama file tetap per siswa — upload ulang otomatis ketimpa
  const fileName = `${siswaId}/foto.${ext}`
  return uploadToR2(file, 'foto_siswa', fileName)
}

export async function uploadAvatar(userId: string, file: File) {
  const ext = file.name.split('.').pop()
  // Nama file tetap per user — upload ulang otomatis ketimpa
  const fileName = `${userId}/avatar.${ext}`
  return uploadToR2(file, 'avatars', fileName)
}

export async function uploadBuktiFoto(file: File) {
  const ext = file.name.split('.').pop()
  const fileName = `bukti_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`
  return uploadToR2(file, 'pelanggaran', fileName)
}