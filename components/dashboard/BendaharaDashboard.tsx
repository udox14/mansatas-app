import { DashboardCohortCards } from './cohort-cards'
import { cashCohortMetric, listActiveKomiteCohorts } from '@/lib/komite-cohorts'
import { isKomiteFundScope, listKomiteFundOptions } from '@/lib/komite-funds'
import Link from 'next/link'
import {
  AlertTriangle, ArrowRight, Banknote, CheckCircle2, ClipboardCheck,
  FileCheck2, FileSpreadsheet, FileText, HandCoins, Landmark,
  ReceiptText, Settings, TrendingDown, TrendingUp, WalletCards,
} from 'lucide-react'
import { getDB } from '@/utils/db-server'
import { formatRupiah } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  canAccessFinanceFeature,
  loadBendaharaDashboardData,
  loadBendaharaCashPosition,
  type DashboardSection,
  type LegacyArrearsSummary,
  type QueueSummary,
} from '@/lib/bendahara-dashboard'
import { KehadiranPribadiCard } from './shared/KehadiranPribadiCard'
import { PenugasanMasukCard } from './shared/PenugasanMasukCard'

type Props = {
  userId: string
  isGuruPiket?: boolean
  dashboardVisibility?: Record<string, boolean>
  allowedFeatures: string[]
  period?: string | null
  fund?: string
}

const shortcuts = [
  { feature: 'komite-pengajuan', href: '/dashboard/komite/pengajuan', label: 'Pengajuan & SPB', desc: 'Review, petakan sumber, & cairkan SPB', icon: FileCheck2 },
  { feature: 'keuangan-rapbm', href: '/dashboard/keuangan/rapbm', label: 'RAPBM & Pagu', desc: 'Pagu anggaran & rincian belanja komite', icon: FileSpreadsheet },
  { feature: 'keuangan-dspt', href: '/dashboard/keuangan/dspt', label: 'Tagihan DSPT & SPP', desc: 'Tagihan siswa aktif, nonaktif, & bukti bayar', icon: HandCoins },
  { feature: 'keuangan-daftar-ulang', href: '/dashboard/keuangan/daftar-ulang', label: 'Kasir Daftar Ulang', desc: 'Pembayaran & kuitansi siswa baru', icon: ClipboardCheck },
  { feature: 'keuangan-transaksi', href: '/dashboard/keuangan/transaksi', label: 'Pembayaran Siswa', desc: 'Histori pembayaran & cetak ulang kuitansi', icon: ReceiptText },
  { feature: 'keuangan-kas-keluar', href: '/dashboard/keuangan/kas-keluar', label: 'Arus Kas', desc: 'Pemasukan lain, pengeluaran, & pemetaan', icon: WalletCards },
  { feature: 'keuangan-laporan', href: '/dashboard/keuangan/laporan', label: 'Laporan & BKU', desc: 'Buku Kas Umum resmi PDF & Excel', icon: FileText },
  { feature: 'keuangan-pengaturan', href: '/dashboard/keuangan/pengaturan', label: 'Pengaturan Komite', desc: 'Rekening, QRIS, target DSPT, & saldo awal', icon: Settings },
] as const

const tones: Record<string, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

export async function BendaharaDashboard({ userId, isGuruPiket, dashboardVisibility, allowedFeatures, period, fund }: Props) {
  const show = (id: string) => dashboardVisibility?.[id] !== false
  const db = await getDB()
  const source = isKomiteFundScope(fund) ? fund : 'all'
  const [data, options, activeYears] = await Promise.all([
    loadBendaharaDashboardData({ db, userId, period, fund: source, allowedFeatures }),
    listKomiteFundOptions(db),
    listActiveKomiteCohorts(db),
  ])
  const metrics = Object.fromEntries(await Promise.all(
    ['all', ...activeYears.map(String)].map(async scope => {
      const position = scope === source ? data.cashPosition : show('cash_position') && data.cashPosition
        ? await loadBendaharaCashPosition(db, data.period, scope === 'all' ? undefined : scope).then(
          result => ({ status: 'ready' as const, data: result }), () => null)
        : null
      if (position?.status !== 'ready') return [scope, undefined] as const
      const { totalIncome, totalExpense, endingBalance } = position.data
      return [scope, cashCohortMetric(totalIncome, totalExpense, endingBalance, 'Saldo akhir')] as const
    })
  ))
  const studentQuery = /^\d{4}$/.test(source) ? `?angkatan=${source}` : ''

  const fundQuery = source === 'all' ? '' : `?fund=${source}`
  const visibleShortcuts = shortcuts.filter(item => canAccessFinanceFeature(allowedFeatures, item.feature))
  const queueCards = [
    data.paymentQueue && { title: 'Bukti bayar siswa', description: 'Menunggu konfirmasi Bendahara', href: '/dashboard/keuangan/dspt', icon: ReceiptText, section: data.paymentQueue },
    data.approvalQueue && { title: 'Review pengajuan', description: 'Menunggu verifikasi Bendahara', href: '/dashboard/komite/pengajuan?tab=review', icon: FileCheck2, section: data.approvalQueue },
    data.releaseQueue && { title: 'Realisasi SPB', description: 'Disetujui, belum dicairkan', href: `/dashboard/komite/pengajuan?tab=approved&pending=1&fund=${source}`, icon: Banknote, section: data.releaseQueue },
  ].filter(Boolean) as Array<{ title: string; description: string; href: string; icon: typeof ReceiptText; section: DashboardSection<QueueSummary> }>

  return (
    <div className="space-y-5 animate-in fade-in duration-500 pb-12">
      <Card className="border-slate-200 bg-white shadow-none dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="flex flex-col gap-3 p-4 pt-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 sm:pt-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              <WalletCards className="h-4 w-4" /> Ringkasan Keuangan Komite
            </div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white sm:text-xl">
              Periode {data.periodLabel}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
              Pantau antrean kerja, posisi buku kas, dan capaian tagihan siswa.
            </p>
          </div>
          <form action="/dashboard" method="get" className="flex flex-wrap items-center gap-2">
            <label htmlFor="dashboard-period" className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Bulan
            </label>
            <input
              id="dashboard-period"
              name="period"
              type="month"
              defaultValue={data.period}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <input type="hidden" name="fund" value={source} />
            <Button type="submit" variant="outline" size="sm" className="h-9 px-3 text-xs font-semibold">
              Tampilkan
            </Button>
          </form>
        </CardContent>
      </Card>

      {show('cash_position') && data.cashPosition && (
        <DashboardCohortCards
          activeYears={activeYears}
          years={options.years}
          value={source}
          period={data.period}
          cashScopes
          compact
          metrics={metrics}
        />
      )}

      {show('attention_queue') && queueCards.length > 0 && (
        <section aria-labelledby="queue-title" className="space-y-2.5">
          <SectionHeading id="queue-title" title="Perlu Ditindaklanjuti" description="Antrean operasional yang menunggu tindakan" />
          <div className="grid gap-2.5 md:grid-cols-3">
            {queueCards.map(card => <QueueCard key={card.title} {...card} />)}
          </div>
        </section>
      )}

      {show('cash_position') && data.cashPosition && (
        <section aria-labelledby="cash-position-title" className="space-y-2.5">
          <SectionHeading id="cash-position-title" title="Posisi Kas" description="Saldo bulan terpilih berdasarkan buku kas komite" href={`/dashboard/keuangan/laporan${fundQuery}`} />
          {data.cashPosition.status === 'unavailable' ? <UnavailableCard /> : (
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              <MoneyCard title="Saldo awal" value={data.cashPosition.data.openingBalance} icon={Landmark} tone="slate" />
              <MoneyCard title="Pemasukan" value={data.cashPosition.data.totalIncome} icon={TrendingUp} tone="emerald" />
              <MoneyCard title="Pengeluaran" value={data.cashPosition.data.totalExpense} icon={TrendingDown} tone="rose" />
              <MoneyCard title="Saldo akhir" value={data.cashPosition.data.endingBalance} icon={WalletCards} tone="emerald" emphasis />
            </div>
          )}
        </section>
      )}

      {show('stat_keuangan') && (data.dspt || data.legacySpp || data.inactiveArrears) && (
        <section aria-labelledby="collection-title" className="space-y-2.5">
          <SectionHeading id="collection-title" title="Kesehatan Tagihan" description="Capaian pembayaran dan sisa kewajiban siswa" href={`/dashboard/keuangan/dspt${studentQuery}`} />
          <div className="grid gap-2.5 lg:grid-cols-3">
            {data.dspt && (data.dspt.status === 'ready' ? <CollectionCard title="DSPT siswa aktif" data={data.dspt.data} href={`/dashboard/keuangan/dspt${studentQuery}`} /> : <UnavailableCard />)}
            {data.legacySpp && (data.legacySpp.status === 'ready' ? <ArrearsCard title="Tunggakan SPP lama" data={data.legacySpp.data} href={`/dashboard/keuangan/dspt${studentQuery ? `${studentQuery}&jenis=SPP` : '?jenis=SPP'}`} /> : <UnavailableCard />)}
            {data.inactiveArrears && (data.inactiveArrears.status === 'ready' ? <ArrearsCard title="Siswa nonaktif / alumni" data={data.inactiveArrears.data} href="/dashboard/keuangan/dspt/nonaktif" warning /> : <UnavailableCard />)}
          </div>
        </section>
      )}

      {show('quick_links') && visibleShortcuts.length > 0 && (
        <section aria-labelledby="shortcut-title" className="space-y-2.5">
          <SectionHeading id="shortcut-title" title="Modul Keuangan Komite" description="Akses langsung seluruh modul komite" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {visibleShortcuts.map(({ feature, href, label, desc, icon: Icon }) => (
              <Link
                key={feature}
                href={
                  ['keuangan-laporan', 'keuangan-kas-keluar'].includes(feature)
                    ? href + fundQuery
                    : ['keuangan-transaksi', 'keuangan-dspt'].includes(feature)
                      ? href + studentQuery
                      : href
                }
                className="group block"
              >
                <Card className="flex min-h-[72px] items-center gap-3 border-slate-200 bg-white p-3 shadow-none transition-colors hover:border-emerald-300 hover:bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-800/50">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 transition-colors group-hover:bg-emerald-50 group-hover:text-emerald-700 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-emerald-950/50 dark:group-hover:text-emerald-300">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">{desc}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" />
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {show('kas_transaksi') && data.cashPosition && (
        <section aria-labelledby="activity-title" className="space-y-2.5">
          <SectionHeading id="activity-title" title="Aktivitas Kas Terbaru" description={`Transaksi pada ${data.periodLabel.toLocaleLowerCase('id-ID')}`} href={`/dashboard/keuangan/kas-keluar${fundQuery}`} />
          {data.cashPosition.status === 'unavailable' ? <UnavailableCard /> : data.cashPosition.data.recentRows.length === 0 ? (
            <Card className="border-dashed border-slate-300 bg-white shadow-none dark:border-slate-700 dark:bg-slate-900">
              <CardContent className="px-4 py-8 pt-8 text-center text-sm text-slate-500">Belum ada aktivitas kas pada periode ini.</CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden border-slate-200 bg-white shadow-none dark:border-slate-800 dark:bg-slate-900">
              {data.cashPosition.data.recentRows.map((row, index) => (
                <div key={row.id} className={`flex items-center gap-3 px-4 py-3 ${index ? 'border-t border-slate-100 dark:border-slate-800' : ''}`}>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${row.direction === 'income' ? tones.emerald : tones.rose}`}>
                    {row.direction === 'income' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{row.description}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{formatDate(row.transactionDate)}{row.proofNumber ? ` · ${row.proofNumber}` : ''}</p>
                  </div>
                  <p className={`shrink-0 text-sm font-bold tabular-nums ${row.direction === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {row.direction === 'income' ? '+' : '-'}{formatRupiah(row.amount)}
                  </p>
                </div>
              ))}
            </Card>
          )}
        </section>
      )}

      <div className="space-y-3 pt-1">
        {isGuruPiket && <PenugasanMasukCard userId={userId} />}
        {show('kehadiran_pribadi') && <KehadiranPribadiCard userId={userId} />}
      </div>
    </div>
  )
}

function SectionHeading({ id, title, description, href }: { id: string; title: string; description: string; href?: string }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <h3 id={id} className="text-sm font-bold text-slate-900 dark:text-white sm:text-base">{title}</h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      {href && (
        <Button asChild variant="ghost" size="sm" className="h-8 shrink-0 gap-1 px-2 text-xs text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/40">
          <Link href={href}>Lihat detail <ArrowRight className="h-3.5 w-3.5" /></Link>
        </Button>
      )}
    </div>
  )
}

function MoneyCard({ title, value, icon: Icon, tone, emphasis }: { title: string; value: number; icon: typeof Landmark; tone: string; emphasis?: boolean }) {
  return (
    <Card className={`h-full shadow-none ${emphasis ? 'border-emerald-300 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
      <CardContent className="p-3.5 pt-3.5 sm:p-4 sm:pt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tones[tone]}`}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        </div>
        <p className="mt-2 break-words text-base font-bold tracking-tight text-slate-900 tabular-nums dark:text-white sm:text-lg">
          {formatRupiah(value)}
        </p>
      </CardContent>
    </Card>
  )
}

function QueueCard({ title, description, href, icon: Icon, section }: { title: string; description: string; href: string; icon: typeof ReceiptText; section: DashboardSection<QueueSummary> }) {
  if (section.status === 'unavailable') return <UnavailableCard />
  const { count, amount, oldestAt } = section.data
  const hasPending = count > 0
  return (
    <Link href={href} className="group block">
      <Card className={`h-full shadow-none transition-colors ${hasPending ? 'border-amber-200 bg-amber-50/40 hover:border-amber-300 dark:border-amber-900/70 dark:bg-amber-950/20' : 'border-slate-200 bg-white hover:bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900'}`}>
        <CardContent className="p-3.5 pt-3.5 sm:p-4 sm:pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${hasPending ? tones.amber : tones.slate}`}>
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
              </div>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums ${hasPending ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
              {count}
            </span>
          </div>
          {(amount > 0 || oldestAt) && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-xs dark:border-slate-800">
              <span className="text-slate-500">{oldestAt ? `Sejak ${formatDate(oldestAt)}` : 'Total antrean'}</span>
              {amount > 0 && <span className="font-semibold text-slate-800 tabular-nums dark:text-slate-200">{formatRupiah(amount)}</span>}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

function CollectionCard({ title, data, href }: { title: string; data: { target: number; paid: number; discount: number; remaining: number; paidPercent: number; settled: number; partial: number; unpaid: number }; href: string }) {
  return (
    <Link href={href} className="group block">
      <Card className="h-full border-slate-200 bg-white shadow-none transition-colors hover:border-emerald-300 dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="p-4 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</p>
            <span className="text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{data.paidPercent}%</span>
          </div>
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${data.paidPercent}%` }} />
          </div>
          <div className="mt-3.5 grid grid-cols-2 gap-2.5 text-xs">
            <Value label="Terkumpul" value={formatRupiah(data.paid)} positive />
            <Value label="Sisa" value={formatRupiah(data.remaining)} warning />
            <Value label="Target" value={formatRupiah(data.target)} />
            <Value label="Keringanan" value={formatRupiah(data.discount)} />
          </div>
          <div className="mt-3.5 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">{data.settled} lunas</Badge>
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">{data.partial} nyicil</Badge>
            <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">{data.unpaid} belum</Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function ArrearsCard({ title, data, href, warning }: { title: string; data: LegacyArrearsSummary; href: string; warning?: boolean }) {
  return (
    <Link href={href} className="group block">
      <Card className="h-full border-slate-200 bg-white shadow-none transition-colors hover:border-emerald-300 dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="p-4 pt-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{data.totalAccounts} akun tagihan</p>
            </div>
            {warning ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          </div>
          <p className={`mt-4 text-xl font-bold tabular-nums ${data.remaining > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'}`}>
            {formatRupiah(data.remaining)}
          </p>
          <p className="text-xs text-slate-500">sisa belum dibayar</p>
          <div className="mt-3.5 grid grid-cols-2 gap-2.5 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
            <Value label="Target" value={formatRupiah(data.target)} />
            <Value label="Dibayar" value={formatRupiah(data.paid)} positive />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function Value({ label, value, positive, warning }: { label: string; value: string; positive?: boolean; warning?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold tabular-nums ${positive ? 'text-emerald-600 dark:text-emerald-400' : warning ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-100'}`}>
        {value}
      </p>
    </div>
  )
}

function UnavailableCard() {
  return (
    <Card className="min-h-24 border-dashed border-slate-300 bg-slate-50 shadow-none dark:border-slate-700 dark:bg-slate-900/60">
      <CardContent className="flex min-h-24 items-center gap-3 p-4 pt-4">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Data belum tersedia</p>
          <p className="mt-0.5 text-xs text-slate-500">Bagian lain tetap dapat digunakan.</p>
        </div>
      </CardContent>
    </Card>
  )
}

function formatDate(value: string) {
  const normalized = value.length === 10 ? `${value}T00:00:00+07:00` : `${value.replace(' ', 'T')}Z`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(date)
}
