'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { JUZ_DATA } from "../data/juz-data"

interface RiwayatModalProps {
  isOpen: boolean
  onClose: () => void
  riwayat: any[]
  siswaNama: string
}

export function RiwayatModal({ isOpen, onClose, riwayat, siswaNama }: RiwayatModalProps) {
  
  // Helper to format newly added ayat, e.g. [1,2,3, 7,8] -> "1-3, 7-8"
  const formatAyatRange = (ayatArr: number[]) => {
    if (!ayatArr || ayatArr.length === 0) return ""
    let ranges = []
    let start = ayatArr[0]
    let prev = start
    
    for (let i = 1; i <= ayatArr.length; i++) {
      if (ayatArr[i] === prev + 1) {
        prev = ayatArr[i]
      } else {
        ranges.push(start === prev ? `${start}` : `${start}-${prev}`)
        if (i < ayatArr.length) {
          start = ayatArr[i]
          prev = start
        }
      }
    }
    return ranges.join(', ')
  }

  const getSurahName = (nomor: number) => {
    for (const j of JUZ_DATA) {
      const s = j.surahList.find(x => x.nomor === nomor)
      if (s) return s.nama
    }
    return `Surah ${nomor}`
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Riwayat Setoran Hafalan</DialogTitle>
          <p className="text-sm text-slate-500">Siswa: {siswaNama}</p>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4 border-t pt-4">
          {riwayat.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Belum ada riwayat setoran.
            </div>
          ) : (
            <div className="space-y-4">
              {riwayat.map((log) => {
                let ayatList: number[] = []
                try { ayatList = JSON.parse(log.ayat_baru) } catch(e) {}
                
                return (
                  <div key={log.id} className="p-3 border rounded-lg bg-slate-50 relative">
                    <div className="text-xs text-slate-500 mb-1">
                      {new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(log.created_at))}
                      {' • '}
                      {log.guru_nama}
                    </div>
                    <div>
                      <span className="font-semibold">{getSurahName(log.surah_nomor)}</span>
                      <span className="text-slate-500 text-sm ml-2">Juz {log.juz}</span>
                    </div>
                    <div className="text-sm text-emerald-600 font-medium mt-1">
                      Ayat yang disetorkan: {formatAyatRange(ayatList)} ({ayatList.length} ayat)
                    </div>
                    {log.keterangan && (
                      <div className="text-sm text-slate-600 mt-2 bg-white p-2 rounded border border-slate-100">
                        "{log.keterangan}"
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
