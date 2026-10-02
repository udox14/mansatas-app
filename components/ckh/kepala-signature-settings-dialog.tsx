'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Loader2, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { deleteCkhKepalaSignatureAction, uploadCkhKepalaSignatureAction, saveCkhKepalaSignatureSettings } from '@/app/dashboard/ckh-generator/actions'
import type { SignatureSettings } from '@/lib/ckh-kepala-signature'

const signatureRoleStyle: CSSProperties = { fontWeight: 700, textTransform: 'uppercase', marginBottom: '20mm' }
const signaturePreviewColumnStyle: CSSProperties = {
  textAlign: 'left',
  paddingLeft: '14mm',
  position: 'relative',
  width: '96mm',
  minHeight: '48mm',
  fontFamily: 'Tahoma, sans-serif',
  fontSize: '10pt',
  color: '#000',
}

function signatureImageStyle(settings: SignatureSettings): CSSProperties {
  return {
    position: 'absolute',
    left: `${settings.signature_x_mm}mm`,
    top: `${settings.signature_y_mm}mm`,
    width: `${settings.signature_width_mm}mm`,
    maxWidth: 'none',
    height: 'auto',
    maxHeight: 'none',
    objectFit: 'contain',
    zIndex: 10,
    pointerEvents: 'none',
  }
}

export function KepalaSignatureSettingsDialog({
  documentId,
  onSaveSettings,
  printOnly = false,
  signatureUrl,
  onSignatureUploaded,
  onSignatureDeleted,
  signerName,
  signerLabel,
  signerNip,
  settings,
  onApply,
}: {
  documentId?: string
  onSaveSettings?: (settings: SignatureSettings) => Promise<{ error?: string; settings?: SignatureSettings }>
  printOnly?: boolean
  signatureUrl: string | null
  onSignatureUploaded: (url: string) => void
  onSignatureDeleted: () => void
  signerName: string
  signerLabel: string
  signerNip: string | null
  settings: SignatureSettings
  onApply: (settings: SignatureSettings) => void
}) {
  const [draft, setDraft] = useState<SignatureSettings>(settings)
  const [message, setMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(settings)
  }, [settings])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setMessage(null)
    try {
      const fd = new FormData()
      fd.append('signature', file)
      const res = await uploadCkhKepalaSignatureAction(fd)
      if (res.error) {
        setMessage(res.error)
        return
      }
      if (res.url) {
        onSignatureUploaded(res.url)
        setDraft(prev => ({ ...prev, signature_enabled: 1 }))
        setMessage('File tanda tangan kepala madrasah berhasil diupload.')
      }
    } catch {
      setMessage('Gagal mengupload file.')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteSignature = async () => {
    if (!confirm('Hapus file tanda tangan kepala madrasah untuk CKH?')) return
    setIsUploading(true)
    setMessage(null)
    try {
      const res = await deleteCkhKepalaSignatureAction()
      if (res.error) {
        setMessage(res.error)
        return
      }
      onSignatureDeleted()
      setDraft(prev => ({ ...prev, signature_enabled: 0 }))
      setMessage('File tanda tangan kepala madrasah telah dihapus.')
    } catch {
      setMessage('Gagal menghapus file.')
    } finally {
      setIsUploading(false)
    }
  }

  const saveSettings = async () => {
    setIsSaving(true)
    setMessage(null)
    try {
      const res = onSaveSettings ? await onSaveSettings(draft) : await saveCkhKepalaSignatureSettings(documentId!, {
        enabled: Boolean(draft.signature_enabled),
        xMm: draft.signature_x_mm,
        yMm: draft.signature_y_mm,
        widthMm: draft.signature_width_mm,
      })
      if (res?.error) {
        setMessage(res.error)
        return
      }
      if (res?.settings) onApply(res.settings as SignatureSettings)
      setMessage(printOnly ? 'Pengaturan diterapkan untuk cetak CKH dari Dokumen TPG.' : 'Pengaturan tanda tangan kepala madrasah diterapkan.')
    } finally {
      setIsSaving(false)
    }
  }

  const updateNumber = (key: keyof Pick<SignatureSettings, 'signature_x_mm' | 'signature_y_mm' | 'signature_width_mm'>, value: string) => {
    setDraft(prev => ({ ...prev, [key]: Number(value) }))
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-10 gap-2 whitespace-nowrap border-amber-300 bg-amber-50/50 text-amber-900 hover:bg-amber-100/60 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
          <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          TTD Kepala
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-600" />
            Pengaturan Tanda Tangan Kepala Madrasah ({printOnly ? 'TU & Super Admin' : 'Khusus Super Admin'})
          </DialogTitle>
          <DialogDescription>
            Atur penggunaan, posisi, dan ukuran tanda tangan kepala pada cetakan CKH.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {printOnly ? <p className="text-xs text-slate-500">Berlaku untuk cetak CKH terpilih maupun semua CKH. Posisi dan ukuran disimpan di browser ini untuk akun Anda. File tanda tangan digunakan bersama CKH Generator.</p> : null}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  File Tanda Tangan Kepala (Khusus Dokumen CKH)
                </p>
                <p className="text-[11px] text-slate-500">
                  {signatureUrl
                    ? 'File tanda tangan khusus CKH telah terpasang.'
                    : 'Belum ada file. File ini terpisah dari foto tanda tangan profil akun.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="h-8 gap-1.5 text-xs"
                >
                  {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {signatureUrl ? 'Ganti File' : 'Upload File'}
                </Button>
                {signatureUrl && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleDeleteSignature}
                    disabled={isUploading}
                    className="h-8 gap-1.5 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/30"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus
                  </Button>
                )}
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 rounded-lg border border-surface-2 bg-surface-2 px-3 py-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={Boolean(draft.signature_enabled)}
              onChange={e => setDraft(prev => ({ ...prev, signature_enabled: e.target.checked ? 1 : 0 }))}
              disabled={!signatureUrl}
              className="h-4 w-4 rounded text-amber-600 focus:ring-amber-500"
            />
            Pakai tanda tangan Kepala Madrasah pada {printOnly ? 'cetakan CKH dari Dokumen TPG' : 'format cetak dokumen CKH ini'}
          </label>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-4">
            <div style={signaturePreviewColumnStyle}>
              <div>Mengetahui :</div>
              <div style={signatureRoleStyle}>{signerLabel}</div>
              {signatureUrl ? (
                <img src={signatureUrl} alt="Preview tanda tangan kepala" style={signatureImageStyle(draft)} />
              ) : null}
              <div style={{ fontWeight: 700, textDecoration: 'underline' }}>{signerName}</div>
              <div>NIP. {signerNip || '000000000000000000'}</div>
            </div>
          </div>

          {signatureUrl && !draft.signature_enabled ? (
            <p className="text-xs text-amber-700">
              Preview tersedia. Centang &quot;Pakai tanda tangan Kepala Madrasah&quot; lalu klik Apply agar tampil pada {printOnly ? 'cetakan CKH dari Dokumen TPG' : 'format cetak dokumen bulan ini'}.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Geser kanan (mm)</Label>
              <Input type="number" value={draft.signature_x_mm} min={-20} max={80} onChange={e => updateNumber('signature_x_mm', e.target.value)} disabled={!signatureUrl} />
              <input type="range" min={-20} max={80} value={draft.signature_x_mm} onChange={e => updateNumber('signature_x_mm', e.target.value)} disabled={!signatureUrl} className="w-full" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Geser turun (mm)</Label>
              <Input type="number" value={draft.signature_y_mm} min={-20} max={80} onChange={e => updateNumber('signature_y_mm', e.target.value)} disabled={!signatureUrl} />
              <input type="range" min={-20} max={80} value={draft.signature_y_mm} onChange={e => updateNumber('signature_y_mm', e.target.value)} disabled={!signatureUrl} className="w-full" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Ukuran tanda tangan (mm)</Label>
              <Input type="number" value={draft.signature_width_mm} min={10} max={150} onChange={e => updateNumber('signature_width_mm', e.target.value)} disabled={!signatureUrl} />
              <input type="range" min={10} max={150} value={draft.signature_width_mm} onChange={e => updateNumber('signature_width_mm', e.target.value)} disabled={!signatureUrl} className="w-full" />
            </div>
          </div>

          {message ? <p className="text-xs text-slate-500">{message}</p> : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDraft({ signature_enabled: signatureUrl ? 1 : 0, signature_x_mm: 14, signature_y_mm: 12, signature_width_mm: 38 })}
              disabled={!signatureUrl || isSaving || isUploading}
            >
              Reset
            </Button>
            <Button onClick={saveSettings} disabled={!signatureUrl || isSaving || isUploading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
