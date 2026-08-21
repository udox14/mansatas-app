import { saveKomiteDraftAction } from '@/app/dashboard/komite/pengajuan/actions'
import { internalErrorJson, noStoreJson, rejectCrossSiteMutation } from '@/lib/request-security'

const MAX_REQUEST_BYTES = 6 * 1024 * 1024
const MAX_FILES = 10

export async function POST(request: Request) {
  const originError = rejectCrossSiteMutation(request)
  if (originError) return originError
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data')) {
    return noStoreJson({ error: 'Content-Type upload tidak valid.' }, { status: 415 })
  }
  const declaredLength = Number(request.headers.get('content-length') || 0)
  if (declaredLength > MAX_REQUEST_BYTES) return noStoreJson({ error: 'Ukuran request maksimal 6 MB.' }, { status: 413 })

  try {
    const bytes = await request.arrayBuffer()
    if (bytes.byteLength > MAX_REQUEST_BYTES) return noStoreJson({ error: 'Ukuran request maksimal 6 MB.' }, { status: 413 })
    const replay = new Request(request.url, { method: 'POST', headers: request.headers, body: bytes })
    const formData = await replay.formData()
    const files = formData.getAll('files').filter((entry): entry is File => entry instanceof File && entry.size > 0)
    if (files.length > MAX_FILES) return noStoreJson({ error: `Maksimal ${MAX_FILES} file PDF.` }, { status: 400 })
    const result = await saveKomiteDraftAction(formData)
    return noStoreJson(result, { status: result.error ? 400 : 200 })
  } catch (error) {
    return internalErrorJson('komite.upload_draft', error)
  }
}
