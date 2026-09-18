'use client'

import { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle, FileText, Loader2, Printer } from 'lucide-react'
import { downloadAndOpenNativeFile } from '@/lib/pdf/download'

type EkskulOption = { id: string; nama: string; status: string }

export function CetakSiswaDialog({
  ekskulList,
  residenceOptions,
  initialEkskulId,
  onClose,
}: {
  ekskulList: EkskulOption[]
  residenceOptions: string[]
  initialEkskulId?: string
  onClose: () => void
}) {
  const [scope, setScope] = useState<'all' | 'single'>(initialEkskulId ? 'single' : 'all')
  const [ekskulId, setEkskulId] = useState(initialEkskulId || ekskulList[0]?.id || '')
  const [domisili, setDomisili] = useState('all')
  const [format, setFormat] = useState<'pdf' | 'docx'>('pdf')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedEkskul = useMemo(
    () => ekskulList.find(item => item.id === ekskulId),
    [ekskulId, ekskulList],
  )

  const handleCetak = async () => {
    if (scope === 'single' && !ekskulId) {
      setError('Pilih ekstrakurikuler yang akan dicetak.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ scope, domisili })
      if (scope === 'single') params.set('ekskulId', ekskulId)
      const filenameScope = scope === 'single' ? selectedEkskul?.nama || 'Ekstrakurikuler' : 'Semua_Ekstrakurikuler'
      const filename = `Daftar_Siswa_${filenameScope.replace(/[^a-zA-Z0-9-_]+/g, '_')}.${format}`
      await downloadAndOpenNativeFile(`/api/${format}/ekskul-anggota?${params.toString()}`, filename)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal membuat dokumen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-xl">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <Printer className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            Cetak Data Siswa Ekstrakurikuler
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {error && (
            <div className="flex gap-2 rounded-lg border border-rose-100 bg-rose-50 p-2.5 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Cakupan Cetak</Label>
            <Select value={scope} onValueChange={value => setScope(value as 'all' | 'single')}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-sm">Semua ekstrakurikuler aktif</SelectItem>
                <SelectItem value="single" className="text-sm">Satu ekstrakurikuler</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scope === 'single' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Ekstrakurikuler</Label>
              <Select value={ekskulId} onValueChange={setEkskulId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Pilih ekstrakurikuler" /></SelectTrigger>
                <SelectContent>
                  {ekskulList.map(item => (
                    <SelectItem key={item.id} value={item.id} className="text-sm">
                      {item.nama}{item.status !== 'aktif' ? ' (Nonaktif)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Tempat Tinggal</Label>
            <Select value={domisili} onValueChange={setDomisili}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-sm">Semua tempat tinggal</SelectItem>
                <SelectItem value="pesantren" className="text-sm">Semua siswa pesantren</SelectItem>
                <SelectItem value="non_pesantren" className="text-sm">Non-Pesantren</SelectItem>
                {residenceOptions.filter(option => option !== 'Non-Pesantren').map(option => (
                  <SelectItem key={option} value={`exact:${option}`} className="text-sm">
                    {option === 'Pesantren' ? 'Pesantren (tanpa rincian)' : option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Format Dokumen</Label>
            <Select value={format} onValueChange={value => setFormat(value as 'pdf' | 'docx')}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf" className="text-sm">PDF siap cetak</SelectItem>
                <SelectItem value="docx" className="text-sm">Word dapat diedit (.docx)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 rounded-lg border bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            <FileText className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Setiap ekskul dimulai pada halaman baru. Kolom Asrama/Kamar sengaja dikosongkan agar dapat diisi manual.</p>
          </div>

          <Button onClick={handleCetak} disabled={loading || (scope === 'single' && !ekskulId)} className="h-10 w-full">
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyiapkan {format === 'pdf' ? 'PDF' : 'Word'}...</>
            ) : (
              <><Printer className="mr-2 h-4 w-4" />Unduh {format === 'pdf' ? 'PDF' : 'Word'}</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
