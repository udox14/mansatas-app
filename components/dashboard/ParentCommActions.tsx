'use client'

import { useMemo, useState, useTransition } from 'react'
import { BellRing, MessageCircle, PhoneCall } from 'lucide-react'
import { cancelLatestParentSummonFromKelasBinaan, createParentSummonFromKelasBinaan } from '@/app/dashboard/kelas-binaan/actions'

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
  summonStatus?: string | null
  phone?: string | null
  compact?: boolean
}

export function ParentCommActions({ siswaId, kelasId, namaKelas, namaSiswa, summonStatus = null, phone, compact = false }: Props) {
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null)
  const [showSummonModal, setShowSummonModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [eventDate, setEventDate] = useState('')
  const [eventTime, setEventTime] = useState('')
  const [location, setLocation] = useState('Ruang BK / Wali Kelas')
  const [reason, setReason] = useState('Pemanggilan orang tua oleh wali kelas')
  const [note, setNote] = useState('Mohon hadir untuk koordinasi perkembangan akademik/kedisiplinan siswa.')
  const wa = normalizeWa(phone)
  const hasActiveSummon = ['terkirim', 'reschedule_diminta', 'dikonfirmasi'].includes(String(summonStatus || ''))

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
      fd.set('reason', reason)
      fd.set('note', note)
      if (eventDate) fd.set('event_date', eventDate)
      if (eventTime) fd.set('event_time', eventTime)
      if (location) fd.set('location', location)
      const res = await createParentSummonFromKelasBinaan(fd)
      if ((res as any).error) setToast({ text: (res as any).error, error: true })
      else {
        setToast({ text: (res as any).success || 'Pemanggilan berhasil dibuat.' })
        setShowSummonModal(false)
      }
      setTimeout(() => setToast(null), 2200)
    })
  }

  const onCancelSummon = () => {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('siswa_id', siswaId)
      fd.set('kelas_id', kelasId)
      fd.set('note', 'Pemanggilan dibatalkan oleh wali kelas.')
      const res = await cancelLatestParentSummonFromKelasBinaan(fd)
      if ((res as any).error) setToast({ text: (res as any).error, error: true })
      else {
        setToast({ text: (res as any).success || 'Pemanggilan dibatalkan.' })
        setShowCancelModal(false)
      }
      setTimeout(() => setToast(null), 2200)
    })
  }

  const openWa = (url: string) => {
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer')
  }

  const btnCls = compact
    ? 'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold'
    : 'inline-flex min-h-9 w-full items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-bold transition-colors'

  const actionGridCls = compact
    ? 'flex flex-wrap gap-1.5 items-center'
    : `grid w-full gap-1.5 ${hasActiveSummon ? 'grid-cols-2' : wa ? 'grid-cols-3' : 'grid-cols-2'}`

  return (
    <>
      <div className={actionGridCls} onClick={(e) => e.stopPropagation()}>
        {wa ? (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                openWa(`https://wa.me/${wa}?text=${encodeURIComponent(templates.warning)}`)
              }}
              className={`${btnCls} border-emerald-200 bg-emerald-50 text-emerald-700`}
            >
              <MessageCircle className="h-3 w-3" /> WA Peringatan
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                openWa(`https://wa.me/${wa}?text=${encodeURIComponent(templates.summon)}`)
              }}
              className={`${btnCls} border-blue-200 bg-blue-50 text-blue-700`}
            >
              <PhoneCall className="h-3 w-3" /> WA Panggilan
            </button>
          </>
        ) : (
          <span className="text-[10px] text-slate-400">No WA belum ada</span>
        )}
        <button
          type="button"
          disabled={isPending}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setShowSummonModal(true)
          }}
          className={`${btnCls} border-amber-200 bg-amber-50 text-amber-700 disabled:opacity-60`}
        >
          <BellRing className="h-3 w-3" /> {isPending ? 'Memproses...' : 'Pemanggilan'}
        </button>
        {hasActiveSummon ? (
          <button
            type="button"
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowCancelModal(true)
            }}
            className={`${btnCls} border-rose-200 bg-rose-50 text-rose-700 disabled:opacity-60`}
          >
            Batalkan
          </button>
        ) : null}
      </div>

      {toast ? (
        <div className={`fixed top-4 right-4 z-[80] rounded-md px-3 py-2 text-xs font-semibold shadow ${toast.error ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {toast.text}
        </div>
      ) : null}

      {showSummonModal ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={() => !isPending && setShowSummonModal(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold text-slate-800">Pemanggilan Orang Tua</p>
            <p className="mt-1 text-xs text-slate-500">{namaSiswa}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-600">Tanggal</label>
                <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="mt-1 w-full rounded-md border px-2 py-1.5 text-xs" />
              </div>
              <div>
                <label className="text-[11px] text-slate-600">Jam</label>
                <input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} className="mt-1 w-full rounded-md border px-2 py-1.5 text-xs" />
              </div>
            </div>
            <div className="mt-2">
              <label className="text-[11px] text-slate-600">Lokasi</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1 w-full rounded-md border px-2 py-1.5 text-xs" />
            </div>
            <div className="mt-2">
              <label className="text-[11px] text-slate-600">Alasan</label>
              <input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-md border px-2 py-1.5 text-xs" />
            </div>
            <div className="mt-2">
              <label className="text-[11px] text-slate-600">Catatan</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="mt-1 w-full rounded-md border px-2 py-1.5 text-xs" />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" disabled={isPending} onClick={() => setShowSummonModal(false)} className="rounded-md border px-3 py-1.5 text-xs">Tutup</button>
              <button type="button" disabled={isPending} onClick={onSummon} className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                {isPending ? 'Memproses...' : 'Kirim Pemanggilan'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCancelModal ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={() => !isPending && setShowCancelModal(false)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold text-slate-800">Batalkan Pemanggilan?</p>
            <p className="mt-1 text-xs text-slate-500">Status pemanggilan terbaru untuk {namaSiswa} akan diubah menjadi dibatalkan.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" disabled={isPending} onClick={() => setShowCancelModal(false)} className="rounded-md border px-3 py-1.5 text-xs">Tutup</button>
              <button type="button" disabled={isPending} onClick={onCancelSummon} className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                {isPending ? 'Memproses...' : 'Ya, Batalkan'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
