import { getDB } from '@/utils/db-server'
import { getPbData } from '@/lib/pramubakti-db'
import { summarizePb } from '@/lib/pramubakti'
import { todayWIB } from '@/lib/time'
import { PramubaktiCardClient } from './PramubaktiCardClient'

export async function PramubaktiCard({ userId }: { userId: string }) {
  const today = todayWIB()
  const month = today.slice(0, 7)
  const monthStart = `${month}-01`
  const data = await getPbData(await getDB(), monthStart, today, userId)
  const summary = summarizePb(data.items)
  const slots = data.items.filter(i => i.tanggal === today && i.slot && i.status !== 'TAMBAHAN')
  const done = slots.filter(i => i.report || i.leave).length

  const monthLabel = new Date(`${monthStart}T00:00:00`).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  })

  const subtitle = slots.length > 0
    ? `${monthLabel} sampai hari ini · ${done}/${slots.length} tugas hari ini selesai`
    : `${monthLabel} sampai hari ini`

  return (
    <PramubaktiCardClient
      monthLabel={monthLabel}
      subtitle={subtitle}
      summary={summary}
      items={data.items}
    />
  )
}
