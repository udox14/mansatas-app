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
        className="w-full rounded-lg border border-[#D8D4CC] bg-white px-3 py-2 text-sm text-[#1A1A18] outline-none focus:border-[#C2522D]"
        rows={2}
        disabled={isPending || isFinal}
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending || isFinal}
          onClick={() => onRespond('hadir')}
          className="h-11 whitespace-nowrap rounded-lg bg-[#C2522D] px-3 text-xs font-bold text-white transition-colors hover:bg-[#A8421F] disabled:opacity-60"
        >
          Konfirmasi Hadir
        </button>
        <button
          type="button"
          disabled={isPending || isFinal}
          onClick={() => onRespond('reschedule')}
          className="h-11 whitespace-nowrap rounded-lg border border-[#D8D4CC] bg-white px-3 text-xs font-bold text-[#8A5B16] transition-colors hover:bg-[#FFF7E8] disabled:opacity-60"
        >
          Minta Jadwal Ulang
        </button>
      </div>
      {message ? <p className="text-[11px] text-slate-500">{message}</p> : null}
    </div>
  )
}
