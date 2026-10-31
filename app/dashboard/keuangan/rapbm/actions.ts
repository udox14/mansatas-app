'use server'

import { revalidatePath } from 'next/cache'
import initialSource from '@/data/rapbm-2026-source.json'
import { importRapbm, publishRapbm } from '@/lib/rapbm-service'
import { RapbmAccessError, requireRapbmAccess } from '@/lib/rapbm-access'
import { RapbmValidationError, type RapbmActionResult } from '@/lib/rapbm'

function failure(error: unknown): RapbmActionResult {
  if (error instanceof RapbmAccessError || error instanceof RapbmValidationError) return {error:error.message}
  console.error('Penyimpanan RAPBM gagal',error)
  return {error:'RAPBM belum dapat disimpan. Muat ulang halaman dan periksa apakah draft atau penerbitan sudah tersimpan sebelum mencoba lagi.'}
}

export async function importRapbmAction(formData: FormData): Promise<RapbmActionResult> {
  try {
    const context=await requireRapbmAccess('create')
    const file=formData.get('file')
    if (!(file instanceof File)) throw new RapbmValidationError('Pilih file RAPBM berformat .xlsx.')
    const result=await importRapbm(file,context)
    revalidatePath('/dashboard/keuangan/rapbm')
    return {...result,success:'Draft RAPBM tersimpan. Periksa rincian dan Catatan Angka sebelum menerbitkan.'}
  } catch(error) { return failure(error) }
}

export async function importInitialRapbmAction(): Promise<RapbmActionResult> {
  try {
    const context=await requireRapbmAccess('create')
    const bytes=Uint8Array.from(atob(initialSource.base64),char=>char.charCodeAt(0))
    const result=await importRapbm(new File([bytes],initialSource.filename,{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),context)
    revalidatePath('/dashboard/keuangan/rapbm')
    return {...result,success:'Draft RAPBM 2026 siap diperiksa.'}
  } catch(error) { return failure(error) }
}

export async function publishRapbmAction(id: string, revision: number, acknowledged: boolean): Promise<RapbmActionResult> {
  try {
    const context=await requireRapbmAccess('update')
    const result=await publishRapbm(id,revision,acknowledged,context)
    revalidatePath('/dashboard/keuangan/rapbm')
    return {...result,success:'RAPBM berhasil diterbitkan. Versi sebelumnya tetap tersedia sebagai arsip.'}
  } catch(error) { return failure(error) }
}
