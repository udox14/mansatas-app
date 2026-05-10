'use client'

import { useState, useTransition } from 'react'
import { respondParentSummons } from '../actions'

export function SummonResponseForm({ summonId, status }: { summonId: string; status: string }) {
  const [note, setNote] = useState('')
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const onRespond = (response: 'hadir' | 'reschedule') => {
    setMessage(null)
    startTransition(async () => {
      const res = await respondParentSummons({ summonId, response, note })
      if ((res as any).error) setMessage((res as any).error)
      else setMessage('Respon terkirim.')
    })
  }

  const isFinal = status === 'dikonfirmasi' || status === 'selesai'

  return (
    <div className="mt-2 space-y-2">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Catatan untuk wali kelas/BK (opsional)"
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
        rows={2}
        disabled={isPending || isFinal}
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending || isFinal}
          onClick={() => onRespond('hadir')}
          className="h-8 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white disabled:opacity-60"
        >
          Konfirmasi Hadir
        </button>
        <button
          type="button"
          disabled={isPending || isFinal}
          onClick={() => onRespond('reschedule')}
          className="h-8 rounded-md border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-700 disabled:opacity-60"
        >
          Minta Jadwal Ulang
        </button>
      </div>
      {message ? <p className="text-[11px] text-slate-500">{message}</p> : null}
    </div>
  )
}

