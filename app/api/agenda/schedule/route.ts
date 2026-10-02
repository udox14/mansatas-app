import { getJadwalGuruHariIni } from '@/app/dashboard/agenda/actions'
import { ActionAccessError } from '@/lib/action-security'
import { internalErrorJson, noStoreJson } from '@/lib/request-security'

export async function GET(request: Request) {
  try {
    const date = new URL(request.url).searchParams.get('date') || undefined
    const result = await getJadwalGuruHariIni(undefined, date)
    return noStoreJson(result, { status: result.error === 'Unauthorized' ? 401 : result.error ? 400 : 200 })
  } catch (error) {
    if (error instanceof ActionAccessError) return noStoreJson({ error: error.message }, { status: error.code === 'UNAUTHENTICATED' ? 401 : 403 })
    return internalErrorJson('agenda_schedule_failed', error)
  }
}
