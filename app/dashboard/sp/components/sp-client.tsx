// Lokasi: app/dashboard/sp/components/sp-client.tsx
'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, FileWarning, Loader2, Plus, Printer, Search,
  Trash2, X, CheckCircle2, Upload, FileCheck2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { TemplateSP } from './sp-templates'
import { compressAgendaImage } from '../../agenda/components/image-compression'
import {
  DEFAULT_PRINT_SETTINGS,
  getPrintPageStyle,
  getPrintSettings,
  formatTanggalIndo,
  type PrintSettings,
} from '../../surat/components/surat-templates'
import {
  tetapkanSP,
  getDetailSiswaSP,
  simpanTindakLanjut,
  hapusTindakLanjut,
  simpanKeputusan,
  hapusSP,
  uploadSignedSP,
  hapusSignedSP,
} from '../actions'
import {
  SP_LEVEL_LABEL,
  SP_LEVEL_SHORT,
  KEPUTUSAN_LABEL,
  JENIS_TINDAK_LANJUT,
  type SpLevel,
  type KeputusanSp,
} from '../constants'

type MasterData = { siswa: any[]; pejabat: any[] }
type Props = {
  masterData: MasterData
  sanksiList: any[]
  rekomendasi: any[]
  riwayat: any[]
  currentUser: { id: string; nama: string }
}

const KODE_KLASIFIKASI_SP = 'PP.00.7'
const BULAN_ROMAWI = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
const SP_LEVELS: SpLevel[] = ['sp1', 'sp2', 'sp3']

const LEVEL_DESC: Record<SpLevel, string> = {
  sp1: 'Peringatan pertama atas akumulasi pelanggaran.',
  sp2: 'Peringatan kedua, pelanggaran berlanjut.',
  sp3: 'Peringatan terakhir sebelum keputusan.',
}
const LEVEL_STYLE: Record<SpLevel, string> = {
  sp1: 'border-amber-300 bg-amber-50 hover:border-amber-400 dark:border-amber-800 dark:bg-amber-950/30',
  sp2: 'border-orange-300 bg-orange-50 hover:border-orange-400 dark:border-orange-800 dark:bg-orange-950/30',
  sp3: 'border-rose-300 bg-rose-50 hover:border-rose-400 dark:border-rose-800 dark:bg-rose-950/30',
}
const LEVEL_BADGE: Record<SpLevel, string> = {
  sp1: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  sp2: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
  sp3: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
}

function kelasLabel(s: any) {
  if (s?.tingkat && s?.nomor_kelas) return `${s.tingkat}.${s.nomor_kelas}${s.kelompok ? ` ${s.kelompok}` : ''}`
  if (s?.tingkat) return String(s.tingkat)
  return '-'
}

// Cetak via window.open (pola agenda-kelas) — andal di HP
function printNode(el: HTMLElement | null, settings: PrintSettings, title: string) {
  if (!el) return
  const w = window.open('', '_blank')
  if (!w) {
    alert('Popup diblokir browser. Izinkan popup untuk mencetak.')
    return
  }
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
<style>
${getPrintPageStyle(settings)}
html, body { margin: 0; padding: 0; background: #fff; }
* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
</style>
</head><body>${el.innerHTML}</body></html>`)
  w.document.close()
  const imgs = Array.from(w.document.images)
  const ready = imgs.length === 0
    ? Promise.resolve()
    : Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((r) => { img.onload = r; img.onerror = r }))))
  ready.then(() => {
    w.focus()
    w.print()
  })
}

export function SpClient({ masterData, sanksiList, rekomendasi, riwayat }: Props) {
  const [wizardLevel, setWizardLevel] = useState<SpLevel | null>(null)
  const [detailSiswa, setDetailSiswa] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      {/* 3 tombol besar SP1/SP2/SP3 */}
      <div className="grid gap-3 sm:grid-cols-3">
        {SP_LEVELS.map((lv) => (
          <button
            key={lv}
            type="button"
            onClick={() => setWizardLevel(lv)}
            className={`flex flex-col items-start gap-1 rounded-xl border-2 p-5 text-left transition-colors ${LEVEL_STYLE[lv]}`}
          >
            <div className="flex w-full items-center justify-between">
              <span className="text-2xl font-extrabold tracking-tight">{SP_LEVEL_SHORT[lv]}</span>
              <FileWarning className="h-6 w-6 opacity-70" />
            </div>
            <span className="text-sm font-semibold">{SP_LEVEL_LABEL[lv]}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{LEVEL_DESC[lv]}</span>
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">
              <Plus className="h-3.5 w-3.5" /> Buat SP
            </span>
          </button>
        ))}
      </div>

      {/* List siswa penerima SP */}
      <div className="rounded-lg border border-surface bg-surface p-4">
        <div className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Siswa Penerima SP
        </div>
        {riwayat.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada SP yang ditetapkan.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface text-left text-xs uppercase text-slate-500">
                  <th className="py-2 pr-3">Nama</th>
                  <th className="py-2 pr-3">Kelas</th>
                  <th className="py-2 pr-3">Jumlah SP</th>
                  <th className="py-2 pr-3">Tertinggi</th>
                  <th className="py-2 pr-3">Keputusan</th>
                </tr>
              </thead>
              <tbody>
                {riwayat.map((r) => (
                  <tr
                    key={r.siswa_id}
                    onClick={() => setDetailSiswa(r.siswa_id)}
                    className="cursor-pointer border-b border-surface/60 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30"
                  >
                    <td className="py-2.5 pr-3 font-medium text-indigo-700 dark:text-indigo-300">{r.nama_lengkap}</td>
                    <td className="py-2.5 pr-3">{kelasLabel(r)}</td>
                    <td className="py-2.5 pr-3">{r.jumlah_sp}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${LEVEL_BADGE[r.level_tertinggi as SpLevel] || ''}`}>
                        {SP_LEVEL_SHORT[r.level_tertinggi as SpLevel] || r.level_tertinggi}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      {r.keputusan ? <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs dark:bg-slate-700">{r.keputusan}</span> : <span className="text-xs text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {wizardLevel && (
        <WizardModal
          level={wizardLevel}
          masterData={masterData}
          rekomendasi={rekomendasi}
          onClose={() => setWizardLevel(null)}
        />
      )}
      {detailSiswa && <DetailModal siswaId={detailSiswa} onClose={() => setDetailSiswa(null)} />}
    </div>
  )
}

// ============================================================
// WIZARD PEMBUATAN SP (simpan saja — tidak langsung cetak)
// ============================================================
function WizardModal({ level: initialLevel, masterData, rekomendasi, onClose }: {
  level: SpLevel
  masterData: MasterData
  rekomendasi: any[]
  onClose: () => void
}) {
  const router = useRouter()
  const [siswaId, setSiswaId] = useState('')
  const [level, setLevel] = useState<SpLevel>(initialLevel)
  const [totalPoin, setTotalPoin] = useState<number>(0)
  const [nomorUrut, setNomorUrut] = useState('')
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10))
  const [alasan, setAlasan] = useState('')
  const [pejabatId, setPejabatId] = useState('')
  const [paper, setPaper] = useState<'A4' | 'F4'>('A4')
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pejabatId && masterData.pejabat.length > 0) setPejabatId(masterData.pejabat[0].user_id)
  }, [masterData.pejabat, pejabatId])

  const siswa = useMemo(() => masterData.siswa.find((s) => s.id === siswaId) || null, [masterData.siswa, siswaId])
  const pejabat = useMemo(() => masterData.pejabat.find((p) => p.user_id === pejabatId) || null, [masterData.pejabat, pejabatId])

  const rekomLevel = useMemo(() => rekomendasi.filter((r) => r.level_rekomendasi === level), [rekomendasi, level])

  const filteredSiswa = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return masterData.siswa.slice(0, 30)
    return masterData.siswa.filter((s) => s.nama_lengkap?.toLowerCase().includes(q) || String(s.nisn || '').includes(q)).slice(0, 30)
  }, [masterData.siswa, query])

  const previewData = useMemo(() => {
    if (!siswa) return null
    const dt = new Date(tanggal)
    const nomorPreview = `${nomorUrut || '___'}/Ma.10.20/${KODE_KLASIFIKASI_SP}/${BULAN_ROMAWI[dt.getMonth() + 1]}/${dt.getFullYear()}`
    return {
      siswa,
      pejabat: { kepala: pejabat || {} },
      print_settings: { paper, margins: DEFAULT_PRINT_SETTINGS.margins },
      level,
      total_poin: totalPoin,
      alasan,
      nomor_surat: nomorPreview,
      tanggal_surat: formatTanggalIndo(tanggal),
      tanggal_surat_raw: tanggal,
    }
  }, [siswa, pejabat, paper, level, totalPoin, alasan, nomorUrut, tanggal])

  function pickRekomendasi(r: any) {
    setSiswaId(r.id)
    setTotalPoin(r.total_poin ?? 0)
    setQuery(r.nama_lengkap || '')
    setMsg(null)
  }

  async function handleSimpan() {
    if (!siswa) { setMsg({ type: 'err', text: 'Pilih siswa terlebih dahulu.' }); return }
    if (!nomorUrut.trim()) { setMsg({ type: 'err', text: 'Nomor Urut Surat wajib diisi.' }); return }
    setSaving(true)
    setMsg(null)
    const res = await tetapkanSP({
      siswa_id: siswa.id, level, total_poin: totalPoin, alasan,
      nomor_urut_manual: nomorUrut, data_surat: previewData,
    })
    setSaving(false)
    if (res.error) { setMsg({ type: 'err', text: res.error }); return }
    router.refresh()
    onClose()
  }

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[96vw] max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-lg border border-surface bg-surface p-5 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <DialogPrimitive.Title className="flex items-center gap-2 text-base font-semibold">
              <span className={`rounded px-2 py-0.5 text-sm font-bold ${LEVEL_BADGE[level]}`}>{SP_LEVEL_SHORT[level]}</span>
              Buat {SP_LEVEL_LABEL[level]}
            </DialogPrimitive.Title>
            <button onClick={onClose}><X className="h-5 w-5" /></button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* form */}
            <div className="space-y-3">
              {rekomLevel.length > 0 && (
                <div className="rounded-lg border border-surface p-3">
                  <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Rekomendasi {SP_LEVEL_SHORT[level]}
                  </div>
                  <div className="max-h-32 space-y-1 overflow-auto">
                    {rekomLevel.map((r) => (
                      <button key={r.id} type="button" onClick={() => pickRekomendasi(r)}
                        className={`flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-left text-sm ${siswaId === r.id ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/40' : 'border-surface hover:border-indigo-300'}`}>
                        <span className="truncate"><b>{r.nama_lengkap}</b> <span className="text-xs text-slate-500">{kelasLabel(r)}</span></span>
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">{r.total_poin} poin</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label>Cari Siswa (manual)</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nama / NISN..." className="pl-8" />
                </div>
                {query && (
                  <div className="mt-1 max-h-36 overflow-auto rounded-md border border-surface">
                    {filteredSiswa.map((s) => (
                      <button key={s.id} type="button" onClick={() => { setSiswaId(s.id); setQuery(s.nama_lengkap) }}
                        className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-indigo-50 dark:hover:bg-indigo-950/40 ${siswaId === s.id ? 'bg-indigo-50 dark:bg-indigo-950/40' : ''}`}>
                        {s.nama_lengkap} <span className="text-xs text-slate-500">· {kelasLabel(s)}</span>
                      </button>
                    ))}
                    {filteredSiswa.length === 0 && <p className="px-3 py-2 text-sm text-slate-500">Tidak ditemukan.</p>}
                  </div>
                )}
              </div>

              {siswa && (
                <div className="rounded-md bg-indigo-50 px-3 py-2 text-sm dark:bg-indigo-950/40">
                  Siswa: <b>{siswa.nama_lengkap}</b> · Kelas {kelasLabel(siswa)} · NISN {siswa.nisn || '-'}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Level SP</Label>
                  <select value={level} onChange={(e) => setLevel(e.target.value as SpLevel)} className="h-9 w-full rounded-md border border-surface bg-transparent px-2 text-sm">
                    {SP_LEVELS.map((lv) => <option key={lv} value={lv}>{SP_LEVEL_LABEL[lv]}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Nomor Urut Surat</Label>
                  <Input value={nomorUrut} onChange={(e) => setNomorUrut(e.target.value)} placeholder="mis. B-101" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tanggal Surat</Label>
                  <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
                </div>
                <div>
                  <Label>Total Poin (snapshot)</Label>
                  <Input type="number" value={totalPoin} onChange={(e) => setTotalPoin(Number(e.target.value) || 0)} />
                </div>
              </div>

              <div>
                <Label>Penandatangan</Label>
                <select value={pejabatId} onChange={(e) => setPejabatId(e.target.value)} className="h-9 w-full rounded-md border border-surface bg-transparent px-2 text-sm">
                  {masterData.pejabat.map((p) => <option key={p.user_id} value={p.user_id}>{p.nama_lengkap} — {p.nama}</option>)}
                </select>
              </div>

              <div>
                <Label>Alasan / Catatan (opsional)</Label>
                <textarea value={alasan} onChange={(e) => setAlasan(e.target.value)} rows={2} className="w-full rounded-md border border-surface bg-transparent px-2 py-1.5 text-sm" />
              </div>

              <div className="flex items-center gap-3">
                <Label className="shrink-0">Kertas</Label>
                <select value={paper} onChange={(e) => setPaper(e.target.value as 'A4' | 'F4')} className="h-9 rounded-md border border-surface bg-transparent px-2 text-sm">
                  <option value="A4">A4</option>
                  <option value="F4">F4 (Folio)</option>
                </select>
              </div>

              {msg && (
                <div className={`rounded-md px-3 py-2 text-sm ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40'}`}>{msg.text}</div>
              )}

              <div className="flex gap-2">
                <Button onClick={handleSimpan} disabled={saving || !siswa} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Simpan Penetapan
                </Button>
                <Button variant="outline" onClick={onClose}>Batal</Button>
              </div>
              <p className="text-xs text-slate-500">Cetak surat dilakukan terpisah dari daftar siswa (klik nama siswa).</p>
            </div>

            {/* preview (informasi, bukan untuk langsung cetak) */}
            <div className="rounded-lg border border-surface bg-gray-100 p-3 dark:bg-slate-800">
              <div className="max-h-[70vh] overflow-auto">
                <div ref={printRef} style={{ background: '#fff' }}>
                  {previewData ? <TemplateSP data={previewData} /> : <p className="p-6 text-center text-sm text-slate-500">Pilih siswa untuk pratinjau.</p>}
                </div>
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

// ============================================================
// DETAIL SISWA — riwayat SP (cetak ulang + upload TTD) + tindak lanjut + keputusan
// ============================================================
function DetailModal({ siswaId, onClose }: { siswaId: string; onClose: () => void }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<any>(null)
  const [tlJenis, setTlJenis] = useState('pembinaan')
  const [tlTanggal, setTlTanggal] = useState(() => new Date().toISOString().slice(0, 10))
  const [tlCatatan, setTlCatatan] = useState('')
  const [kepTipe, setKepTipe] = useState<KeputusanSp>('naik')
  const [kepCatatan, setKepCatatan] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const reprintRef = useRef<HTMLDivElement>(null)
  const [reprintData, setReprintData] = useState<any>(null)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})

  async function load() {
    setLoading(true)
    const d = await getDetailSiswaSP(siswaId)
    setDetail(d)
    if (d.keputusan) { setKepTipe(d.keputusan.keputusan); setKepCatatan(d.keputusan.catatan || '') }
    setLoading(false)
  }
  useEffect(() => { load() }, [siswaId])

  async function addTL() {
    setBusy(true); setMsg(null)
    const res = await simpanTindakLanjut({ siswa_id: siswaId, tanggal: tlTanggal, jenis: tlJenis, catatan: tlCatatan })
    setBusy(false)
    if (res.error) { setMsg(res.error); return }
    setTlCatatan(''); await load(); router.refresh()
  }
  async function delTL(id: string) { setBusy(true); await hapusTindakLanjut(id); setBusy(false); await load(); router.refresh() }
  async function saveKeputusan() {
    setBusy(true); setMsg(null)
    const res = await simpanKeputusan({ siswa_id: siswaId, keputusan: kepTipe, tanggal: new Date().toISOString().slice(0, 10), catatan: kepCatatan })
    setBusy(false); setMsg(res.error || res.success || null); await load(); router.refresh()
  }
  async function delSP(id: string) { setBusy(true); await hapusSP(id); setBusy(false); await load(); router.refresh() }

  function reprint(sp: any) {
    let data: any = {}
    try { data = JSON.parse(sp.data_surat || '{}') } catch { data = {} }
    setReprintData(data)
    setTimeout(() => printNode(reprintRef.current, getPrintSettings({ print_settings: data.print_settings }), 'Surat Peringatan'), 100)
  }

  async function onPickFile(spId: string, file: File | null) {
    if (!file) return
    setUploadingId(spId); setMsg(null)
    try {
      const compressed = await compressAgendaImage(file, { targetBytes: 180 * 1024 })
      const fd = new FormData()
      fd.append('file', compressed)
      const res = await uploadSignedSP(spId, fd)
      if (res.error) setMsg(res.error)
      else { await load(); router.refresh() }
    } catch (e: any) {
      setMsg('Gagal memproses gambar: ' + (e?.message || ''))
    } finally {
      setUploadingId(null)
    }
  }
  async function removeFile(spId: string) {
    setUploadingId(spId)
    await hapusSignedSP(spId)
    setUploadingId(null)
    await load(); router.refresh()
  }

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[95vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-lg border border-surface bg-surface p-5 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <DialogPrimitive.Title className="text-base font-semibold">Detail SP & Tindak Lanjut</DialogPrimitive.Title>
            <button onClick={onClose}><X className="h-5 w-5" /></button>
          </div>

          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md bg-indigo-50 px-3 py-2 text-sm dark:bg-indigo-950/40">
                <b>{detail?.siswa?.nama_lengkap}</b> · Kelas {kelasLabel(detail?.siswa)} · NISN {detail?.siswa?.nisn || '-'}
              </div>

              {/* Riwayat SP */}
              <div>
                <div className="mb-1 text-sm font-semibold">Riwayat SP</div>
                <div className="space-y-1.5">
                  {detail?.spList?.map((sp: any) => (
                    <div key={sp.id} className="rounded-md border border-surface px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0">
                          <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${LEVEL_BADGE[sp.level as SpLevel] || ''}`}>{SP_LEVEL_SHORT[sp.level as SpLevel] || sp.level}</span>
                          <span className="ml-2">{sp.nomor_surat}</span>
                          <span className="ml-2 text-xs text-slate-500">{(sp.tanggal_sp || sp.created_at || '').slice(0, 10)} · {sp.total_poin} poin</span>
                        </span>
                        <span className="flex shrink-0 gap-1">
                          <Button variant="outline" size="sm" className="gap-1" onClick={() => reprint(sp)}><Printer className="h-3.5 w-3.5" /> Cetak</Button>
                          <Button variant="outline" size="sm" onClick={() => delSP(sp.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </span>
                      </div>
                      {/* baris file SP bertanda tangan */}
                      <div className="mt-1.5 flex items-center gap-2">
                        <input
                          ref={(el) => { fileInputs.current[sp.id] = el }}
                          type="file" accept="image/*" className="hidden"
                          onChange={(e) => onPickFile(sp.id, e.target.files?.[0] || null)}
                        />
                        {sp.file_ttd_url ? (
                          <>
                            <a href={sp.file_ttd_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              <FileCheck2 className="h-3.5 w-3.5" /> SP bertanda tangan
                            </a>
                            <button onClick={() => fileInputs.current[sp.id]?.click()} className="text-xs text-slate-500 underline" disabled={uploadingId === sp.id}>Ganti</button>
                            <button onClick={() => removeFile(sp.id)} className="text-xs text-rose-500 underline" disabled={uploadingId === sp.id}>Hapus</button>
                          </>
                        ) : (
                          <button onClick={() => fileInputs.current[sp.id]?.click()} disabled={uploadingId === sp.id}
                            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                            {uploadingId === sp.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                            Upload SP bertanda tangan
                          </button>
                        )}
                        {uploadingId === sp.id && <span className="text-xs text-slate-400">memproses…</span>}
                      </div>
                    </div>
                  ))}
                  {detail?.spList?.length === 0 && <p className="text-sm text-slate-500">Belum ada SP.</p>}
                </div>
              </div>

              {/* Tindak lanjut */}
              <div>
                <div className="mb-1 text-sm font-semibold">Tindak Lanjut</div>
                <div className="space-y-1">
                  {detail?.tindakLanjut?.map((tl: any) => (
                    <div key={tl.id} className="flex items-start justify-between rounded-md border border-surface px-3 py-1.5 text-sm">
                      <span>
                        <span className="font-medium">{JENIS_TINDAK_LANJUT.find((j) => j.value === tl.jenis)?.label || tl.jenis}</span>
                        <span className="ml-2 text-xs text-slate-500">{(tl.tanggal || '').slice(0, 10)}</span>
                        {tl.catatan && <div className="text-xs text-slate-500">{tl.catatan}</div>}
                      </span>
                      <button onClick={() => delTL(tl.id)}><Trash2 className="h-3.5 w-3.5 text-slate-400" /></button>
                    </div>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <select value={tlJenis} onChange={(e) => setTlJenis(e.target.value)} className="h-9 rounded-md border border-surface bg-transparent px-2 text-sm">
                    {JENIS_TINDAK_LANJUT.map((j) => <option key={j.value} value={j.value}>{j.label}</option>)}
                  </select>
                  <Input type="date" value={tlTanggal} onChange={(e) => setTlTanggal(e.target.value)} />
                </div>
                <textarea value={tlCatatan} onChange={(e) => setTlCatatan(e.target.value)} rows={2} placeholder="Catatan tindak lanjut..." className="mt-2 w-full rounded-md border border-surface bg-transparent px-2 py-1.5 text-sm" />
                <Button size="sm" className="mt-2 gap-1" onClick={addTL} disabled={busy}><Plus className="h-3.5 w-3.5" /> Tambah Tindak Lanjut</Button>
              </div>

              {/* Keputusan akhir */}
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="h-4 w-4 text-amber-600" /> Keputusan Akhir</div>
                <div className="space-y-1">
                  {(Object.keys(KEPUTUSAN_LABEL) as KeputusanSp[]).map((k) => (
                    <label key={k} className="flex items-center gap-2 text-sm">
                      <input type="radio" name="keputusan" checked={kepTipe === k} onChange={() => setKepTipe(k)} />
                      {KEPUTUSAN_LABEL[k]}
                    </label>
                  ))}
                </div>
                <textarea value={kepCatatan} onChange={(e) => setKepCatatan(e.target.value)} rows={2} placeholder="Catatan keputusan..." className="mt-2 w-full rounded-md border border-surface bg-transparent px-2 py-1.5 text-sm" />
                <p className="mt-1 text-xs text-slate-500">Catatan: status siswa (pindah/keluar) diubah manual di menu Siswa.</p>
                <Button size="sm" className="mt-2" onClick={saveKeputusan} disabled={busy}>Simpan Keputusan</Button>
              </div>

              {msg && <div className="rounded-md bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">{msg}</div>}
            </div>
          )}

          {/* hidden reprint node */}
          <div style={{ position: 'absolute', left: '-99999px', top: 0 }}>
            <div ref={reprintRef} style={{ background: '#fff' }}>
              {reprintData && <TemplateSP data={reprintData} />}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
