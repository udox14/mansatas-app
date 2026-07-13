'use client'

import { useMemo, useState, useTransition } from 'react'
import { BellRing, Ellipsis, MessageCircle, PhoneCall, TriangleAlert } from 'lucide-react'
import { cancelLatestParentSummonFromKelasBinaan, createParentSummonFromKelasBinaan } from '@/app/dashboard/kelas-binaan/actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

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
  const [showActionsModal, setShowActionsModal] = useState(false)
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
    setShowActionsModal(false)
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <>
      <Dialog open={showActionsModal} onOpenChange={setShowActionsModal}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className={compact ? 'h-7 px-2.5 text-[10px]' : 'w-full'}>
            <Ellipsis className="h-4 w-4" /> Tindakan
          </Button>
        </DialogTrigger>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm gap-3 rounded-lg p-4">
          <DialogHeader>
            <DialogTitle className="text-base">Tindakan Wali Kelas</DialogTitle>
            <DialogDescription className="text-xs">Pilih tindak lanjut untuk {namaSiswa}.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            {wa ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto justify-start whitespace-normal px-3 py-3 text-left"
                  onClick={() => openWa(`https://wa.me/${wa}?text=${encodeURIComponent(templates.warning)}`)}
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>
                    <span className="block text-xs font-medium">WA Peringatan</span>
                    <span className="block text-[10px] font-normal text-muted-foreground">Kirim pesan tindak lanjut kepada orang tua.</span>
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto justify-start whitespace-normal px-3 py-3 text-left"
                  onClick={() => openWa(`https://wa.me/${wa}?text=${encodeURIComponent(templates.summon)}`)}
                >
                  <PhoneCall className="h-4 w-4" />
                  <span>
                    <span className="block text-xs font-medium">WA Panggilan</span>
                    <span className="block text-[10px] font-normal text-muted-foreground">Kirim undangan hadir ke madrasah.</span>
                  </span>
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
                <TriangleAlert className="h-4 w-4" /> Nomor WhatsApp belum tersedia.
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              className="h-auto justify-start whitespace-normal px-3 py-3 text-left"
              onClick={() => {
                setShowActionsModal(false)
                setShowSummonModal(true)
              }}
            >
              <BellRing className="h-4 w-4" />
              <span>
                <span className="block text-xs font-medium">Buat Pemanggilan</span>
                <span className="block text-[10px] font-normal text-muted-foreground">Catat jadwal pemanggilan orang tua.</span>
              </span>
            </Button>

            {hasActiveSummon ? (
              <Button
                type="button"
                variant="ghost"
                className="justify-start text-xs text-destructive hover:text-destructive"
                onClick={() => {
                  setShowActionsModal(false)
                  setShowCancelModal(true)
                }}
              >
                Batalkan pemanggilan aktif
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {toast ? (
        <div className={`fixed top-4 right-4 z-[80] rounded-md px-3 py-2 text-xs font-semibold shadow ${toast.error ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {toast.text}
        </div>
      ) : null}

      <Dialog open={showSummonModal} onOpenChange={(open) => !isPending && setShowSummonModal(open)}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md gap-4 rounded-lg p-4">
          <DialogHeader>
            <DialogTitle className="text-base">Pemanggilan Orang Tua</DialogTitle>
            <DialogDescription className="text-xs">Lengkapi jadwal pemanggilan untuk {namaSiswa}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor={`summon-date-${siswaId}`} className="text-xs">Tanggal</Label>
                <Input id={`summon-date-${siswaId}`} type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="h-9 text-xs" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`summon-time-${siswaId}`} className="text-xs">Jam</Label>
                <Input id={`summon-time-${siswaId}`} type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} className="h-9 text-xs" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`summon-location-${siswaId}`} className="text-xs">Lokasi</Label>
              <Input id={`summon-location-${siswaId}`} value={location} onChange={(e) => setLocation(e.target.value)} className="h-9 text-xs" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`summon-reason-${siswaId}`} className="text-xs">Alasan</Label>
              <Input id={`summon-reason-${siswaId}`} value={reason} onChange={(e) => setReason(e.target.value)} className="h-9 text-xs" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`summon-note-${siswaId}`} className="text-xs">Catatan</Label>
              <Textarea id={`summon-note-${siswaId}`} value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="text-xs" />
            </div>
          </div>
          <DialogFooter className="flex-row justify-end gap-2">
            <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => setShowSummonModal(false)}>Tutup</Button>
            <Button type="button" size="sm" disabled={isPending} onClick={onSummon}>
              {isPending ? 'Memproses...' : 'Simpan Pemanggilan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCancelModal} onOpenChange={(open) => !isPending && setShowCancelModal(open)}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm gap-4 rounded-lg p-4">
          <DialogHeader>
            <DialogTitle className="text-base">Batalkan Pemanggilan?</DialogTitle>
            <DialogDescription className="text-xs">Pemanggilan terbaru untuk {namaSiswa} akan dibatalkan.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-end gap-2">
            <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => setShowCancelModal(false)}>Tutup</Button>
            <Button type="button" variant="destructive" size="sm" disabled={isPending} onClick={onCancelSummon}>
              {isPending ? 'Memproses...' : 'Ya, Batalkan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
