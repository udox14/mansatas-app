'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { CheckCircle2, Clock, XCircle, Plus, Printer, AlertTriangle, Ban, Calendar, ChevronLeft, ChevronRight, Pencil } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { catatTransaksi, voidTransaksi, beriDiskon, simpanJanjiBayar, createKoperasiTagihan, getOrCreateSppTagihan, setSppMulaiSiswa, tandaiSppLunas } from '../../actions'
import { KuitansiModal, type KuitansiData } from '../../components/kuitansi-print'

const STATUS_MAP = {
  lunas: { label: 'Lunas', icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  nyicil: { label: 'Nyicil', icon: Clock, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  belum_bayar: { label: 'Belum Bayar', icon: XCircle, cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
}

const BULAN_LABEL = ['', 'Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

export function BukuBesarClient({ data, masterItem, tahunAjaranId }: { data: any; masterItem: any[]; tahunAjaranId?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaultTab = (['dspt', 'spp', 'koperasi', 'riwayat'].includes(searchParams.get('tab') ?? ''))
    ? (searchParams.get('tab') as string)
    : 'dspt'
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState('')
  const [bayarModal, setBayarModal] = useState<{ type: 'dspt' | 'spp' | 'koperasi'; target?: any } | null>(null)
  const [diskonModal, setDiskonModal] = useState<{ type: string; targetId: string; label: string } | null>(null)
  const [voidModal, setVoidModal] = useState<string | null>(null)
  const [janjiModal, setJanjiModal] = useState<{ type: string; targetId: string } | null>(null)
  const [kuitansiData, setKuitansiData] = useState<KuitansiData | null>(null)
  const [kuitansiOpen, setKuitansiOpen] = useState(false)
  const [buatKopModal, setBuatKopModal] = useState(false)
  const [kopItemForm, setKopItemForm] = useState<Array<{ masterItemId: string; namaItem: string; nominal: string; checked: boolean }>>([])

  // Bayar form state
  const [bayarForm, setBayarForm] = useState({ jumlah: '', metode: 'tunai', selectedItems: [] as string[] })
  const [diskonForm, setDiskonForm] = useState({ jumlah: '', alasan: 'anak_guru', keterangan: '' })
  const [voidAlasan, setVoidAlasan] = useState('')
  const [janjiForm, setJanjiForm] = useState({ tanggal: '', catatan: '' })

  const { siswa, dspt, sppTagihan, sppMulai, kopTagihan, kopItems, transaksi, janjiList } = data

  // ── SPP tahun navigation ──────────────────────────────────────────────────
  const [sppTahun, setSppTahun] = useState(() => new Date().getFullYear())
  const [mulaiEditModal, setMulaiEditModal] = useState(false)
  const [mulaiForm, setMulaiForm] = useState({
    bulan: String(sppMulai?.bulan_mulai ?? new Date().getMonth() + 1),
    tahun: String(sppMulai?.bulan_mulai ? sppMulai.tahun_mulai : new Date().getFullYear()),
  })

  // Map: `${bulan}-${tahun}` → tagihan
  const sppTagihanMap = useMemo(() => {
    const map = new Map<string, any>()
    for (const t of sppTagihan) map.set(`${t.bulan}-${t.tahun}`, t)
    return map
  }, [sppTagihan])

  // Apakah bulan ini sebelum tanggal mulai SPP siswa?
  function isBeforeMulai(bulan: number, tahun: number) {
    if (!sppMulai) return false // belum diatur → semua aktif
    if (tahun < sppMulai.tahun_mulai) return true
    if (tahun === sppMulai.tahun_mulai && bulan < sppMulai.bulan_mulai) return true
    return false
  }

  // Apakah bulan ini sudah lewat (nunggak)?
  function isPastMonth(bulan: number, tahun: number) {
    const now = new Date()
    if (tahun < now.getFullYear()) return true
    if (tahun === now.getFullYear() && bulan < now.getMonth() + 1) return true
    return false
  }

  async function handleClickBulanSpp(bulan: number) {
    if (isBeforeMulai(bulan, sppTahun)) return
    startTransition(async () => {
      // 1. Pastikan tagihan ada
      const res = await getOrCreateSppTagihan(siswa.id, bulan, sppTahun)
      if (res.error || !res.data) { setMsg(res.error ?? 'Gagal membuat tagihan'); return }
      if (res.data.status === 'lunas') {
        openKuitansiRekap('spp', res.data)
        return
      }
      // 2. Auto-lunas sesuai nominal setting
      const lunas = await tandaiSppLunas(res.data.id)
      if (lunas.error) { setMsg(lunas.error); return }
      setMsg(`SPP ${BULAN_LABEL[bulan]} ${sppTahun} — lunas`)
      router.refresh()
    })
  }

  // Edit manual SPP (untuk koreksi nominal/jumlah bayar)
  function handleEditSppManual(tagihan: any) {
    setBayarModal({ type: 'spp', target: tagihan })
    setBayarForm({ jumlah: String(tagihan.nominal - tagihan.total_dibayar - tagihan.total_diskon), metode: 'tunai', selectedItems: [] })
  }

  async function handleSaveMulai(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await setSppMulaiSiswa(siswa.id, parseInt(mulaiForm.bulan), parseInt(mulaiForm.tahun))
      setMsg(res.error ?? res.success ?? '')
      if (!res.error) { setMulaiEditModal(false); router.refresh() }
    })
  }

  function getJanji(type: string, id: string) {
    return janjiList.find((j: any) => j.target_type === type && j.target_id === id)
  }

  function openBuatKoperasi() {
    setKopItemForm(masterItem.map(m => ({
      masterItemId: m.id,
      namaItem: m.nama_item,
      nominal: String(m.nominal_default),
      checked: true,
    })))
    setBuatKopModal(true)
  }

  async function handleBuatKoperasi(e: React.FormEvent) {
    e.preventDefault()
    if (!tahunAjaranId) { setMsg('Tahun ajaran aktif tidak ditemukan'); return }
    const items = kopItemForm.filter(i => i.checked && i.namaItem.trim()).map(i => ({
      masterItemId: i.masterItemId,
      namaItem: i.namaItem,
      nominal: parseInt(i.nominal) || 0,
    }))
    if (!items.length) { setMsg('Pilih minimal 1 item'); return }
    startTransition(async () => {
      const res = await createKoperasiTagihan(siswa.id, tahunAjaranId, items)
      setMsg(res.error ?? res.success ?? '')
      if (!res.error) { setBuatKopModal(false); router.refresh() }
    })
  }

  function buildKuitansiData(
    nomorKuitansi: string,
    kategori: 'dspt' | 'spp' | 'koperasi',
    jumlahDiserahkan: number,
    metode: string,
    rincianBayar: KuitansiData['rincianBayar'],
    isLunas: boolean,
    namaPerugas: string = 'Bendahara Komite',
  ): KuitansiData {
    // Hitung sisa tunggakan sesuai kategori
    const sisaTunggakan: KuitansiData['sisaTunggakan'] = []
    if (kategori === 'dspt' && dspt) {
      const sisaDspt = dspt.nominal_target - (dspt.total_dibayar + jumlahDiserahkan) - dspt.total_diskon
      if (sisaDspt > 0) sisaTunggakan.push({ label: 'DSPT', sisa: sisaDspt })
    } else if (kategori === 'koperasi' && kopItems) {
      for (const item of kopItems) {
        if (item.status !== 'lunas') {
          const paid = bayarForm.selectedItems.includes(item.id) ? item.nominal - item.total_dibayar - item.total_diskon : 0
          const sisa = item.nominal - item.total_dibayar - item.total_diskon - paid
          if (sisa > 0) sisaTunggakan.push({ label: item.nama_item, sisa })
        }
      }
    }

    const kelas = siswa.tingkat
      ? `Kelas ${siswa.tingkat}-${siswa.nomor_kelas}${siswa.kelompok ? ' ' + siswa.kelompok : ''}`
      : '-'

    return {
      nomorKuitansi,
      tanggal: new Date().toISOString(),
      kategori: kategori === 'dspt' ? 'DSPT' : kategori === 'spp' ? 'SPP' : 'Koperasi',
      namaSiswa: siswa.nama_lengkap,
      nisn: siswa.nisn ?? '-',
      kelas,
      namaPerugas,
      metodeBayar: metode === 'tunai' ? 'Tunai' : 'Transfer Bank',
      jumlahDiserahkan,
      jumlahTagihan: rincianBayar.reduce((s, i) => s + i.nominal, 0),
      rincianBayar,
      sisaTunggakan,
      isLunas,
    }
  }

  function openKuitansiRekap(
    kategori: 'dspt' | 'spp' | 'koperasi',
    target?: any,  // untuk SPP: baris tagihan
  ) {
    const kelas = siswa.tingkat
      ? `Kelas ${siswa.tingkat}-${siswa.nomor_kelas}${siswa.kelompok ? ' ' + siswa.kelompok : ''}`
      : '-'

    if (kategori === 'dspt' && dspt) {
      const sisa = dspt.nominal_target - dspt.total_dibayar - dspt.total_diskon
      setKuitansiData({
        nomorKuitansi: `REKAP-DSPT`,
        tanggal: new Date().toISOString(),
        kategori: 'DSPT',
        namaSiswa: siswa.nama_lengkap,
        nisn: siswa.nisn ?? '-',
        kelas,
        namaPerugas: 'Bendahara Komite',
        metodeBayar: 'Tunai',
        jumlahDiserahkan: dspt.total_dibayar,
        jumlahTagihan: dspt.nominal_target,
        rincianBayar: [
          { label: 'Target DSPT', nominal: dspt.nominal_target },
          { label: 'Sudah Dibayar', nominal: -dspt.total_dibayar },
          ...(dspt.total_diskon > 0 ? [{ label: 'Keringanan', nominal: -dspt.total_diskon }] : []),
        ],
        sisaTunggakan: sisa > 0 ? [{ label: 'DSPT', sisa }] : [],
        isLunas: dspt.status === 'lunas',
      })
      setKuitansiOpen(true)
    } else if (kategori === 'spp' && target) {
      const sisa = target.nominal - target.total_dibayar - target.total_diskon
      setKuitansiData({
        nomorKuitansi: `REKAP-SPP-${target.bulan}-${target.tahun}`,
        tanggal: new Date().toISOString(),
        kategori: 'SPP',
        namaSiswa: siswa.nama_lengkap,
        nisn: siswa.nisn ?? '-',
        kelas,
        namaPerugas: 'Bendahara Komite',
        metodeBayar: 'Tunai',
        jumlahDiserahkan: target.total_dibayar,
        jumlahTagihan: target.nominal,
        rincianBayar: [
          { label: `SPP ${BULAN_LABEL[target.bulan]} ${target.tahun}`, nominal: target.nominal },
        ],
        sisaTunggakan: sisa > 0 ? [{ label: `SPP ${BULAN_LABEL[target.bulan]} ${target.tahun}`, sisa }] : [],
        isLunas: target.status === 'lunas',
      })
      setKuitansiOpen(true)
    } else if (kategori === 'koperasi' && kopTagihan) {
      const sisa = kopTagihan.total_nominal - kopTagihan.total_dibayar - kopTagihan.total_diskon
      setKuitansiData({
        nomorKuitansi: `REKAP-KOP`,
        tanggal: new Date().toISOString(),
        kategori: 'Koperasi',
        namaSiswa: siswa.nama_lengkap,
        nisn: siswa.nisn ?? '-',
        kelas,
        namaPerugas: 'Bendahara Komite',
        metodeBayar: 'Tunai',
        jumlahDiserahkan: kopTagihan.total_dibayar,
        jumlahTagihan: kopTagihan.total_nominal,
        rincianBayar: kopItems.map((item: any) => ({ label: item.nama_item, nominal: item.nominal })),
        sisaTunggakan: kopItems
          .filter((i: any) => i.status !== 'lunas')
          .map((i: any) => ({ label: i.nama_item, sisa: i.nominal - i.total_dibayar - i.total_diskon })),
        isLunas: kopTagihan.status === 'lunas',
      })
      setKuitansiOpen(true)
    }
  }

  function openKuitansiFromTrx(trx: any) {
    const kelas = siswa.tingkat
      ? `Kelas ${siswa.tingkat}-${siswa.nomor_kelas}${siswa.kelompok ? ' ' + siswa.kelompok : ''}`
      : '-'
    const kategoriLabel = trx.kategori === 'dspt' ? 'DSPT' : trx.kategori === 'spp' ? 'SPP' : 'Koperasi'
    setKuitansiData({
      nomorKuitansi: trx.nomor_kuitansi,
      tanggal: trx.created_at,
      kategori: kategoriLabel,
      namaSiswa: siswa.nama_lengkap,
      nisn: siswa.nisn ?? '-',
      kelas,
      namaPerugas: trx.nama_input ?? 'Bendahara Komite',
      metodeBayar: trx.metode_bayar === 'tunai' ? 'Tunai' : 'Transfer Bank',
      jumlahDiserahkan: trx.jumlah_total,
      jumlahTagihan: trx.jumlah_total,
      rincianBayar: [{ label: `Pembayaran ${kategoriLabel}`, nominal: trx.jumlah_total }],
      sisaTunggakan: [],
      isLunas: trx.kategori === 'dspt'
        ? (dspt?.status === 'lunas')
        : trx.kategori === 'koperasi'
          ? (kopTagihan?.status === 'lunas')
          : (sppTagihan.find((s: any) => s.id === trx.ref_id)?.status === 'lunas'),
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
      if (!bayarForm.jumlah) { setMsg('Masukkan jumlah pembayaran'); return }
      jumlahDibayar = parseInt(bayarForm.jumlah)
      details = [{ refType: 'dspt', refId: dspt.id, jumlah: jumlahDibayar }]
      rincianBayar = [{ label: 'DSPT (Dana Sumbangan Pembangunan Tahunan)', nominal: jumlahDibayar }]
    } else if (bayarModal.type === 'spp' && bayarModal.target) {
      if (!bayarForm.jumlah) { setMsg('Masukkan jumlah pembayaran'); return }
      jumlahDibayar = parseInt(bayarForm.jumlah)
      details = [{ refType: 'spp_tagihan', refId: bayarModal.target.id, jumlah: jumlahDibayar }]
      rincianBayar = [{ label: `SPP ${BULAN_LABEL[bayarModal.target.bulan]} ${bayarModal.target.tahun}`, nominal: jumlahDibayar }]
    } else if (bayarModal.type === 'koperasi') {
      if (!bayarForm.selectedItems.length) { setMsg('Pilih minimal 1 item'); return }
      details = bayarForm.selectedItems.map(itemId => {
        const item = kopItems.find((i: any) => i.id === itemId)
        return { refType: 'koperasi_item', refId: itemId, jumlah: item?.nominal - item?.total_dibayar - item?.total_diskon }
      })
      rincianBayar = bayarForm.selectedItems.map(itemId => {
        const item = kopItems.find((i: any) => i.id === itemId)
        return { label: item?.nama_item ?? '', nominal: item?.nominal - item?.total_dibayar - item?.total_diskon }
      })
      jumlahDibayar = rincianBayar.reduce((s, i) => s + i.nominal, 0)
    }

    startTransition(async () => {
      const res = await catatTransaksi({
        siswaId: siswa.id,
        kategori: bayarModal.type,
        metodeBayar: bayarForm.metode as 'tunai' | 'transfer',
        details,
      })
      if (res.error) { setMsg(res.error); return }
      setBayarModal(null)
      setBayarForm({ jumlah: '', metode: 'tunai', selectedItems: [] })

      if (res.data?.nomorKuitansi) {
        const isLunas = bayarModal.type === 'dspt'
          ? (dspt.nominal_target - (dspt.total_dibayar + jumlahDibayar) - dspt.total_diskon) <= 0
          : bayarModal.type === 'koperasi'
            ? (kopTagihan?.total_nominal - (kopTagihan?.total_dibayar + jumlahDibayar) - kopTagihan?.total_diskon) <= 0
            : (bayarModal.target?.nominal - (bayarModal.target?.total_dibayar + jumlahDibayar) - bayarModal.target?.total_diskon) <= 0

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
      })
      setMsg(res.error ?? res.success ?? '')
      if (!res.error) { setDiskonModal(null); router.refresh() }
    })
  }

  async function handleVoid(e: React.FormEvent) {
    e.preventDefault()
    if (!voidModal) return
    if (!voidAlasan.trim()) { setMsg('Wajib mengisi alasan pembatalan'); return }
    startTransition(async () => {
      const res = await voidTransaksi(voidModal, voidAlasan)
      setMsg(res.error ?? res.success ?? '')
      if (!res.error) { setVoidModal(null); setVoidAlasan(''); router.refresh() }
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
      })
      setMsg(res.error ?? res.success ?? '')
      if (!res.error) { setJanjiModal(null); router.refresh() }
    })
  }

  const dsptSisa = dspt ? dspt.nominal_target - dspt.total_dibayar - dspt.total_diskon : 0

  return (
    <div className="space-y-3 pb-8">
      {msg && (
        <p className={`text-xs px-3 py-2 rounded-md ${msg.includes('berhasil') || msg.includes('disimpan') ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : 'text-rose-600 bg-rose-50 dark:bg-rose-900/20'}`}>
          {msg}
        </p>
      )}

      <Tabs defaultValue={defaultTab} className="space-y-3">
        <TabsList className="h-8 text-xs">
          <TabsTrigger value="dspt" className="text-xs h-7 px-3">DSPT</TabsTrigger>
          <TabsTrigger value="spp" className="text-xs h-7 px-3">SPP</TabsTrigger>
          <TabsTrigger value="koperasi" className="text-xs h-7 px-3">Koperasi</TabsTrigger>
          <TabsTrigger value="riwayat" className="text-xs h-7 px-3">Riwayat Transaksi</TabsTrigger>
        </TabsList>

        {/* ── TAB DSPT ── */}
        <TabsContent value="dspt" className="space-y-3 mt-0">
          {!dspt ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-8 text-center">
              <p className="text-sm text-slate-400 mb-3">Belum ada tagihan DSPT untuk siswa ini</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Summary Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Status DSPT</p>
                    {(() => {
                      const s = STATUS_MAP[dspt.status as keyof typeof STATUS_MAP] ?? STATUS_MAP.belum_bayar
                      const Icon = s.icon
                      return (
                        <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1 rounded-full ${s.cls}`}>
                          <Icon className="h-3.5 w-3.5" />{s.label}
                        </span>
                      )
                    })()}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {dsptSisa > 0 && (
                      <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setBayarModal({ type: 'dspt' })}>
                        <Plus className="h-3.5 w-3.5" /> Catat Bayar
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
                      onClick={() => setDiskonModal({ type: 'dspt', targetId: dspt.id, label: 'DSPT' })}>
                      Keringanan
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
                      onClick={() => openKuitansiRekap('dspt')}>
                      <Printer className="h-3.5 w-3.5" /> Cetak Kuitansi
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <p className="text-[11px] text-slate-500">Target</p>
                    <p className="text-sm font-semibold">{formatRupiah(dspt.nominal_target)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">Dibayar</p>
                    <p className="text-sm font-semibold text-emerald-600">{formatRupiah(dspt.total_dibayar)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">Diskon</p>
                    <p className="text-sm font-semibold text-blue-600">{formatRupiah(dspt.total_diskon)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">Sisa</p>
                    <p className={`text-sm font-bold ${dsptSisa > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatRupiah(dsptSisa)}</p>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="mt-3">
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.round(((dspt.total_dibayar + dspt.total_diskon) / dspt.nominal_target) * 100))}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {Math.round(((dspt.total_dibayar + dspt.total_diskon) / dspt.nominal_target) * 100)}% terpenuhi
                  </p>
                </div>
              </div>

              {/* Janji Bayar */}
              {dsptSisa > 0 && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Janji Bayar</p>
                      {getJanji('dspt', dspt.id)
                        ? <p className="text-sm font-semibold">{new Date(getJanji('dspt', dspt.id).tanggal_janji).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
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
        <TabsContent value="spp" className="space-y-3 mt-0">
          {/* Header: mulai SPP + navigasi tahun */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="text-xs text-slate-500">
                {sppMulai
                  ? <>Mulai SPP: <span className="font-semibold text-slate-700 dark:text-slate-300">{BULAN_LABEL[sppMulai.bulan_mulai]} {sppMulai.tahun_mulai}</span></>
                  : <span className="text-amber-600">Mulai SPP belum diatur</span>
                }
              </div>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-slate-400 hover:text-slate-600"
                title="Atur mulai SPP"
                onClick={() => {
                  setMulaiForm({
                    bulan: String(sppMulai?.bulan_mulai ?? new Date().getMonth() + 1),
                    tahun: String(sppMulai?.tahun_mulai ?? new Date().getFullYear()),
                  })
                  setMulaiEditModal(true)
                }}>
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
            {/* Navigasi tahun */}
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setSppTahun(t => t - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-semibold w-12 text-center">{sppTahun}</span>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setSppTahun(t => t + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Grid 12 kartu bulan */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(bulan => {
              const tagihan = sppTagihanMap.get(`${bulan}-${sppTahun}`)
              const sebelumMulai = isBeforeMulai(bulan, sppTahun)
              const nunggak = tagihan && tagihan.status !== 'lunas' && isPastMonth(bulan, sppTahun)
              const lunas = tagihan?.status === 'lunas'

              return (
                <button
                  key={bulan}
                  type="button"
                  disabled={sebelumMulai || isPending}
                  onClick={() => handleClickBulanSpp(bulan)}
                  className={[
                    'rounded-xl border p-3 text-left transition-all',
                    sebelumMulai
                      ? 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 opacity-40 cursor-not-allowed'
                      : lunas
                        ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 cursor-pointer'
                        : nunggak
                          ? 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 cursor-pointer'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer',
                  ].join(' ')}
                >
                  <p className={`text-sm font-bold mb-1 ${nunggak ? 'text-rose-600' : lunas ? 'text-emerald-600' : 'text-slate-700 dark:text-slate-200'}`}>
                    {BULAN_LABEL[bulan]}
                  </p>
                  {tagihan ? (
                    <>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Tagihan</p>
                      <p className={`text-sm font-semibold ${nunggak ? 'text-rose-600' : lunas ? 'text-emerald-600' : 'text-slate-800 dark:text-slate-200'}`}>
                        {formatRupiah(tagihan.nominal)}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        {nunggak && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400">
                            NUNGGAK
                          </span>
                        )}
                        {lunas && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
                            LUNAS
                          </span>
                        )}
                        {!lunas && (
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); handleEditSppManual(tagihan) }}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300"
                            title="Edit jumlah bayar"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </>
                  ) : sebelumMulai ? (
                    <p className="text-[11px] text-slate-400 italic">Tidak berlaku</p>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">Tap untuk bayar</p>
                  )}
                </button>
              )
            })}
          </div>

          {/* Modal: Atur mulai SPP per siswa */}
          <Dialog open={mulaiEditModal} onOpenChange={v => { if (!v) setMulaiEditModal(false) }}>
            <DialogContent className="sm:max-w-xs rounded-xl p-0 overflow-hidden">
              <DialogHeader className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-b">
                <DialogTitle className="text-sm font-semibold">Atur Mulai SPP — {siswa.nama_lengkap}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSaveMulai} className="p-5 space-y-3">
                <p className="text-xs text-slate-500">Override mulai SPP khusus untuk siswa ini (misalnya siswa baru masuk tengah tahun).</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Bulan Mulai</Label>
                    <Select value={mulaiForm.bulan} onValueChange={v => setMulaiForm(f => ({ ...f, bulan: v }))}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {BULAN_LABEL.slice(1).map((b, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Tahun Mulai</Label>
                    <Input type="number" value={mulaiForm.tahun}
                      onChange={e => setMulaiForm(f => ({ ...f, tahun: e.target.value }))}
                      className="h-9 text-sm" min={2020} max={2040} />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="outline" size="sm" className="flex-1 h-9 text-sm" onClick={() => setMulaiEditModal(false)}>Batal</Button>
                  <Button type="submit" size="sm" className="flex-1 h-9 text-sm" disabled={isPending}>Simpan</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ── TAB KOPERASI ── */}
        <TabsContent value="koperasi" className="space-y-3 mt-0">
          {!kopTagihan ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-8 text-center space-y-3">
              <p className="text-sm text-slate-400">Belum ada tagihan koperasi untuk siswa ini</p>
              {masterItem.length > 0 && (
                <Button size="sm" className="text-xs gap-1.5 h-8" onClick={openBuatKoperasi}>
                  <Plus className="h-3.5 w-3.5" /> Buat Tagihan Koperasi
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs text-slate-500">Status Koperasi</p>
                    {(() => {
                      const s = STATUS_MAP[kopTagihan.status as keyof typeof STATUS_MAP] ?? STATUS_MAP.belum_bayar
                      const Icon = s.icon
                      return (
                        <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1 rounded-full ${s.cls}`}>
                          <Icon className="h-3.5 w-3.5" />{s.label}
                        </span>
                      )
                    })()}
                  </div>
                  <div className="flex gap-2">
                    {kopTagihan.status !== 'lunas' && (
                      <Button size="sm" className="h-8 text-xs gap-1.5"
                        onClick={() => { setBayarForm(f => ({ ...f, selectedItems: [] })); setBayarModal({ type: 'koperasi' }) }}>
                        <Plus className="h-3.5 w-3.5" /> Bayar Item
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
                      onClick={() => openKuitansiRekap('koperasi')}>
                      <Printer className="h-3.5 w-3.5" /> Cetak Kuitansi
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div><p className="text-[11px] text-slate-500">Total Tagihan</p><p className="font-semibold">{formatRupiah(kopTagihan.total_nominal)}</p></div>
                  <div><p className="text-[11px] text-slate-500">Dibayar</p><p className="font-semibold text-emerald-600">{formatRupiah(kopTagihan.total_dibayar)}</p></div>
                  <div><p className="text-[11px] text-slate-500">Sisa</p><p className={`font-bold ${(kopTagihan.total_nominal - kopTagihan.total_dibayar - kopTagihan.total_diskon) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatRupiah(kopTagihan.total_nominal - kopTagihan.total_dibayar - kopTagihan.total_diskon)}</p></div>
                </div>
              </div>

              {/* Item breakdown */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Rincian Item</p>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {kopItems.map((item: any) => {
                    const sisaItem = item.nominal - item.total_dibayar - item.total_diskon
                    return (
                      <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{item.nama_item}</p>
                          <p className="text-[11px] text-slate-400">
                            {formatRupiah(item.nominal)} · Dibayar: {formatRupiah(item.total_dibayar)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                            item.status === 'lunas'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}>
                            {item.status === 'lunas' ? 'Lunas' : formatRupiah(sisaItem) + ' sisa'}
                          </span>
                          {sisaItem > 0 && (
                            <Button size="sm" variant="outline" className="h-6 text-[11px] px-2"
                              onClick={() => setDiskonModal({ type: 'koperasi_item', targetId: item.id, label: item.nama_item })}>
                              Keringanan
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── TAB RIWAYAT TRANSAKSI ── */}
        <TabsContent value="riwayat" className="mt-0">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                  <TableHead className="text-xs font-semibold">No. Kuitansi</TableHead>
                  <TableHead className="text-xs font-semibold">Tanggal</TableHead>
                  <TableHead className="text-xs font-semibold">Kategori</TableHead>
                  <TableHead className="text-xs font-semibold">Metode</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Jumlah</TableHead>
                  <TableHead className="text-xs font-semibold">Input oleh</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {transaksi.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center py-10 text-sm text-slate-400">Belum ada transaksi</TableCell></TableRow>
                )}
                {transaksi.map((trx: any) => (
                  <TableRow key={trx.id} className={trx.is_void ? 'opacity-50' : ''}>
                    <TableCell className="text-[11px] font-mono text-slate-600 dark:text-slate-300">{trx.nomor_kuitansi}</TableCell>
                    <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                      {new Date(trx.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </TableCell>
                    <TableCell>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium uppercase">
                        {trx.kategori}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">{trx.metode_bayar === 'tunai' ? 'Tunai' : 'Transfer'}</TableCell>
                    <TableCell className="text-sm text-right font-semibold">{formatRupiah(trx.jumlah_total)}</TableCell>
                    <TableCell className="text-xs text-slate-400">{trx.nama_input}</TableCell>
                    <TableCell>
                      {trx.is_void ? (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 font-medium">
                          <Ban className="h-2.5 w-2.5" /> Void
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                          <CheckCircle2 className="h-2.5 w-2.5" /> SAH
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {!trx.is_void && (
                          <>
                            <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 gap-1"
                              onClick={() => openKuitansiFromTrx(trx)}>
                              <Printer className="h-2.5 w-2.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2 text-rose-500 hover:bg-rose-50"
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

      {/* ── Modal Bayar DSPT / SPP ── */}
      <Dialog open={!!bayarModal && bayarModal.type !== 'koperasi'} onOpenChange={v => { if (!v) setBayarModal(null) }}>
        <DialogContent className="sm:max-w-sm rounded-xl p-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-b">
            <DialogTitle className="text-sm font-semibold">
              Catat Pembayaran {bayarModal?.type?.toUpperCase()}
              {bayarModal?.type === 'spp' && bayarModal.target && ` — ${BULAN_LABEL[bayarModal.target.bulan]} ${bayarModal.target.tahun}`}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBayar} className="p-5 space-y-4">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm">
              Sisa tagihan: <strong className="text-rose-600">
                {bayarModal?.type === 'dspt' ? formatRupiah(dsptSisa)
                  : bayarModal?.target ? formatRupiah(bayarModal.target.nominal - bayarModal.target.total_dibayar - bayarModal.target.total_diskon)
                  : '-'}
              </strong>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Jumlah Dibayar (Rp)</Label>
              <Input type="number" min={1} value={bayarForm.jumlah}
                onChange={e => setBayarForm(f => ({ ...f, jumlah: e.target.value }))}
                className="h-9 text-sm" placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Metode Pembayaran</Label>
              <div className="flex gap-3">
                {['tunai', 'transfer'].map(m => (
                  <label key={m} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="metode" value={m} checked={bayarForm.metode === m}
                      onChange={() => setBayarForm(f => ({ ...f, metode: m }))} />
                    <span className="text-sm capitalize">{m === 'tunai' ? 'Tunai' : 'Transfer Bank'}</span>
                  </label>
                ))}
              </div>
            </div>
            {msg && <p className="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-md">{msg}</p>}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" className="flex-1 h-9 text-sm" onClick={() => setBayarModal(null)}>Batal</Button>
              <Button type="submit" size="sm" className="flex-1 h-9 text-sm" disabled={isPending}>
                {isPending ? 'Menyimpan...' : 'Simpan & Kuitansi'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal Bayar Koperasi (ceklis item) ── */}
      <Dialog open={!!bayarModal && bayarModal.type === 'koperasi'} onOpenChange={v => { if (!v) setBayarModal(null) }}>
        <DialogContent className="sm:max-w-md rounded-xl p-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-b">
            <DialogTitle className="text-sm font-semibold">Bayar Koperasi — Pilih Item</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBayar} className="p-5 space-y-4">
            <div className="space-y-2">
              {kopItems.filter((i: any) => i.status !== 'lunas').map((item: any) => {
                const sisaItem = item.nominal - item.total_dibayar - item.total_diskon
                const checked = bayarForm.selectedItems.includes(item.id)
                return (
                  <label key={item.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    checked ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700'
                  }`}>
                    <input type="checkbox" checked={checked}
                      onChange={() => setBayarForm(f => ({
                        ...f,
                        selectedItems: checked
                          ? f.selectedItems.filter(id => id !== item.id)
                          : [...f.selectedItems, item.id]
                      }))}
                      className="rounded" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{item.nama_item}</p>
                      <p className="text-[11px] text-slate-400">Sisa: {formatRupiah(sisaItem)}</p>
                    </div>
                  </label>
                )
              })}
              {kopItems.filter((i: any) => i.status !== 'lunas').length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">Semua item sudah lunas</p>
              )}
            </div>
            {bayarForm.selectedItems.length > 0 && (
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm">
                Total bayar: <strong className="text-emerald-600">
                  {formatRupiah(bayarForm.selectedItems.reduce((sum, id) => {
                    const item = kopItems.find((i: any) => i.id === id)
                    return sum + (item ? item.nominal - item.total_dibayar - item.total_diskon : 0)
                  }, 0))}
                </strong>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Metode Pembayaran</Label>
              <div className="flex gap-3">
                {['tunai', 'transfer'].map(m => (
                  <label key={m} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="metode_kop" value={m} checked={bayarForm.metode === m}
                      onChange={() => setBayarForm(f => ({ ...f, metode: m }))} />
                    <span className="text-sm">{m === 'tunai' ? 'Tunai' : 'Transfer Bank'}</span>
                  </label>
                ))}
              </div>
            </div>
            {msg && <p className="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-md">{msg}</p>}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" className="flex-1 h-9 text-sm" onClick={() => setBayarModal(null)}>Batal</Button>
              <Button type="submit" size="sm" className="flex-1 h-9 text-sm" disabled={isPending || !bayarForm.selectedItems.length}>
                {isPending ? 'Menyimpan...' : 'Simpan & Kuitansi'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal Diskon ── */}
      <Dialog open={!!diskonModal} onOpenChange={v => { if (!v) setDiskonModal(null) }}>
        <DialogContent className="sm:max-w-sm rounded-xl p-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
            <DialogTitle className="text-sm font-semibold text-blue-700 dark:text-blue-400">
              Beri Keringanan — {diskonModal?.label}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleDiskon} className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Jumlah Keringanan (Rp)</Label>
              <Input type="number" min={1} value={diskonForm.jumlah}
                onChange={e => setDiskonForm(f => ({ ...f, jumlah: e.target.value }))}
                className="h-9 text-sm" placeholder="0" />
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
              <Label className="text-xs font-medium">Keterangan Tambahan (opsional)</Label>
              <Input value={diskonForm.keterangan} onChange={e => setDiskonForm(f => ({ ...f, keterangan: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" className="flex-1 h-9 text-sm" onClick={() => setDiskonModal(null)}>Batal</Button>
              <Button type="submit" size="sm" className="flex-1 h-9 text-sm bg-blue-600 hover:bg-blue-700" disabled={isPending}>
                {isPending ? 'Menyimpan...' : 'Beri Keringanan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal Void ── */}
      <Dialog open={!!voidModal} onOpenChange={v => { if (!v) setVoidModal(null) }}>
        <DialogContent className="sm:max-w-sm rounded-xl p-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 bg-rose-50 dark:bg-rose-900/20 border-b border-rose-200 dark:border-rose-800">
            <DialogTitle className="text-sm font-semibold text-rose-700 dark:text-rose-400">
              Batalkan Transaksi (Void)
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleVoid} className="p-5 space-y-4">
            <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              Void akan mengurangi total pembayaran siswa. Tindakan ini dicatat di log audit.
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Alasan Pembatalan <span className="text-rose-500">*</span></Label>
              <Input value={voidAlasan} onChange={e => setVoidAlasan(e.target.value)}
                className="h-9 text-sm" placeholder="Jelaskan alasan void..." />
            </div>
            {msg && <p className="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-md">{msg}</p>}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" className="flex-1 h-9 text-sm" onClick={() => setVoidModal(null)}>Batal</Button>
              <Button type="submit" variant="destructive" size="sm" className="flex-1 h-9 text-sm" disabled={isPending || !voidAlasan.trim()}>
                {isPending ? 'Memproses...' : 'Konfirmasi Void'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal Janji Bayar ── */}
      <Dialog open={!!janjiModal} onOpenChange={v => { if (!v) setJanjiModal(null) }}>
        <DialogContent className="sm:max-w-sm rounded-xl p-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-b">
            <DialogTitle className="text-sm font-semibold">Atur Janji Bayar</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleJanji} className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tanggal Janji</Label>
              <Input type="date" value={janjiForm.tanggal} onChange={e => setJanjiForm(f => ({ ...f, tanggal: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Catatan (opsional)</Label>
              <Input value={janjiForm.catatan} onChange={e => setJanjiForm(f => ({ ...f, catatan: e.target.value }))} className="h-9 text-sm" placeholder="Misal: akan bayar gajian bulan depan" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" className="flex-1 h-9 text-sm" onClick={() => setJanjiModal(null)}>Batal</Button>
              <Button type="submit" size="sm" className="flex-1 h-9 text-sm" disabled={isPending || !janjiForm.tanggal}>
                {isPending ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal Buat Tagihan Koperasi ── */}
      <Dialog open={buatKopModal} onOpenChange={v => { if (!v) setBuatKopModal(false) }}>
        <DialogContent className="sm:max-w-md rounded-xl p-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-b">
            <DialogTitle className="text-sm font-semibold">Buat Tagihan Koperasi</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBuatKoperasi} className="p-5 space-y-4">
            <p className="text-xs text-slate-500">Centang item yang dikenakan untuk siswa ini. Nominal bisa disesuaikan.</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {kopItemForm.map((item, idx) => (
                <div key={item.masterItemId} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  item.checked ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700' : 'border-slate-200 dark:border-slate-700'
                }`}>
                  <input type="checkbox" checked={item.checked}
                    onChange={() => setKopItemForm(f => f.map((r, i) => i === idx ? { ...r, checked: !r.checked } : r))}
                    className="rounded flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{item.namaItem}</p>
                  </div>
                  <Input
                    type="number"
                    value={item.nominal}
                    onChange={e => setKopItemForm(f => f.map((r, i) => i === idx ? { ...r, nominal: e.target.value } : r))}
                    className="w-32 h-7 text-xs text-right"
                    disabled={!item.checked}
                  />
                </div>
              ))}
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm">
              Total: <strong>{formatRupiah(kopItemForm.filter(i => i.checked).reduce((s, i) => s + (parseInt(i.nominal) || 0), 0))}</strong>
            </div>
            {msg && <p className="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-md">{msg}</p>}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" className="flex-1 h-9 text-sm" onClick={() => setBuatKopModal(false)}>Batal</Button>
              <Button type="submit" size="sm" className="flex-1 h-9 text-sm" disabled={isPending}>
                {isPending ? 'Menyimpan...' : 'Buat Tagihan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Kuitansi Modal (react-to-print A4) ── */}
      <KuitansiModal
        data={kuitansiData}
        open={kuitansiOpen}
        onClose={() => { setKuitansiOpen(false); setKuitansiData(null) }}
      />
    </div>
  )
}
