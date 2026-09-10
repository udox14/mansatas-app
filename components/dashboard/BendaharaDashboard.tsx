import Link from 'next/link'
import {
  AlertTriangle, ArrowRight, Banknote, CheckCircle2, ClipboardCheck,
  FileCheck2, FileSpreadsheet, FileText, HandCoins, History, Landmark,
  ReceiptText, Settings, TrendingDown, TrendingUp, WalletCards,
} from 'lucide-react'
import { getDB } from '@/utils/db-server'
import { formatRupiah } from '@/lib/utils'
import {
  canAccessFinanceFeature,
  loadBendaharaDashboardData,
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
}

const shortcuts = [
  { feature: 'komite-pengajuan', href: '/dashboard/komite/pengajuan', label: 'Pengajuan', desc: 'Review dan realisasi SPB', icon: FileCheck2, tone: 'violet' },
  { feature: 'keuangan-daftar-ulang', href: '/dashboard/keuangan/daftar-ulang', label: 'Kasir Daftar Ulang', desc: 'Pembayaran siswa baru', icon: ClipboardCheck, tone: 'emerald' },
  { feature: 'keuangan-transaksi', href: '/dashboard/keuangan/transaksi', label: 'Riwayat Transaksi', desc: 'Kuitansi dan histori pembayaran', icon: ReceiptText, tone: 'blue' },
  { feature: 'keuangan-dspt', href: '/dashboard/keuangan/dspt', label: 'DSPT & SPP', desc: 'Tagihan siswa aktif', icon: HandCoins, tone: 'cyan' },
  { feature: 'keuangan-dspt-nonaktif', href: '/dashboard/keuangan/dspt/nonaktif', label: 'Siswa Nonaktif', desc: 'Sisa tagihan alumni/keluar', icon: History, tone: 'amber' },
  { feature: 'keuangan-export', href: '/dashboard/keuangan/export', label: 'Export Excel', desc: 'Rekap tagihan siswa', icon: FileSpreadsheet, tone: 'sky' },
  { feature: 'keuangan-kas-keluar', href: '/dashboard/keuangan/kas-keluar', label: 'Arus Kas', desc: 'Pemasukan dan pengeluaran', icon: WalletCards, tone: 'rose' },
  { feature: 'keuangan-laporan', href: '/dashboard/keuangan/laporan', label: 'Laporan Bulanan', desc: 'BKU, PDF, dan Excel', icon: FileText, tone: 'indigo' },
  { feature: 'keuangan-pengaturan', href: '/dashboard/keuangan/pengaturan', label: 'Pengaturan Komite', desc: 'Rekening, QRIS, dan laporan', icon: Settings, tone: 'slate' },
] as const

const tones: Record<string, string> = {
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  cyan: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  sky: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
  indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300',
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

export async function BendaharaDashboard({ userId, isGuruPiket, dashboardVisibility, allowedFeatures, period }: Props) {
  const show = (id: string) => dashboardVisibility?.[id] !== false
  const data = await loadBendaharaDashboardData({ db: await getDB(), userId, period, allowedFeatures })
  const visibleShortcuts = shortcuts.filter(item => canAccessFinanceFeature(allowedFeatures, item.feature))
  const queueCards = [
    data.paymentQueue && { title: 'Bukti bayar', description: 'Menunggu konfirmasi', href: '/dashboard/keuangan/dspt', icon: ReceiptText, section: data.paymentQueue, tone: 'amber' },
    data.approvalQueue && { title: 'Review pengajuan', description: 'Menunggu Bendahara', href: '/dashboard/komite/pengajuan?tab=review', icon: FileCheck2, section: data.approvalQueue, tone: 'violet' },
    data.releaseQueue && { title: 'Realisasi SPB', description: 'Disetujui, belum dicairkan', href: '/dashboard/komite/pengajuan?tab=review', icon: Banknote, section: data.releaseQueue, tone: 'emerald' },
  ].filter(Boolean) as Array<{ title: string; description: string; href: string; icon: typeof ReceiptText; section: DashboardSection<QueueSummary>; tone: string }>

  return (
    <div className="space-y-5 animate-in fade-in duration-500 pb-12">
      <section className="overflow-hidden rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 text-white shadow-sm dark:border-emerald-800">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-100"><WalletCards className="h-4 w-4" /> Cockpit Keuangan Komite</div>
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Posisi kas {data.periodLabel.toLocaleLowerCase('id-ID')}</h2>
            <p className="mt-1 text-sm text-emerald-100/80">Angka kas, tagihan, dan antrean kerja dalam satu pandangan.</p>
          </div>
          <form action="/dashboard" method="get" className="flex items-center gap-2">
            <label htmlFor="dashboard-period" className="sr-only">Periode dashboard</label>
            <input id="dashboard-period" name="period" type="month" defaultValue={data.period} className="h-10 rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-medium text-white [color-scheme:dark] outline-none focus:border-white/50" />
            <button type="submit" className="h-10 rounded-xl bg-white px-3 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50">Tampilkan</button>
          </form>
        </div>
      </section>

      {show('cash_position') && data.cashPosition && (
        <section aria-labelledby="cash-position-title" className="space-y-3">
          <SectionHeading id="cash-position-title" title="Posisi Kas" description="Saldo bulan terpilih berdasarkan buku kas komite" href="/dashboard/keuangan/laporan" />
          {data.cashPosition.status === 'unavailable' ? <UnavailableCard /> : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MoneyCard title="Saldo awal" value={data.cashPosition.data.openingBalance} icon={Landmark} tone="slate" />
              <MoneyCard title="Pemasukan" value={data.cashPosition.data.totalIncome} icon={TrendingUp} tone="emerald" />
              <MoneyCard title="Pengeluaran" value={data.cashPosition.data.totalExpense} icon={TrendingDown} tone="rose" />
              <MoneyCard title="Saldo akhir" value={data.cashPosition.data.endingBalance} icon={WalletCards} tone="blue" emphasis />
            </div>
          )}
        </section>
      )}

      {show('attention_queue') && queueCards.length > 0 && (
        <section aria-labelledby="queue-title" className="space-y-3">
          <SectionHeading id="queue-title" title="Perlu Ditindaklanjuti" description="Pekerjaan aktif yang menunggu keputusan Bendahara" />
          <div className="grid gap-3 md:grid-cols-3">{queueCards.map(card => <QueueCard key={card.title} {...card} />)}</div>
        </section>
      )}

      {show('stat_keuangan') && (data.dspt || data.legacySpp || data.inactiveArrears) && (
        <section aria-labelledby="collection-title" className="space-y-3">
          <SectionHeading id="collection-title" title="Kesehatan Tagihan" description="Capaian pembayaran dan sisa kewajiban siswa" href="/dashboard/keuangan/dspt" />
          <div className="grid gap-3 lg:grid-cols-3">
            {data.dspt && (data.dspt.status === 'ready' ? <CollectionCard title="DSPT siswa aktif" data={data.dspt.data} href="/dashboard/keuangan/dspt" /> : <UnavailableCard />)}
            {data.legacySpp && (data.legacySpp.status === 'ready' ? <ArrearsCard title="Tunggakan SPP lama" data={data.legacySpp.data} href="/dashboard/keuangan/dspt" /> : <UnavailableCard />)}
            {data.inactiveArrears && (data.inactiveArrears.status === 'ready' ? <ArrearsCard title="Siswa nonaktif" data={data.inactiveArrears.data} href="/dashboard/keuangan/dspt/nonaktif" warning /> : <UnavailableCard />)}
          </div>
        </section>
      )}

      {show('quick_links') && visibleShortcuts.length > 0 && (
        <section aria-labelledby="shortcut-title" className="space-y-3">
          <SectionHeading id="shortcut-title" title="Modul Keuangan Komite" description="Akses cepat sesuai kewenangan akun Anda" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {visibleShortcuts.map(({ feature, href, label, desc, icon: Icon, tone }) => (
              <Link key={feature} href={href} className="group flex min-h-20 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span><span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{desc}</span></span>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {show('kas_transaksi') && data.cashPosition && (
        <section aria-labelledby="activity-title" className="space-y-3">
          <SectionHeading id="activity-title" title="Aktivitas Kas Terbaru" description={`Transaksi pada ${data.periodLabel.toLocaleLowerCase('id-ID')}`} href="/dashboard/keuangan/transaksi" />
          {data.cashPosition.status === 'unavailable' ? <UnavailableCard /> : data.cashPosition.data.recentRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">Belum ada aktivitas kas pada periode ini.</div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              {data.cashPosition.data.recentRows.map((row, index) => (
                <div key={row.id} className={`flex items-center gap-3 px-4 py-3 ${index ? 'border-t border-slate-100 dark:border-slate-800' : ''}`}>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${row.direction === 'income' ? tones.emerald : tones.rose}`}>{row.direction === 'income' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}</span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{row.description}</p><p className="mt-0.5 text-xs text-slate-500">{formatDate(row.transactionDate)}{row.proofNumber ? ` · ${row.proofNumber}` : ''}</p></div>
                  <p className={`shrink-0 text-sm font-bold tabular-nums ${row.direction === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{row.direction === 'income' ? '+' : '-'}{formatRupiah(row.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="space-y-3 pt-1">{isGuruPiket && <PenugasanMasukCard userId={userId} />}{show('kehadiran_pribadi') && <KehadiranPribadiCard userId={userId} />}</div>
    </div>
  )
}

function SectionHeading({ id, title, description, href }: { id: string; title: string; description: string; href?: string }) {
  return <div className="flex items-end justify-between gap-3"><div><h3 id={id} className="text-base font-bold text-slate-900 dark:text-white">{title}</h3><p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p></div>{href && <Link href={href} className="flex shrink-0 items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400">Lihat detail <ArrowRight className="h-4 w-4" /></Link>}</div>
}

function MoneyCard({ title, value, icon: Icon, tone, emphasis }: { title: string; value: number; icon: typeof Landmark; tone: string; emphasis?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${emphasis ? 'border-blue-200 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/30' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}><div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-[18px] w-[18px]" /></div><p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p><p className="mt-1 break-words text-lg font-extrabold tracking-tight text-slate-900 tabular-nums dark:text-white sm:text-xl">{formatRupiah(value)}</p></div>
}

function QueueCard({ title, description, href, icon: Icon, section, tone }: { title: string; description: string; href: string; icon: typeof ReceiptText; section: DashboardSection<QueueSummary>; tone: string }) {
  if (section.status === 'unavailable') return <UnavailableCard />
  const { count, amount, oldestAt } = section.data
  return <Link href={href} className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"><div className="flex items-start justify-between gap-3"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></span><ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5" /></div><div className="mt-4 flex items-end justify-between gap-3"><div><p className="text-2xl font-extrabold text-slate-900 tabular-nums dark:text-white">{count}</p><p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p><p className="text-xs text-slate-500">{description}</p></div>{amount > 0 && <p className="text-right text-sm font-bold text-slate-700 tabular-nums dark:text-slate-200">{formatRupiah(amount)}</p>}</div>{oldestAt && <p className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500 dark:border-slate-800">Tertua sejak {formatDate(oldestAt)}</p>}</Link>
}

function CollectionCard({ title, data, href }: { title: string; data: { target: number; paid: number; discount: number; remaining: number; paidPercent: number; settled: number; partial: number; unpaid: number }; href: string }) {
  return <Link href={href} className="rounded-2xl border border-cyan-200 bg-cyan-50/50 p-4 transition hover:shadow-md dark:border-cyan-900 dark:bg-cyan-950/20"><div className="flex items-center justify-between"><p className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</p><span className="text-lg font-extrabold text-cyan-700 dark:text-cyan-300">{data.paidPercent}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full rounded-full bg-cyan-500" style={{ width: `${data.paidPercent}%` }} /></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><Value label="Terkumpul" value={formatRupiah(data.paid)} positive /><Value label="Sisa" value={formatRupiah(data.remaining)} warning /><Value label="Target" value={formatRupiah(data.target)} /><Value label="Keringanan" value={formatRupiah(data.discount)} /></div><div className="mt-4 flex flex-wrap gap-2 border-t border-cyan-100 pt-3 text-xs dark:border-cyan-900/60"><Badge tone="emerald">{data.settled} lunas</Badge><Badge tone="amber">{data.partial} nyicil</Badge><Badge tone="rose">{data.unpaid} belum</Badge></div></Link>
}

function ArrearsCard({ title, data, href, warning }: { title: string; data: LegacyArrearsSummary; href: string; warning?: boolean }) {
  return <Link href={href} className={`rounded-2xl border p-4 transition hover:shadow-md ${warning ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</p><p className="mt-0.5 text-xs text-slate-500">{data.totalAccounts} akun tagihan</p></div>{warning ? <AlertTriangle className="h-5 w-5 text-amber-600" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}</div><p className={`mt-5 text-2xl font-extrabold tabular-nums ${data.remaining > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'}`}>{formatRupiah(data.remaining)}</p><p className="text-xs text-slate-500">sisa belum dibayar</p><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><Value label="Target" value={formatRupiah(data.target)} /><Value label="Dibayar" value={formatRupiah(data.paid)} positive /></div></Link>
}

function Value({ label, value, positive, warning }: { label: string; value: string; positive?: boolean; warning?: boolean }) { return <div><p className="text-xs text-slate-500">{label}</p><p className={`mt-0.5 font-bold tabular-nums ${positive ? 'text-emerald-600 dark:text-emerald-400' : warning ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-100'}`}>{value}</p></div> }
function Badge({ children, tone }: { children: React.ReactNode; tone: 'emerald' | 'amber' | 'rose' }) { return <span className={`rounded-full px-2 py-1 font-semibold ${tones[tone]}`}>{children}</span> }
function UnavailableCard() { return <div className="flex min-h-28 items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60"><AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" /><div><p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Data belum tersedia</p><p className="mt-0.5 text-xs text-slate-500">Bagian lain tetap dapat digunakan.</p></div></div> }
function formatDate(value: string) { const normalized = value.length === 10 ? `${value}T00:00:00+07:00` : `${value.replace(' ', 'T')}Z`; const date = new Date(normalized); if (Number.isNaN(date.getTime())) return value; return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(date) }
