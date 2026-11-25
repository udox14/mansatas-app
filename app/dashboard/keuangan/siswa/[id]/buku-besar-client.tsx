'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RupiahInput } from '@/components/ui/rupiah-input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { CheckCircle2, Clock, XCircle, Plus, Printer, AlertTriangle, Ban, Calendar, Trash2 } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { formatDateWIB, nowWIBISO } from '@/lib/time'
import { getKuitansiTahunAjaran } from '@/lib/tahun-ajaran'
import { catatTransaksi, voidTransaksi, beriDiskon, batalkanDiskon, simpanJanjiBayar, setSppSaldoAwal, bayarSaldoAwalSpp } from '../../actions'
import type { StudentFinanceScope } from '../../actions'
import { KuitansiModal, type KuitansiData } from '../../components/kuitansi-print'

const STATUS_MAP = {
  lunas: { label: 'Lunas', icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  nyicil: { label: 'Nyicil', icon: Clock, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  belum_bayar: { label: 'Belum Bayar', icon: XCircle, cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
  tidak_ada: { label: 'Belum Diinput', icon: Ban, cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
}

export function BukuBesarClient({
  data,
  masterItem: _masterItem,
  tahunAjaranId: _tahunAjaranId,
  tahunAjaranNama,
  studentScope,
}: {
  data: any
  masterItem: any[]
  tahunAjaranId?: string
  tahunAjaranNama?: string
  studentScope: StudentFinanceScope
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaultTab = (['dspt', 'spp', 'riwayat'].includes(searchParams.get('tab') ?? ''))
    ? (searchParams.get('tab') as string)
    : 'dspt'
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState('')
  const [bayarModal, setBayarModal] = useState<{ type: 'dspt' } | null>(null)
  const [diskonModal, setDiskonModal] = useState<{ type: string; targetId: string; label: string } | null>(null)
  const [batalDiskonModal, setBatalDiskonModal] = useState<any | null>(null)
  const [voidModal, setVoidModal] = useState<string | null>(null)
  const [janjiModal, setJanjiModal] = useState<{ type: string; targetId: string } | null>(null)
  const [kuitansiData, setKuitansiData] = useState<KuitansiData | null>(null)
  const [kuitansiOpen, setKuitansiOpen] = useState(false)
  const [bayarForm, setBayarForm] = useState({ jumlah: '', metode: 'tunai', selectedItems: [] as string[] })
  const [diskonForm, setDiskonForm] = useState({ jumlah: '', alasan: 'anak_guru', keterangan: '' })
  const [voidAlasan, setVoidAlasan] = useState('')
  const [janjiForm, setJanjiForm] = useState({ tanggal: '', catatan: '' })

  const { siswa, dspt, sppSaldoAwal, transaksi, janjiList, diskonList = [] } = data
  const tahunAjaranKuitansi = getKuitansiTahunAjaran(tahunAjaranNama, Boolean(siswa.tingkat))

  // Saldo Awal (tunggakan migrasi)
  const [saldoAwalModal, setSaldoAwalModal] = useState(false)
  const [saldoAwalForm, setSaldoAwalForm] = useState({
    jumlah: String(sppSaldoAwal?.jumlah ?? ''),
    keterangan: sppSaldoAwal?.keterangan ?? '',
  })
  const [saldoAwalBayarModal, setSaldoAwalBayarModal] = useState(false)
  const [saldoAwalBayarJumlah, setSaldoAwalBayarJumlah] = useState('')

  async function handleSaveSaldoAwal(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await setSppSaldoAwal(siswa.id, parseInt(saldoAwalForm.jumlah) || 0, saldoAwalForm.keterangan || undefined, studentScope)
      setMsg(res.error ?? res.success ?? '')
      if (!res.error) { setSaldoAwalModal(false); router.refresh() }
    })
  }

  async function handleBayarSaldoAwal(e: React.FormEvent) {
    e.preventDefault()
    if (!sppSaldoAwal?.id || !saldoAwalBayarJumlah) return
    startTransition(async () => {
      const res = await bayarSaldoAwalSpp(sppSaldoAwal.id, parseInt(saldoAwalBayarJumlah), studentScope)
      setMsg(res.error ?? res.success ?? '')
      if (!res.error) { setSaldoAwalBayarModal(false); setSaldoAwalBayarJumlah(''); router.refresh() }
    })
  }

  function getJanji(type: string, id: string) {
    return janjiList.find((j: any) => j.target_type === type && j.target_id === id)
  }

  function buildKuitansiData(
    nomorKuitansi: string,
    kategori: 'dspt' | 'spp',
    jumlahDiserahkan: number,
    metode: string,
    rincianBayar: KuitansiData['rincianBayar'],
    isLunas: boolean,
    namaPerugas: string = 'Bendahara Komite',
  ): KuitansiData {
    const sisaTunggakan: KuitansiData['sisaTunggakan'] = []
    let targetTagihan: number | undefined
    let sisaTagihan: number | undefined
    if (kategori === 'dspt' && dspt && dspt.status !== 'tidak_ada') {
      const sisaDspt = dspt.nominal_target - (dspt.total_dibayar + jumlahDiserahkan) - dspt.total_diskon
      targetTagihan = dspt.nominal_target
      sisaTagihan = Math.max(0, sisaDspt)
      if (sisaDspt > 0) sisaTunggakan.push({ label: 'DSPT', sisa: sisaDspt })
    }

    const kelas = siswa.tingkat
      ? `Kelas ${siswa.tingkat}-${siswa.nomor_kelas}${siswa.kelompok ? ' ' + siswa.kelompok : ''}`
      : '-'

    return {
      nomorKuitansi,
      tanggal: nowWIBISO(),
      kategori: kategori === 'dspt' ? 'DSPT' : 'SPP',
      tahunAjaran: tahunAjaranKuitansi,
      namaSiswa: siswa.nama_lengkap,
      nisn: siswa.nisn ?? '-',
      kelas,
      namaPerugas,
      metodeBayar: metode === 'tunai' ? 'Tunai' : 'Transfer Bank',
      jumlahDiserahkan,
      jumlahTagihan: rincianBayar.reduce((s, i) => s + i.nominal, 0),
      targetTagihan,
      sisaTagihan,
      rincianBayar,
      sisaTunggakan,
      isLunas,
    }
  }

  function openKuitansiRekap(kategori: 'dspt') {
    const kelas = siswa.tingkat
      ? `Kelas ${siswa.tingkat}-${siswa.nomor_kelas}${siswa.kelompok ? ' ' + siswa.kelompok : ''}`
      : '-'

    if (kategori === 'dspt' && dspt) {
      if (dspt.status === 'tidak_ada') return
      const sisa = dspt.nominal_target - dspt.total_dibayar - dspt.total_diskon
      setKuitansiData({
        nomorKuitansi: 'REKAP-DSPT',
        tanggal: nowWIBISO(),
        kategori: 'DSPT',
        tahunAjaran: tahunAjaranKuitansi,
        namaSiswa: siswa.nama_lengkap,
        nisn: siswa.nisn ?? '-',
        kelas,
        namaPerugas: 'Bendahara Komite',
        metodeBayar: 'Tunai',
        jumlahDiserahkan: dspt.total_dibayar,
        jumlahTagihan: dspt.nominal_target,
        targetTagihan: dspt.nominal_target,
        sisaTagihan: Math.max(0, sisa),
        rincianBayar: [
          { label: 'Target DSPT', nominal: dspt.nominal_target },
          { label: 'Sudah Dibayar', nominal: -dspt.total_dibayar },
          ...(dspt.total_diskon > 0 ? [{ label: 'Keringanan', nominal: -dspt.total_diskon }] : []),
        ],
        sisaTunggakan: sisa > 0 ? [{ label: 'DSPT', sisa }] : [],
        isLunas: dspt.status === 'lunas',
      })
      setKuitansiOpen(true)
    }
  }

  function openKuitansiFromTrx(trx: any) {
    const kelas = siswa.tingkat
      ? `Kelas ${siswa.tingkat}-${siswa.nomor_kelas}${siswa.kelompok ? ' ' + siswa.kelompok : ''}`
      : '-'
    const kategoriLabel = trx.kategori === 'dspt' ? 'DSPT' : 'SPP'
    const trxDsptSisa = trx.kategori === 'dspt' && dspt && dspt.status !== 'tidak_ada'
      ? Math.max(0, dspt.nominal_target - dspt.total_dibayar - dspt.total_diskon)
      : undefined
    setKuitansiData({
      nomorKuitansi: trx.nomor_kuitansi,
      tanggal: trx.created_at,
      kategori: kategoriLabel,
      tahunAjaran: tahunAjaranKuitansi,
      namaSiswa: siswa.nama_lengkap,
      nisn: siswa.nisn ?? '-',
      kelas,
      namaPerugas: trx.nama_input ?? 'Bendahara Komite',
      metodeBayar: trx.metode_bayar === 'tunai' ? 'Tunai' : 'Transfer Bank',
      jumlahDiserahkan: trx.jumlah_total,
      jumlahTagihan: trx.jumlah_total,
      targetTagihan: trx.kategori === 'dspt' && dspt && dspt.status !== 'tidak_ada' ? dspt.nominal_target : undefined,
      sisaTagihan: trxDsptSisa,
      rincianBayar: [{ label: `Pembayaran ${kategoriLabel}`, nominal: trx.jumlah_total }],
      sisaTunggakan: [],
      isLunas: trx.kategori === 'dspt'
        ? (dspt?.status === 'lunas')
        : (sppSaldoAwal?.status === 'lunas'),
    })
    setKuitansiOpen(true)
  }

  async function handleBayar(e: React.FormEvent) {
    e.preventDefault()
    if (!bayarModal) return
    setMsg('')

    let details: Array<{ refType: string; refId: string; jumlah: number }> = []
    let rincianBayar: KuitansiData['rincianBayar'] = []
    let jumlahDibayar = 0

    if (bayarModal.type === 'dspt' && dspt) {
      if (dspt.status === 'tidak_ada') { setMsg('Data DSPT belum diinput'); return }
      if (!bayarForm.jumlah) { setMsg('Masukkan jumlah pembayaran'); return }
      jumlahDibayar = parseInt(bayarForm.jumlah)
      details = [{ refType: 'dspt', refId: dspt.id, jumlah: jumlahDibayar }]
      rincianBayar = [{ label: 'DSPT (Dana Sumbangan Pembangunan Tahunan)', nominal: jumlahDibayar }]
    }

    startTransition(async () => {
      const res = await catatTransaksi({
        siswaId: siswa.id,
        kategori: bayarModal.type,
        metodeBayar: bayarForm.metode as 'tunai' | 'transfer',
        details,
      }, studentScope)
      if (res.error) { setMsg(res.error); return }
      setBayarModal(null)
      setBayarForm({ jumlah: '', metode: 'tunai', selectedItems: [] })

      if (res.data?.nomorKuitansi) {
        const isLunas = (dspt.nominal_target - (dspt.total_dibayar + jumlahDibayar) - dspt.total_diskon) <= 0
        setKuitansiData(buildKuitansiData(
          res.data.nomorKuitansi,
          bayarModal.type,
          jumlahDibayar,
          bayarForm.metode,
          rincianBayar,
          isLunas,
        ))
        setKuitansiOpen(true)
      }
      router.refresh()
    })
  }

  async function handleDiskon(e: React.FormEvent) {
    e.preventDefault()
    if (!diskonModal) return
    startTransition(async () => {
      const res = await beriDiskon({
        siswaId: siswa.id,
        targetType: diskonModal.type as any,
        targetId: diskonModal.targetId,
        jumlah: parseInt(diskonForm.jumlah),
        alasan: diskonForm.alasan,
        keterangan: diskonForm.keterangan,
      }, studentScope)
      setMsg(res.error ?? res.success ?? '')
      if (!res.error) { setDiskonModal(null); router.refresh() }
    })
  }

  async function handleBatalDiskon(e: React.FormEvent) {
    e.preventDefault()
    if (!batalDiskonModal) return
    startTransition(async () => {
      const res = await batalkanDiskon(batalDiskonModal.id, studentScope)
      setMsg(res.error ?? res.success ?? '')
      if (!res.error) { setBatalDiskonModal(null); router.refresh() }
    })
  }

  async function handleVoid(e: React.FormEvent) {
    e.preventDefault()
    if (!voidModal) return
    if (!voidAlasan.trim()) { setMsg('Wajib mengisi alasan pembatalan'); return }
    startTransition(async () => {
      try {
        const res = await voidTransaksi(voidModal, voidAlasan, studentScope)
        setMsg(res.error ?? res.success ?? '')
        if (!res.error) { setVoidModal(null); setVoidAlasan(''); router.refresh() }
      } catch {
        setMsg('Gagal membatalkan transaksi. Periksa hak akses atau coba muat ulang halaman.')
      }
    })
  }

  async function handleJanji(e: React.FormEvent) {
    e.preventDefault()
    if (!janjiModal) return
    startTransition(async () => {
      const res = await simpanJanjiBayar({
        siswaId: siswa.id,
        targetType: janjiModal.type,
        targetId: janjiModal.targetId,
        tanggalJanji: janjiForm.tanggal,
        catatan: janjiForm.catatan,
      }, studentScope)
      setMsg(res.error ?? res.success ?? '')
      if (!res.error) { setJanjiModal(null); router.refresh() }
    })
  }

  const dsptSisa = dspt ? Math.max(0, dspt.nominal_target - dspt.total_dibayar - dspt.total_diskon) : 0
  const bayarAmount = parseInt(bayarForm.jumlah || '0') || 0
  const dsptTargetAfterOverpay = dspt ? Math.max(dspt.nominal_target, dspt.total_dibayar + bayarAmount + dspt.total_diskon) : 0
  const isDsptOverpay = bayarModal?.type === 'dspt' && bayarAmount > dsptSisa
  const dsptIsInput = Boolean(dspt) && dspt.status !== 'tidak_ada'
  const dsptProgress = dspt
    ? dspt.nominal_target > 0
      ? Math.min(100, Math.round(((dspt.total_dibayar + dspt.total_diskon) / dspt.nominal_target) * 100))
      : dspt.status === 'lunas'
        ? 100
        : 0
    : 0
  const dsptDiskonList = diskonList.filter((d: any) => d.target_type === 'dspt' && d.target_id === dspt?.id)

  return (
    <div className="space-y-3 pb-8">
      {msg && (
        <p role="status" className={`rounded-md px-3 py-2 text-xs ${msg.includes('berhasil') || msg.includes('disimpan') ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20'}`}>
          {msg}
        </p>
      )}

      <Tabs defaultValue={defaultTab} className="space-y-3">
        <TabsList className="h-8 max-w-full justify-start overflow-x-auto text-xs">
          <TabsTrigger value="dspt" className="h-7 shrink-0 px-3 text-xs">DSPT</TabsTrigger>
          <TabsTrigger value="spp" className="h-7 shrink-0 px-3 text-xs">Tunggakan SPP</TabsTrigger>
          <TabsTrigger value="riwayat" className="h-7 shrink-0 px-3 text-xs">Riwayat Transaksi</TabsTrigger>
        </TabsList>

        {/* ── TAB DSPT ── */}
        <TabsContent value="dspt" className="mt-0 space-y-3">
          {!dspt ? (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
              <p className="mb-3 text-sm text-slate-400">Belum ada tagihan DSPT untuk siswa ini</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="mb-0.5 text-xs text-slate-500 dark:text-slate-400">Status DSPT</p>
                    {(() => {
                      const s = STATUS_MAP[dspt.status as keyof typeof STATUS_MAP] ?? STATUS_MAP.belum_bayar
                      const Icon = s.icon
                      return (
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold ${s.cls}`}>
                          <Icon className="h-3.5 w-3.5" />{s.label}
                        </span>
                      )
                    })()}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {dsptIsInput && dsptSisa > 0 && (
                      <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setBayarModal({ type: 'dspt' })}>
                        <Plus className="h-3.5 w-3.5" /> Catat Bayar
                      </Button>
                    )}
                    {dsptIsInput && (
                      <>
                        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs"
                          onClick={() => { setDiskonForm({ jumlah: '', alasan: 'anak_guru', keterangan: '' }); setDiskonModal({ type: 'dspt', targetId: dspt.id, label: 'DSPT' }) }}>
                          Keringanan
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs"
                          onClick={() => openKuitansiRekap('dspt')}>
                          <Printer className="h-3.5 w-3.5" /> Cetak Kuitansi
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {!dsptIsInput && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-300">
                    Data DSPT siswa ini belum diinput. Isi target DSPT dari halaman daftar DSPT sebelum mencatat pembayaran atau mencetak kuitansi.
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Target</p>
                    <p className="text-sm font-semibold tabular-nums">{dsptIsInput ? formatRupiah(dspt.nominal_target) : '-'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Dibayar</p>
                    <p className="text-sm font-semibold tabular-nums text-emerald-600">{dsptIsInput ? formatRupiah(dspt.total_dibayar) : '-'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Keringanan</p>
                    <p className="text-sm font-semibold tabular-nums text-blue-600">{dsptIsInput ? formatRupiah(dspt.total_diskon) : '-'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Sisa</p>
                    <p className={`text-sm font-bold tabular-nums ${!dsptIsInput ? 'text-slate-500' : dsptSisa > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {dsptIsInput ? formatRupiah(dsptSisa) : '-'}
                    </p>
                  </div>
                </div>
                {dsptIsInput && (
                  <div className="mt-3">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${dsptProgress}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] tabular-nums text-slate-400">{dsptProgress}% terpenuhi</p>
                  </div>
                )}

                {dsptDiskonList.length > 0 && (
                  <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">Rincian Keringanan</p>
                    <div className="space-y-2">
                      {dsptDiskonList.map((d: any) => (
                        <div key={d.id} className="flex items-center justify-between gap-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 dark:border-blue-900/60 dark:bg-blue-900/20">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold tabular-nums text-blue-700 dark:text-blue-300">{formatRupiah(d.jumlah)}</p>
                            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                              {d.alasan?.replace(/_/g, ' ') || 'keringanan'}
                              {d.keterangan ? ` · ${d.keterangan}` : ''}
                              {d.created_at ? ` · ${formatDateWIB(d.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px] text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-900/20"
                            onClick={() => setBatalDiskonModal(d)}
                            disabled={isPending}
                          >
                            <Trash2 className="mr-1 h-3 w-3" /> Batal
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {dsptIsInput && dsptSisa > 0 && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 shrink-0 text-amber-500" />
                    <div>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Janji Bayar</p>
                      {getJanji('dspt', dspt.id)
                        ? <p className="text-sm font-semibold">{formatDateWIB(getJanji('dspt', dspt.id).tanggal_janji, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        : <p className="text-xs text-slate-400">Belum ada janji bayar</p>
                      }
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs"
                    onClick={() => {
                      const j = getJanji('dspt', dspt.id)
                      setJanjiForm({ tanggal: j?.tanggal_janji?.slice(0, 10) ?? '', catatan: j?.catatan ?? '' })
                      setJanjiModal({ type: 'dspt', targetId: dspt.id })
                    }}>
                    {getJanji('dspt', dspt.id) ? 'Ubah' : 'Atur'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── TAB SPP ── */}
        <TabsContent value="spp" className="mt-0 space-y-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/10">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">SPP: hanya tunggakan terdahulu</p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Bagian ini khusus untuk mencatat dan menyelesaikan tunggakan SPP dari kebijakan lama.</p>
          </div>

          {sppSaldoAwal ? (
            <div className={`rounded-xl border px-4 py-3 ${
              sppSaldoAwal.status === 'lunas'
                ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20'
                : sppSaldoAwal.status === 'nyicil'
                  ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
                  : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Tunggakan Awal (Migrasi)</p>
                  <div className="flex flex-wrap gap-4">
                    <div>
                      <p className="text-[11px] text-slate-400">Total</p>
                      <p className="text-sm font-bold tabular-nums text-slate-700 dark:text-slate-200">{formatRupiah(sppSaldoAwal.jumlah)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400">Dibayar</p>
                      <p className="text-sm font-bold tabular-nums text-emerald-600">{formatRupiah(sppSaldoAwal.total_dibayar ?? 0)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400">Sisa</p>
                      <p className={`text-sm font-bold tabular-nums ${sppSaldoAwal.status === 'lunas' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatRupiah(sppSaldoAwal.jumlah - (sppSaldoAwal.total_dibayar ?? 0))}
                      </p>
                    </div>
                  </div>
                  {sppSaldoAwal.keterangan && (
                    <p className="mt-1 text-[11px] text-slate-400">{sppSaldoAwal.keterangan}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {sppSaldoAwal.status === 'lunas' ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">LUNAS</span>
                  ) : (
                    <Button size="sm" className="h-7 bg-blue-600 text-xs text-white hover:bg-blue-700"
                      onClick={() => { setSaldoAwalBayarJumlah(''); setSaldoAwalBayarModal(true) }}>
                      Catat Bayar
                    </Button>
                  )}
                  <button type="button"
                    onClick={() => { setSaldoAwalForm({ jumlah: String(sppSaldoAwal.jumlah), keterangan: sppSaldoAwal.keterangan ?? '' }); setSaldoAwalModal(true) }}
                    className="rounded border border-slate-200 bg-white/60 px-2 py-1 text-[11px] text-slate-500 hover:bg-white dark:border-slate-600 dark:bg-slate-700/60 dark:hover:bg-slate-600">
                    Edit
                  </button>
                </div>
              </div>
              {sppSaldoAwal.jumlah > 0 && (
                <div className="mt-2.5">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${Math.min(100, Math.round(((sppSaldoAwal.total_dibayar ?? 0) / sppSaldoAwal.jumlah) * 100))}%` }} />
                  </div>
                  <p className="mt-0.5 text-[10px] tabular-nums text-slate-400">
                    {Math.round(((sppSaldoAwal.total_dibayar ?? 0) / sppSaldoAwal.jumlah) * 100)}% terbayar
                  </p>
                </div>
              )}
            </div>
          ) : (
            <button type="button"
              onClick={() => { setSaldoAwalForm({ jumlah: '', keterangan: '' }); setSaldoAwalModal(true) }}
              className="text-left text-xs text-slate-400 underline underline-offset-2 hover:text-slate-600 dark:hover:text-slate-300">
              + Tambah tunggakan awal (data migrasi)
            </button>
          )}

          {/* Modal: Catat Bayar Saldo Awal */}
          <Dialog open={saldoAwalBayarModal} onOpenChange={v => { if (!v) setSaldoAwalBayarModal(false) }}>
            <DialogContent className="overflow-hidden rounded-xl p-0 sm:max-w-xs">
              <DialogHeader className="border-b border-blue-200 bg-blue-50 px-5 py-4 dark:border-blue-800 dark:bg-blue-900/20">
                <DialogTitle className="text-sm font-semibold text-blue-800 dark:text-blue-300">Catat Pembayaran Tunggakan Awal</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleBayarSaldoAwal} className="space-y-3 p-5">
                {sppSaldoAwal && (
                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
                    Sisa: <strong className="tabular-nums text-rose-600">{formatRupiah(sppSaldoAwal.jumlah - (sppSaldoAwal.total_dibayar ?? 0))}</strong>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="spp-bayar-jumlah" className="text-xs font-medium">Jumlah Dibayar</Label>
                  <RupiahInput id="spp-bayar-jumlah" min={1} value={saldoAwalBayarJumlah}
                    onValueChange={raw => setSaldoAwalBayarJumlah(raw)}
                    placeholder="0" autoFocus required />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="outline" size="sm" className="h-9 flex-1 text-sm" onClick={() => setSaldoAwalBayarModal(false)}>Batal</Button>
                  <Button type="submit" size="sm" className="h-9 flex-1 text-sm" disabled={isPending || !saldoAwalBayarJumlah}>
                    {isPending ? 'Menyimpan...' : 'Simpan'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Modal: Saldo Awal SPP */}
          <Dialog open={saldoAwalModal} onOpenChange={v => { if (!v) setSaldoAwalModal(false) }}>
            <DialogContent className="overflow-hidden rounded-xl p-0 sm:max-w-xs">
              <DialogHeader className="border-b border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-800 dark:bg-amber-900/20">
                <DialogTitle className="text-sm font-semibold text-amber-800 dark:text-amber-300">Tunggakan Awal SPP</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSaveSaldoAwal} className="space-y-3 p-5">
                <p className="text-xs text-slate-500 dark:text-slate-400">Catat total hutang SPP dari periode sebelum sistem ini dipakai (tanpa rincian bulan).</p>
                <div className="space-y-1.5">
                  <Label htmlFor="spp-saldo-awal-jumlah" className="text-xs font-medium">Jumlah Tunggakan</Label>
                  <RupiahInput id="spp-saldo-awal-jumlah" min={0} value={saldoAwalForm.jumlah}
                    onValueChange={raw => setSaldoAwalForm(f => ({ ...f, jumlah: raw }))}
                    placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="spp-saldo-awal-ket" className="text-xs font-medium">Keterangan (opsional)</Label>
                  <Input id="spp-saldo-awal-ket" value={saldoAwalForm.keterangan}
                    onChange={e => setSaldoAwalForm(f => ({ ...f, keterangan: e.target.value }))}
                    className="h-9 text-sm" placeholder="Misal: tunggakan SPP 2022-2023" />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="outline" size="sm" className="h-9 flex-1 text-sm" onClick={() => setSaldoAwalModal(false)}>Batal</Button>
                  <Button type="submit" size="sm" className="h-9 flex-1 text-sm" disabled={isPending}>Simpan</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ── TAB RIWAYAT TRANSAKSI ── */}
        <TabsContent value="riwayat" className="mt-0">
          <div role="region" aria-label="Tabel riwayat transaksi siswa" tabIndex={0} className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                  <TableHead className="text-xs font-semibold">No. Kuitansi</TableHead>
                  <TableHead className="text-xs font-semibold">Tanggal</TableHead>
                  <TableHead className="text-xs font-semibold">Kategori</TableHead>
                  <TableHead className="text-xs font-semibold">Metode</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Jumlah</TableHead>
                  <TableHead className="text-xs font-semibold">Input oleh</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {transaksi.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-slate-400">Belum ada transaksi</TableCell></TableRow>
                )}
                {transaksi.map((trx: any) => (
                  <TableRow key={trx.id} className={trx.is_void ? 'opacity-50' : ''}>
                    <TableCell className="font-mono text-[11px] text-slate-600 dark:text-slate-300">{trx.nomor_kuitansi}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-slate-600 dark:text-slate-400">
                      {formatDateWIB(trx.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium uppercase text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        {trx.kategori}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 dark:text-slate-400">{trx.metode_bayar === 'tunai' ? 'Tunai' : 'Transfer'}</TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums">{formatRupiah(trx.jumlah_total)}</TableCell>
                    <TableCell className="text-xs text-slate-400">{trx.nama_input}</TableCell>
                    <TableCell>
                      {trx.is_void ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-600">
                          <Ban className="h-2.5 w-2.5" /> Void
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400">
                          <CheckCircle2 className="h-2.5 w-2.5" /> SAH
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {!trx.is_void && !trx.is_synthetic && (
                          <>
                            <Button size="sm" variant="outline" className="h-6 gap-1 px-2 text-[11px]"
                              onClick={() => openKuitansiFromTrx(trx)}>
                              <Printer className="h-2.5 w-2.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-rose-500 hover:bg-rose-50"
                              onClick={() => { setVoidAlasan(''); setVoidModal(trx.id) }}>
                              Void
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Modal Bayar DSPT ── */}
      <Dialog open={!!bayarModal} onOpenChange={v => { if (!v) setBayarModal(null) }}>
        <DialogContent className="overflow-hidden rounded-xl p-0 sm:max-w-sm">
          <DialogHeader className="border-b bg-slate-50 px-5 py-4 dark:bg-slate-800/50">
            <DialogTitle className="text-sm font-semibold">
              Catat Pembayaran {bayarModal?.type?.toUpperCase()}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBayar} className="space-y-4 p-5">
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
              Sisa tagihan: <strong className="tabular-nums text-rose-600">{formatRupiah(dsptSisa)}</strong>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dspt-bayar-jumlah" className="text-xs font-medium">Jumlah Dibayar</Label>
              <RupiahInput id="dspt-bayar-jumlah" min={1} value={bayarForm.jumlah}
                onValueChange={raw => setBayarForm(f => ({ ...f, jumlah: raw }))}
                placeholder="0" autoFocus required />
              {isDsptOverpay && (
                <p className="rounded-md bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                  Nominal melebihi sisa DSPT. Target DSPT akan otomatis diperbarui menjadi {formatRupiah(dsptTargetAfterOverpay)}.
                </p>
              )}
            </div>
            <fieldset className="space-y-1.5">
              <legend className="text-xs font-medium leading-none">Metode Pembayaran</legend>
              <div className="flex gap-3 pt-1">
                {['tunai', 'transfer'].map(m => (
                  <label key={m} className="flex cursor-pointer items-center gap-2">
                    <input type="radio" name="metode" value={m} checked={bayarForm.metode === m}
                      onChange={() => setBayarForm(f => ({ ...f, metode: m }))} />
                    <span className="text-sm capitalize">{m === 'tunai' ? 'Tunai' : 'Transfer Bank'}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {msg && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-600">{msg}</p>}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" className="h-9 flex-1 text-sm" onClick={() => setBayarModal(null)}>Batal</Button>
              <Button type="submit" size="sm" className="h-9 flex-1 text-sm" disabled={isPending || !bayarForm.jumlah}>
                {isPending ? 'Menyimpan...' : 'Simpan & Kuitansi'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal Diskon ── */}
      <Dialog open={!!diskonModal} onOpenChange={v => { if (!v) setDiskonModal(null) }}>
        <DialogContent className="overflow-hidden rounded-xl p-0 sm:max-w-sm">
          <DialogHeader className="border-b border-blue-200 bg-blue-50 px-5 py-4 dark:border-blue-800 dark:bg-blue-900/20">
            <DialogTitle className="text-sm font-semibold text-blue-700 dark:text-blue-400">
              Beri Keringanan — {diskonModal?.label}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleDiskon} className="space-y-4 p-5">
            <div className="space-y-1.5">
              <Label htmlFor="diskon-dspt-jumlah" className="text-xs font-medium">Jumlah Keringanan</Label>
              <RupiahInput id="diskon-dspt-jumlah" min={1} value={diskonForm.jumlah}
                onValueChange={raw => setDiskonForm(f => ({ ...f, jumlah: raw }))}
                placeholder="0" autoFocus required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Alasan</Label>
              <Select value={diskonForm.alasan} onValueChange={v => setDiskonForm(f => ({ ...f, alasan: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="anak_guru">Anak Guru / Pegawai</SelectItem>
                  <SelectItem value="beasiswa">Beasiswa</SelectItem>
                  <SelectItem value="prasejahtera">Siswa Prasejahtera</SelectItem>
                  <SelectItem value="lainnya">Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="diskon-dspt-ket" className="text-xs font-medium">Keterangan Tambahan (opsional)</Label>
              <Input id="diskon-dspt-ket" value={diskonForm.keterangan} onChange={e => setDiskonForm(f => ({ ...f, keterangan: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" className="h-9 flex-1 text-sm" onClick={() => setDiskonModal(null)}>Batal</Button>
              <Button type="submit" size="sm" className="h-9 flex-1 bg-blue-600 text-sm hover:bg-blue-700" disabled={isPending || !diskonForm.jumlah}>
                {isPending ? 'Menyimpan...' : 'Beri Keringanan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Batal Diskon */}
      <Dialog open={!!batalDiskonModal} onOpenChange={v => { if (!v) setBatalDiskonModal(null) }}>
        <DialogContent className="overflow-hidden rounded-xl p-0 sm:max-w-sm">
          <DialogHeader className="border-b border-rose-200 bg-rose-50 px-5 py-4 dark:border-rose-800 dark:bg-rose-900/20">
            <DialogTitle className="text-sm font-semibold text-rose-700 dark:text-rose-400">
              Batalkan Keringanan
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBatalDiskon} className="space-y-4 p-5">
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Keringanan akan dihapus dari tagihan siswa dan status tagihan dihitung ulang.
            </div>
            {batalDiskonModal && (
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400">Nominal keringanan</p>
                <p className="font-semibold tabular-nums text-rose-600">{formatRupiah(batalDiskonModal.jumlah)}</p>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" className="h-9 flex-1 text-sm" onClick={() => setBatalDiskonModal(null)}>Tutup</Button>
              <Button type="submit" variant="destructive" size="sm" className="h-9 flex-1 text-sm" disabled={isPending}>
                {isPending ? 'Memproses...' : 'Batalkan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Void */}
      <Dialog open={!!voidModal} onOpenChange={v => { if (!v) setVoidModal(null) }}>
        <DialogContent className="overflow-hidden rounded-xl p-0 sm:max-w-sm">
          <DialogHeader className="border-b border-rose-200 bg-rose-50 px-5 py-4 dark:border-rose-800 dark:bg-rose-900/20">
            <DialogTitle className="text-sm font-semibold text-rose-700 dark:text-rose-400">
              Batalkan Transaksi (Void)
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleVoid} className="space-y-4 p-5">
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Void akan mengurangi total pembayaran siswa. Tindakan ini dicatat di log audit.
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="void-trx-alasan" className="text-xs font-medium">Alasan Pembatalan <span className="text-rose-500">*</span></Label>
              <Input id="void-trx-alasan" value={voidAlasan} onChange={e => setVoidAlasan(e.target.value)}
                className="h-9 text-sm" placeholder="Jelaskan alasan void..." />
            </div>
            {msg && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-600">{msg}</p>}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" className="h-9 flex-1 text-sm" onClick={() => setVoidModal(null)}>Batal</Button>
              <Button type="submit" variant="destructive" size="sm" className="h-9 flex-1 text-sm" disabled={isPending || !voidAlasan.trim()}>
                {isPending ? 'Memproses...' : 'Konfirmasi Void'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal Janji Bayar ── */}
      <Dialog open={!!janjiModal} onOpenChange={v => { if (!v) setJanjiModal(null) }}>
        <DialogContent className="overflow-hidden rounded-xl p-0 sm:max-w-sm">
          <DialogHeader className="border-b bg-slate-50 px-5 py-4 dark:bg-slate-800/50">
            <DialogTitle className="text-sm font-semibold">Atur Janji Bayar</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleJanji} className="space-y-4 p-5">
            <div className="space-y-1.5">
              <Label htmlFor="janji-tanggal" className="text-xs font-medium">Tanggal Janji</Label>
              <Input id="janji-tanggal" type="date" value={janjiForm.tanggal} onChange={e => setJanjiForm(f => ({ ...f, tanggal: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="janji-catatan" className="text-xs font-medium">Catatan (opsional)</Label>
              <Input id="janji-catatan" value={janjiForm.catatan} onChange={e => setJanjiForm(f => ({ ...f, catatan: e.target.value }))} className="h-9 text-sm" placeholder="Misal: akan bayar gajian bulan depan" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" className="h-9 flex-1 text-sm" onClick={() => setJanjiModal(null)}>Batal</Button>
              <Button type="submit" size="sm" className="h-9 flex-1 text-sm" disabled={isPending || !janjiForm.tanggal}>
                {isPending ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <KuitansiModal
        data={kuitansiData}
        open={kuitansiOpen}
        onClose={() => { setKuitansiOpen(false); setKuitansiData(null) }}
      />
    </div>
  )
}
