'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpenText,
  CalendarCheck,
  Camera,
  CaretRight,
  CheckCircle,
  Clock,
  Warning,
  XCircle,
} from '@phosphor-icons/react'
import { todayWIB } from '@/lib/time'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

type Row = {
  jam_ke_mulai: number
  jam_ke_selesai: number
  waktu: string
  mapel: string
  guru: string
  agendaDate: string
  agenda?: {
    materi?: string | null
    foto_url?: string | null
    status?: string | null
  } | null
  isToday?: boolean
  absensi?: {
    status: string
    catatan?: string | null
  } | null
}

const DAY_LABEL: Record<number, string> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
}

export function ScheduleTabs({ jadwalByDay }: { jadwalByDay: Record<number, Row[]> }) {
  const defaultDay = useMemo(() => {
    const jsDay = new Date(`${todayWIB()}T00:00:00`).getDay()
    return String(jsDay === 0 ? 1 : Math.min(jsDay, 6))
  }, [])
  const [active, setActive] = useState(defaultDay)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const rows = jadwalByDay[Number(active)] || []

  useEffect(() => {
    tabRefs.current[active]?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [active])

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'HADIR': return 'Siswa hadir'
      case 'SAKIT': return 'Siswa sakit'
      case 'IZIN': return 'Siswa izin'
      case 'ALFA': return 'Siswa alfa'
      case 'KBM_EXCEPTION': return 'Kegiatan khusus'
      case 'BELUM_ADA_DATA': return 'Belum diinput'
      case 'LIBUR': return 'Libur'
      default: return status
    }
  }

  return (
    <div className="space-y-4">
      <div
        data-tour-id="jadwal-day-tabs"
        className="no-scrollbar flex snap-x gap-1 overflow-x-auto rounded-xl border border-[#D8D4CC] bg-[#F2F0EC] p-1"
      >
        {[1, 2, 3, 4, 5, 6].map((day) => {
          const dayValue = String(day)
          const isActive = active === dayValue
          const isToday = dayValue === defaultDay
          return (
            <button
              key={day}
              ref={(node) => { tabRefs.current[dayValue] = node }}
              type="button"
              onClick={() => setActive(dayValue)}
              className={`relative min-h-11 min-w-[72px] snap-center whitespace-nowrap rounded-lg px-3 text-sm font-semibold outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[#C2522D] ${
                isActive ? 'bg-white text-[#1A1A18] shadow-sm' : 'text-[#6B6B63] hover:text-[#1A1A18]'
              }`}
            >
              {DAY_LABEL[day]}
              {isToday && <span className="absolute inset-x-3 bottom-1 h-0.5 rounded-full bg-[#C2522D]" />}
            </button>
          )
        })}
      </div>

      <div data-tour-id="jadwal-list" className="space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D8D4CC] bg-white px-5 py-10 text-center">
            <CalendarCheck className="mx-auto h-7 w-7 text-[#A7A299]" />
            <p className="mt-2 text-sm font-medium text-[#6B6B63]">Tidak ada jadwal pada hari ini.</p>
          </div>
        ) : rows.map((item, index) => {
          let statusClass = 'border-[#D8D4CC] bg-[#F2F0EC] text-[#6B6B63]'
          let cardClass = 'border-[#D8D4CC] bg-white hover:border-[#BDB7AE] hover:bg-[#FEFDFB]'
          let StatusIcon = Clock

          if (item.isToday && item.absensi) {
            switch (item.absensi.status) {
              case 'HADIR':
                statusClass = 'border-[#BFD7C8] bg-[#EEF7F1] text-[#246142]'
                StatusIcon = CheckCircle
                break
              case 'SAKIT':
                statusClass = 'border-[#E5CFA7] bg-[#FFF7E8] text-[#8A5B16]'
                cardClass = 'border-[#DEC394] bg-[#FFF8E8] shadow-[inset_4px_0_0_#B97820] hover:border-[#CBA969]'
                StatusIcon = Warning
                break
              case 'IZIN':
                statusClass = 'border-[#B8C9CD] bg-[#F1F7F7] text-[#3F6F72]'
                cardClass = 'border-[#B8C9CD] bg-[#F1F7F7] shadow-[inset_4px_0_0_#487A7C] hover:border-[#91ACB1]'
                StatusIcon = Warning
                break
              case 'ALFA':
                statusClass = 'border-[#E5B9B3] bg-[#FFF1EF] text-[#A63D32]'
                cardClass = 'border-[#D79B92] bg-[#FFF1EF] shadow-[inset_4px_0_0_#C2522D] hover:border-[#C9786D]'
                StatusIcon = XCircle
                break
              case 'KBM_EXCEPTION':
              case 'LIBUR':
                statusClass = 'border-[#C9CDD4] bg-[#F1F3F5] text-[#535A63]'
                StatusIcon = CalendarCheck
                break
            }
          }

          const jamLabel = item.jam_ke_mulai === item.jam_ke_selesai
            ? `Jam ke-${item.jam_ke_mulai}`
            : `Jam ke-${item.jam_ke_mulai}-${item.jam_ke_selesai}`

          return (
            <Dialog key={`${active}-${index}`}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className={`group w-full rounded-2xl border p-4 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[#C2522D] focus-visible:ring-offset-2 ${cardClass}`}
                >
                  <div className="flex min-w-0 items-center justify-between gap-3 border-b border-[#E8E5E0] pb-3">
                    <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-[#6B6B63]">
                      <span className="shrink-0 whitespace-nowrap rounded-md bg-[#F2F0EC] px-2 py-1 text-[#1A1A18]">{jamLabel}</span>
                      <span className="shrink-0 whitespace-nowrap">{item.waktu}</span>
                    </div>
                    <CaretRight className="h-4 w-4 shrink-0 text-[#A7A299] transition-transform duration-150 group-hover:translate-x-0.5" />
                  </div>

                  <div className="min-w-0 pt-3">
                    <h3 className="line-clamp-2 text-base font-semibold leading-snug text-[#1A1A18]">{item.mapel}</h3>
                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-[#6B6B63]">{item.guru}</p>

                    <div className="mt-3 flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                      {item.isToday && item.absensi && (
                        <span className={`inline-flex max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
                          <StatusIcon className="h-3.5 w-3.5 shrink-0" />
                          {getStatusLabel(item.absensi.status)}
                        </span>
                      )}
                      {item.agenda?.foto_url && (
                        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-[#F2F0EC] px-2.5 py-1 text-xs font-semibold text-[#6B6B63]">
                          <Camera className="h-3.5 w-3.5" /> Foto kegiatan
                        </span>
                      )}
                    </div>
                    {item.isToday && item.absensi?.catatan && (
                      <p className="mt-3 border-l-2 border-[#D8D4CC] pl-3 text-xs leading-5 text-[#6B6B63]">{item.absensi.catatan}</p>
                    )}
                  </div>
                </button>
              </DialogTrigger>

              <DialogContent className="portal-dialog max-h-[92dvh] overflow-y-auto rounded-2xl border border-[#D8D4CC] bg-[#FAF9F7] p-0 text-[#1A1A18] sm:max-w-xl">
                <DialogHeader className="border-b border-[#D8D4CC] px-5 py-4 text-left">
                  <DialogTitle className="line-clamp-2 text-lg font-medium tracking-[-0.02em] text-[#1A1A18]">{item.mapel}</DialogTitle>
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-[#6B6B63]">
                    <span className="whitespace-nowrap">{jamLabel}</span>
                    <span className="whitespace-nowrap">{item.waktu}</span>
                    <span className="line-clamp-1">{item.guru}</span>
                  </div>
                </DialogHeader>
                <div className="space-y-4 p-5">
                  {item.agenda?.foto_url ? (
                    <img src={item.agenda.foto_url} alt={`Kegiatan ${item.mapel}`} className="max-h-[62dvh] w-full rounded-xl bg-[#F2F0EC] object-contain" />
                  ) : (
                    <div className="grid min-h-44 place-items-center rounded-xl border border-dashed border-[#D8D4CC] bg-[#F2F0EC] px-6 text-center">
                      <div>
                        <Camera className="mx-auto h-7 w-7 text-[#A7A299]" />
                        <p className="mt-2 text-sm font-semibold text-[#1A1A18]">Foto kegiatan belum tersedia</p>
                        <p className="mt-1 text-xs leading-5 text-[#6B6B63]">Foto akan muncul setelah guru mengisi agenda pada {item.agendaDate}.</p>
                      </div>
                    </div>
                  )}
                  {item.agenda?.materi && (
                    <div className="flex items-start gap-3 rounded-xl border border-[#D8D4CC] bg-white p-4">
                      <BookOpenText className="mt-0.5 h-4 w-4 shrink-0 text-[#C2522D]" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#C2522D]">Materi pembelajaran</p>
                        <p className="mt-1 text-sm leading-6 text-[#1A1A18]">{item.agenda.materi}</p>
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )
        })}
      </div>
    </div>
  )
}
