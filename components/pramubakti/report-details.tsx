/* eslint-disable @next/next/no-img-element -- Evidence uses authenticated media URLs and explicit lazy loading. */
'use client'

import { useState } from 'react'
import type { PbItem } from '@/lib/pramubakti'
import {
  CheckCircle2, Clock, XCircle, AlertTriangle, ShieldCheck,
  PlusCircle, Edit3, MapPin, Eye, ChevronDown, ChevronUp
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export const PB_STATUS_STYLE: Record<string, { bg: string; text: string; icon: any; label: string }> = {
  TEPAT_WAKTU: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-700 dark:text-emerald-400',
    icon: CheckCircle2,
    label: 'Tepat Waktu'
  },
  TELAT: {
    bg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-400',
    icon: Clock,
    label: 'Telat'
  },
  ALFA: {
    bg: 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-400',
    icon: XCircle,
    label: 'Alfa'
  },
  SAKIT: {
    bg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-400',
    icon: AlertTriangle,
    label: 'Sakit'
  },
  IZIN: {
    bg: 'bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800',
    text: 'text-sky-700 dark:text-sky-400',
    icon: AlertTriangle,
    label: 'Izin'
  },
  IZIN_SEKOLAH: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-700 dark:text-emerald-400',
    icon: ShieldCheck,
    label: 'Izin Sekolah'
  },
  BELUM: {
    bg: 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700',
    text: 'text-slate-600 dark:text-slate-400',
    icon: Clock,
    label: 'Belum Selesai'
  },
  TAMBAHAN: {
    bg: 'bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800',
    text: 'text-purple-700 dark:text-purple-400',
    icon: PlusCircle,
    label: 'Tambahan'
  },
}

export function PbStatus({ item }: { item: PbItem }) {
  const isSekolah = item.status === 'IZIN' && Boolean(item.leave?.kepentingan_sekolah)
  const styleKey = isSekolah ? 'IZIN_SEKOLAH' : item.status
  const s = PB_STATUS_STYLE[styleKey] || PB_STATUS_STYLE.ALFA
  const Icon = s.icon

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full border font-medium ${s.bg} ${s.text}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {isSekolah ? 'Izin (Dinas Sekolah)' : s.label}
    </span>
  )
}

export function PbDetails({
  items,
  onCorrect
}: {
  items: PbItem[]
  onCorrect?: (item: PbItem) => void
}) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string } | null>(null)

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-8 text-center">
        <Clock className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Tidak ada data pada periode ini.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map(item => {
        const isExpanded = expandedKeys.has(item.key)

        return (
          <div
            key={item.key}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm transition-all"
          >
            {/* Header Row */}
            <div
              onClick={() => toggleExpand(item.key)}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 sm:p-4 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40 select-none transition-colors"
            >
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
                <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                  {item.nama_lengkap}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  &middot; {item.tanggal}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                  <Clock className="h-3 w-3 text-slate-400" />
                  {item.slot ? `${item.slot.start}–${item.slot.end} WIB` : 'Laporan Tambahan'}
                </span>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <PbStatus item={item} />
                <button
                  type="button"
                  aria-label="Toggle details"
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                >
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Expandable Details Section */}
            {isExpanded && (
              <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-4 space-y-3.5 text-sm animate-in fade-in-50 duration-200">
                {item.leave && (
                  <div className="p-3 rounded-lg border border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/30 text-sky-800 dark:text-sky-300">
                    <p className="font-semibold text-xs uppercase tracking-wide">
                      {item.leave.reason_name || item.leave.status}
                      {item.leave.kepentingan_sekolah && ' (Kepentingan Dinas Madrasah)'}
                    </p>
                    <p className="mt-1 text-sm">{item.leave.note}</p>
                  </div>
                )}

                {item.report ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Pekerjaan:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {item.report.jobs.map((job, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center text-xs px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-medium"
                            >
                              {job}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Tempat / Lokasi:</p>
                        <p className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                          <MapPin className="h-4 w-4 text-rose-500 shrink-0" />
                          {item.report.tempat}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                      <span>Waktu Input: {item.report.waktu_input} WIB &middot; Revisi #{item.report.revision}</span>
                      {onCorrect && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            onCorrect(item)
                          }}
                          className="h-8 text-xs text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                        >
                          <Edit3 className="h-3.5 w-3.5 mr-1" />
                          Koreksi Laporan
                        </Button>
                      )}
                    </div>

                    {item.report.foto_url && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Foto Bukti:</p>
                        <div
                          onClick={(e) => {
                            e.stopPropagation()
                            setPreviewPhoto({
                              url: item.report!.foto_url,
                              title: `${item.nama_lengkap} — ${item.report!.tempat}`
                            })
                          }}
                          className="group relative w-44 h-32 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 cursor-pointer shadow-sm"
                        >
                          <img
                            loading="lazy"
                            src={item.report.foto_url}
                            alt={`Pekerjaan di ${item.report.tempat}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-1 text-xs font-medium">
                            <Eye className="h-4 w-4" />
                            <span>Lihat Foto</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  !item.leave && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                      Belum ada laporan bukti pekerjaan yang diisi untuk slot ini.
                    </p>
                  )
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Lightbox Photo Preview Dialog */}
      <Dialog open={!!previewPhoto} onOpenChange={(open) => !open && setPreviewPhoto(null)}>
        <DialogContent className="max-w-3xl p-4">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold truncate">
              {previewPhoto?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="relative w-full max-h-[75vh] flex items-center justify-center overflow-hidden rounded-lg bg-black/90 p-2">
            {previewPhoto && (
              <img
                src={previewPhoto.url}
                alt={previewPhoto.title}
                className="max-h-[70vh] w-auto max-w-full object-contain rounded"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
