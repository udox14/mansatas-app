import { submitAgenda } from '@/app/dashboard/agenda/actions'
import { ActionAccessError } from '@/lib/action-security'
import { internalErrorJson, noStoreJson, rejectCrossSiteMutation } from '@/lib/request-security'

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request)
  if (rejected) return rejected
  try {
    const result = await submitAgenda(await request.formData())
    return noStoreJson(result, { status: result.error === 'Unauthorized' ? 401 : result.error ? 400 : 200 })
  } catch (error) {
    if (error instanceof ActionAccessError) {
      return noStoreJson({ error: error.message }, { status: error.code === 'UNAUTHENTICATED' ? 401 : 403 })
    }
    const response = internalErrorJson('agenda_submit_failed', error)
    const body = await response.json() as { correlationId: string }
    return noStoreJson({ error: `Server gagal memproses agenda. Materi dan foto tetap disimpan; coba kirim lagi. Kode laporan: ${body.correlationId}` }, { status: 500 })
  }
}
