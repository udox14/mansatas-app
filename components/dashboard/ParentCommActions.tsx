'use client'

import { useMemo, useState, useTransition } from 'react'
import { BellRing, MessageCircle, PhoneCall } from 'lucide-react'
import { createParentSummonFromKelasBinaan } from '@/app/dashboard/kelas-binaan/actions'

function normalizeWa(raw: string | null | undefined) {
  const digits = String(raw || '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  return digits
}

type Props = {
  siswaId: string
  kelasId: string
  namaKelas: string
  namaSiswa: string
  phone?: string | null
  compact?: boolean
}

export function ParentCommActions({ siswaId, kelasId, namaKelas, namaSiswa, phone, compact = false }: Props) {
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null)
  const wa = normalizeWa(phone)

  const templates = useMemo(() => {
    return {
      warning: `Assalamu'alaikum Bapak/Ibu, kami dari wali kelas ${namaKelas}. Menyampaikan informasi perkembangan ananda ${namaSiswa}. Mohon kerja samanya untuk tindak lanjut.`,
      summon: `Assalamu'alaikum Bapak/Ibu, kami mengundang untuk hadir ke madrasah terkait pembinaan ananda ${namaSiswa}. Mohon konfirmasi kehadiran.`,
    }
  }, [namaKelas, namaSiswa])

  const onSummon = () => {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('siswa_id', siswaId)
      fd.set('kelas_id', kelasId)
      fd.set('reason', 'Pemanggilan orang tua oleh wali kelas')
      fd.set('note', 'Mohon hadir untuk koordinasi perkembangan akademik/kedisiplinan siswa.')
      const res = await createParentSummonFromKelasBinaan(fd)
      if ((res as any).error) setToast({ text: (res as any).error, error: true })
      else setToast({ text: (res as any).success || 'Pemanggilan berhasil dibuat.' })
      setTimeout(() => setToast(null), 2200)
    })
  }

  const btnCls = compact
    ? 'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold'
    : 'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold'

  return (
    <>
      <div className="flex flex-wrap gap-1.5 items-center" onClick={(e) => e.stopPropagation()}>
        {wa ? (
          <>
            <a
              href={`https://wa.me/${wa}?text=${encodeURIComponent(templates.warning)}`}
              target="_blank"
              className={`${btnCls} border-emerald-200 bg-emerald-50 text-emerald-700`}
            >
              <MessageCircle className="h-3 w-3" /> WA Peringatan
            </a>
            <a
              href={`https://wa.me/${wa}?text=${encodeURIComponent(templates.summon)}`}
              target="_blank"
              className={`${btnCls} border-blue-200 bg-blue-50 text-blue-700`}
            >
              <PhoneCall className="h-3 w-3" /> WA Panggilan
            </a>
          </>
        ) : (
          <span className="text-[10px] text-slate-400">No WA belum ada</span>
        )}
        <button
          type="button"
          disabled={isPending}
          onClick={onSummon}
          className={`${btnCls} border-amber-200 bg-amber-50 text-amber-700 disabled:opacity-60`}
        >
          <BellRing className="h-3 w-3" /> {isPending ? 'Memproses...' : 'Pemanggilan'}
        </button>
      </div>

      {toast ? (
        <div className={`fixed bottom-4 right-4 z-[80] rounded-md px-3 py-2 text-xs font-semibold shadow ${toast.error ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {toast.text}
        </div>
      ) : null}
    </>
  )
}

