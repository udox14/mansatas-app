import { revalidatePath } from 'next/cache'
import { importRapbm } from '@/lib/rapbm-service'
import { RapbmAccessError, requireRapbmAccess } from '@/lib/rapbm-access'
import { RAPBM_MAX_BYTES, RapbmValidationError } from '@/lib/rapbm'
import { noStoreJson, rejectCrossSiteMutation } from '@/lib/request-security'

export async function POST(request: Request) {
  const originError=rejectCrossSiteMutation(request)
  if (originError) return originError
  try {
    const context=await requireRapbmAccess('create')
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data')) return noStoreJson({error:'Gunakan unggahan Excel.'},{status:415})
    const maxRequest=RAPBM_MAX_BYTES+64*1024
    if (Number(request.headers.get('content-length') || 0)>maxRequest) return noStoreJson({error:'Ukuran Excel maksimal 6 MB.'},{status:413})
    const bytes=await request.arrayBuffer()
    if (bytes.byteLength>maxRequest) return noStoreJson({error:'Ukuran Excel maksimal 6 MB.'},{status:413})
    const replay=new Request(request.url,{method:'POST',headers:request.headers,body:bytes})
    const form=await replay.formData()
    if (form.getAll('file').length!==1) return noStoreJson({error:'Unggah satu file Excel untuk satu versi RAPBM.'},{status:400})
    const file=form.get('file')
    if (!(file instanceof File)) return noStoreJson({error:'Pilih file RAPBM berformat .xlsx.'},{status:400})
    const result=await importRapbm(file,context)
    revalidatePath('/dashboard/keuangan/rapbm')
    return noStoreJson({...result,success:'Draft RAPBM tersimpan. Periksa rincian dan Catatan Angka sebelum menerbitkan.'})
  } catch(error) {
    if (error instanceof RapbmAccessError) return noStoreJson({error:error.message},{status:error.status})
    if (error instanceof RapbmValidationError) return noStoreJson({error:error.message},{status:400})
    console.error('Impor RAPBM gagal',error)
    return noStoreJson({error:'Impor RAPBM gagal. Periksa file dan coba lagi.'},{status:400})
  }
}
