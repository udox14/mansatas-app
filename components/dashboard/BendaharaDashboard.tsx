// components/dashboard/BendaharaDashboard.tsx
import Link from 'next/link'
import { getDB } from '@/utils/db'
import { WelcomeStrip } from './shared/WelcomeStrip'
import {
  Landmark, FileText, ShoppingBag, TrendingDown,
  ChevronRight, TrendingUp, AlertCircle, CheckCircle2, Clock,
} from 'lucide-react'
import { formatRupiah } from '@/lib/utils'

type Props = {
  userId: string; nama: string; namaDepan: string; avatarUrl: string | null
  roleLabel: string; roleColor: string; sapaan: string
  taAktif: { id?: string; nama: string; semester: number } | null
}

export async function BendaharaDashboard({ userId, nama, namaDepan, avatarUrl, roleLabel, roleColor, sapaan, taAktif }: Props) {
  const db = await getDB()
  const tahun = new Date().getFullYear()
  const bulanIni = new Date().getMonth() + 1

  const [dspt, sppTunggakan, koperasi, kasKeluar, transaksiTerbaru] = await Promise.all([
    db.prepare(`
      SELECT
        COUNT(*) as total,
        COALESCE(SUM(nominal_target), 0) as target,
        COALESCE(SUM(total_dibayar), 0) as terkumpul,
        SUM(CASE WHEN status='lunas' THEN 1 ELSE 0 END) as lunas,
        SUM(CASE WHEN status='nyicil' THEN 1 ELSE 0 END) as nyicil,
        SUM(CASE WHEN status='belum_bayar' THEN 1 ELSE 0 END) as belum_bayar
      FROM fin_dspt
    `).first<any>(),

    db.prepare(`
      SELECT
        COUNT(*) as total,
        COALESCE(SUM(jumlah), 0) as target,
        COALESCE(SUM(total_dibayar), 0) as terkumpul,
        SUM(CASE WHEN status='lunas' THEN 1 ELSE 0 END) as lunas,
        SUM(CASE WHEN status!='lunas' AND jumlah > total_dibayar THEN 1 ELSE 0 END) as belum_lunas
      FROM fin_spp_saldo_awal
    `).first<any>(),

    db.prepare(`
      SELECT
        COUNT(*) as total,
        COALESCE(SUM(total_nominal), 0) as target,
        COALESCE(SUM(total_dibayar), 0) as terkumpul,
        SUM(CASE WHEN status='lunas' THEN 1 ELSE 0 END) as lunas
      FROM fin_koperasi_tagihan
    `).first<any>(),

    db.prepare(`
      SELECT COALESCE(SUM(jumlah), 0) as total
      FROM fin_kas_keluar WHERE strftime('%Y-%m', tanggal) = ?
    `).bind(`${tahun}-${String(bulanIni).padStart(2, '0')}`).first<{ total: number }>(),

    db.prepare(`
      SELECT t.id, t.siswa_id, t.nomor_kuitansi, t.kategori, t.jumlah_total, t.created_at,
             s.nama_lengkap, u.nama_lengkap as petugas
      FROM fin_transaksi t
      JOIN siswa s ON s.id = t.siswa_id
      LEFT JOIN "user" u ON u.id = t.input_oleh
      WHERE t.is_void = 0
      ORDER BY t.created_at DESC LIMIT 5
    `).all<any>(),
  ])

  const dsptPersen = (dspt?.total ?? 0) > 0 ? Math.round(((dspt?.lunas ?? 0) / dspt.total) * 100) : 0
  const sppPersen  = (sppTunggakan?.target ?? 0) > 0 ? Math.round(((sppTunggakan?.terkumpul ?? 0) / sppTunggakan.target) * 100) : 0
  const kopPersen  = (koperasi?.total ?? 0) > 0 ? Math.round(((koperasi?.lunas ?? 0) / koperasi.total) * 100) : 0

  const BULAN_LABEL = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

  const quickLinks = [
    { href: '/dashboard/keuangan/dspt',       label: 'DSPT',       icon: Landmark,     color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
    { href: '/dashboard/keuangan/spp',        label: 'SPP',        icon: FileText,     color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' },
    { href: '/dashboard/keuangan/koperasi',   label: 'Koperasi',   icon: ShoppingBag,  color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' },
    { href: '/dashboard/keuangan/kas-keluar', label: 'Kas Keluar', icon: TrendingDown, color: 'text-rose-600 bg-rose-50 dark:bg-rose-900/20' },
    { href: '/dashboard/keuangan/laporan',    label: 'Laporan',    icon: TrendingUp,   color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20' },
  ]

  return (
    <div className="space-y-3 animate-in fade-in duration-500 pb-12">
      <WelcomeStrip nama={nama} namaDepan={namaDepan} avatarUrl={avatarUrl}
        roleLabel={roleLabel} roleColor={roleColor} taAktif={taAktif} sapaan={sapaan} />

      {/* Quick Links */}
      <div className="grid grid-cols-5 gap-2">
        {quickLinks.map(({ href, label, icon: Icon, color }) => (
          <Link key={href} href={href}
            className="flex flex-col items-center gap-1.5 bg-surface border border-surface rounded-xl py-3 px-2 hover:bg-surface-2 transition-colors">
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${color}`}>
              <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
            </div>
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 text-center leading-tight">{label}</span>
          </Link>
        ))}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* DSPT */}
        <div className="bg-surface border border-surface rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                <Landmark className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">DSPT</p>
                <p className="text-[10px] text-slate-400">Keseluruhan</p>
              </div>
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${dsptPersen >= 80 ? 'bg-emerald-100 text-emerald-700' : dsptPersen >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
              {dsptPersen}%
            </span>
          </div>
          <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
            <div className="h-1.5 bg-blue-500 rounded-full transition-all" style={{ width: `${dsptPersen}%` }} />
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Terkumpul</span>
            <span className="font-semibold text-blue-600">{formatRupiah(dspt?.terkumpul ?? 0)}</span>
          </div>
          <div className="flex gap-2 pt-0.5">
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
              <CheckCircle2 className="h-2.5 w-2.5" />{dspt?.lunas ?? 0} lunas
            </span>
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
              <Clock className="h-2.5 w-2.5" />{dspt?.nyicil ?? 0} nyicil
            </span>
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-medium">
              <AlertCircle className="h-2.5 w-2.5" />{dspt?.belum_bayar ?? 0} belum
            </span>
          </div>
        </div>

        {/* SPP tunggakan terdahulu */}
        <div className="bg-surface border border-surface rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                <FileText className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">SPP</p>
                <p className="text-[10px] text-slate-400">Tunggakan terdahulu</p>
              </div>
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sppPersen >= 80 ? 'bg-emerald-100 text-emerald-700' : sppPersen >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
              {sppPersen}%
            </span>
          </div>
          <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
            <div className="h-1.5 bg-emerald-500 rounded-full transition-all" style={{ width: `${sppPersen}%` }} />
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Terkumpul</span>
            <span className="font-semibold text-emerald-600">{formatRupiah(sppTunggakan?.terkumpul ?? 0)}</span>
          </div>
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>{sppTunggakan?.belum_lunas ?? 0} siswa masih punya tunggakan</span>
          </div>
        </div>

        {/* Koperasi */}
        <div className="bg-surface border border-surface rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                <ShoppingBag className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Koperasi</p>
                <p className="text-[10px] text-slate-400">Keseluruhan</p>
              </div>
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${kopPersen >= 80 ? 'bg-emerald-100 text-emerald-700' : kopPersen >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
              {kopPersen}%
            </span>
          </div>
          <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
            <div className="h-1.5 bg-amber-500 rounded-full transition-all" style={{ width: `${kopPersen}%` }} />
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Terkumpul</span>
            <span className="font-semibold text-amber-600">{formatRupiah(koperasi?.terkumpul ?? 0)}</span>
          </div>
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>{koperasi?.lunas ?? 0} dari {koperasi?.total ?? 0} siswa lunas</span>
          </div>
        </div>
      </div>

      {/* Kas Keluar bulan ini + Transaksi terbaru */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Kas Keluar */}
        <div className="bg-surface border border-surface rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center">
                <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
              </div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Kas Keluar Bulan Ini</p>
            </div>
            <Link href="/dashboard/keuangan/kas-keluar" className="text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-0.5">
              Detail <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{formatRupiah(kasKeluar?.total ?? 0)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{BULAN_LABEL[bulanIni]} {tahun}</p>
        </div>

        {/* Transaksi terbaru */}
        <div className="bg-surface border border-surface rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Transaksi Terbaru</p>
            <Link href="/dashboard/keuangan/transaksi" className="text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-0.5">
              Semua <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {(transaksiTerbaru.results ?? []).length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">Belum ada transaksi</p>
          ) : (
            <div className="space-y-2">
              {(transaksiTerbaru.results ?? []).map((t: any) => (
                <Link
                  key={t.id}
                  href="/dashboard/keuangan/transaksi"
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 -mx-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate">{t.nama_lengkap}</p>
                    <p className="text-[10px] text-slate-400">{t.kategori.toUpperCase()} · {t.nomor_kuitansi}</p>
                  </div>
                  <span className="text-xs font-semibold text-emerald-600 shrink-0">{formatRupiah(t.jumlah_total)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
