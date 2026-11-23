'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity,
  ArrowRight,
  Download,
  Info,
  Loader2,
  MessageCircle,
  RotateCcw,
  Search,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataPagination } from '@/components/ui/data-pagination'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type {
  ParentLoginClassRecap,
  ParentLoginDataSource,
  ParentLoginFilterOptions,
  ParentLoginFilters,
  ParentLoginStudentRow,
  ParentLoginSummary,
} from '@/lib/parent-login-tracking'
import { formatDateTimeWIB, todayWIB } from '@/lib/time'
import { getParentLoginExportData } from './actions'

type Props = {
  summary: ParentLoginSummary
  rows: ParentLoginStudentRow[]
  total: number
  classRecaps: ParentLoginClassRecap[]
  filterOptions: ParentLoginFilterOptions
  scopeMode: 'all' | 'scoped'
  filters: ParentLoginFilters
  activeTab: 'siswa' | 'kelas'
}

function parseTimestampUtc(value: string | null | undefined): Date | null {
  if (!value) return null
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const hasExplicitZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized)
  const parsed = new Date(hasExplicitZone ? normalized : `${normalized}Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatRelativeTime(value: string | null | undefined): string {
  const date = parseTimestampUtc(value)
  if (!date) return ''
  const diffMs = Date.now() - date.getTime()
  if (diffMs < 60_000) return 'Baru saja'
  const diffMinutes = Math.floor(diffMs / 60_000)
  if (diffMinutes < 60) return `${diffMinutes} menit lalu`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} jam lalu`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays} hari lalu`
  const diffMonths = Math.floor(diffDays / 30)
  return `${diffMonths} bulan lalu`
}

function formatPercent(value: number): string {
  return `${value.toFixed(1).replace('.', ',')}%`
}

function dataSourceLabel(source: ParentLoginDataSource | null): string {
  if (source === 'tracked') return 'Login tercatat langsung'
  if (source === 'backfill_session') return 'Sesi aktif sebelum modul'
  if (source === 'backfill_credential') return 'Riwayat awal'
  return '-'
}

function parentNamesLabel(row: ParentLoginStudentRow): string {
  const parts = [row.nama_ayah, row.nama_ibu].filter((v): v is string => Boolean(v && v.trim()))
  return parts.length > 0 ? parts.join(' / ') : '-'
}

export function MonitoringLoginOrtuClient({
  summary,
  rows,
  total,
  classRecaps,
  filterOptions,
  scopeMode,
  filters,
  activeTab,
}: Props) {
  const router = useRouter()
  const [searchText, setSearchText] = useState(filters.q || '')
  const [sortClassLowestFirst, setSortClassLowestFirst] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    setSearchText(filters.q || '')
  }, [filters.q])

  const page = Number(filters.page) || 1
  const pageSize: number | 'semua' = filters.pageSize === 'semua'
    ? 'semua'
    : Number(filters.pageSize) || 25

  const visibleKelasOptions = useMemo(() => {
    if (!filters.tingkat) return filterOptions.kelasList
    const tingkatNum = Number(filters.tingkat)
    return filterOptions.kelasList.filter(k => k.tingkat === tingkatNum)
  }, [filterOptions.kelasList, filters.tingkat])

  const sortedClassRecaps = useMemo(() => {
    if (!sortClassLowestFirst) return classRecaps
    return [...classRecaps].sort((a, b) => {
      if (a.persentase_login !== b.persentase_login) {
        return a.persentase_login - b.persentase_login
      }
      return b.belum_login - a.belum_login
    })
  }, [classRecaps, sortClassLowestFirst])

  const hasActiveFilters = Boolean(
    (filters.status && filters.status !== 'all') ||
    filters.tingkat ||
    filters.kelasId ||
    (filters.aktivitas && filters.aktivitas !== 'all') ||
    filters.q ||
    (filters.sort && filters.sort !== 'nama_asc')
  )

  function updateParams(patch: Record<string, string | number | null | undefined>) {
    const merged: Record<string, string | number | null | undefined> = {
      tab: activeTab === 'kelas' ? 'kelas' : undefined,
      status: filters.status && filters.status !== 'all' ? filters.status : undefined,
      tingkat: filters.tingkat,
      kelasId: filters.kelasId,
      aktivitas: filters.aktivitas && filters.aktivitas !== 'all' ? filters.aktivitas : undefined,
      q: filters.q,
      sort: filters.sort && filters.sort !== 'nama_asc' ? filters.sort : undefined,
      page: filters.page && filters.page > 1 ? filters.page : undefined,
      pageSize: filters.pageSize && filters.pageSize !== 25 ? filters.pageSize : undefined,
      ...patch,
    }

    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(merged)) {
      if (value === null || value === undefined || value === '' || value === 'all') continue
      if (key === 'page' && Number(value) <= 1) continue
      if (key === 'pageSize' && Number(value) === 25) continue
      if (key === 'sort' && value === 'nama_asc') continue
      if (key === 'tab' && value === 'siswa') continue
      params.set(key, String(value))
    }

    const qs = params.toString()
    startTransition(() => {
      router.push(qs ? `/dashboard/monitoring-login-ortu?${qs}` : '/dashboard/monitoring-login-ortu')
    })
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    updateParams({ q: searchText.trim() || null, page: 1 })
  }

  function handleTingkatChange(value: string) {
    const nextTingkat = value === 'all' ? null : value
    const currentKelasStillValid = nextTingkat
      ? filterOptions.kelasList.some(k => k.id === filters.kelasId && String(k.tingkat) === nextTingkat)
      : true

    updateParams({
      tingkat: nextTingkat,
      kelasId: currentKelasStillValid ? filters.kelasId : null,
      page: 1,
    })
  }

  function handleResetFilters() {
    setSearchText('')
    updateParams({
      status: null,
      tingkat: null,
      kelasId: null,
      aktivitas: null,
      q: null,
      sort: null,
      page: 1,
    })
  }

  async function handleExportExcel() {
    setExportError(null)
    setIsExporting(true)
    try {
      const data = await getParentLoginExportData(filters)
      const XLSX = await import('xlsx')

      const studentRows = data.rows.map((row, idx) => ({
        No: idx + 1,
        NISN: row.nisn,
        'Nama Siswa': row.nama_lengkap,
        Kelas: row.kelas_nama,
        'Nama Ayah': row.nama_ayah || '-',
        'Nama Ibu': row.nama_ibu || '-',
        'No. WhatsApp': row.nomor_whatsapp || '-',
        'Status Login': row.status_login === 'sudah' ? 'Sudah Login' : 'Belum Login',
        'Terakhir Login (WIB)': row.last_login_at ? formatDateTimeWIB(row.last_login_at) : '-',
        'Terakhir Buka Portal (WIB)': row.last_seen_at ? formatDateTimeWIB(row.last_seen_at) : '-',
        'Jumlah Login': row.login_count,
        'Sumber Data': dataSourceLabel(row.data_source),
      }))

      const recapRows = data.classRecaps.map((recap, idx) => ({
        No: idx + 1,
        Kelas: recap.kelas_nama,
        Tingkat: recap.tingkat,
        'Wali Kelas': recap.wali_kelas_nama || '-',
        'Total Siswa': recap.total_siswa,
        'Sudah Login': recap.sudah_login,
        'Belum Login': recap.belum_login,
        'Persentase Login (%)': recap.persentase_login,
        'Aktif 7 Hari': recap.aktif_7_hari,
      }))

      const wb = XLSX.utils.book_new()

      const studentSheet = XLSX.utils.json_to_sheet(
        studentRows.length > 0
          ? studentRows
          : [{ No: '-', NISN: '-', 'Nama Siswa': 'Tidak ada data sesuai filter' }]
      )
      studentSheet['!cols'] = [
        { wch: 5 },
        { wch: 15 },
        { wch: 28 },
        { wch: 16 },
        { wch: 22 },
        { wch: 22 },
        { wch: 16 },
        { wch: 14 },
        { wch: 22 },
        { wch: 24 },
        { wch: 13 },
        { wch: 24 },
      ]
      XLSX.utils.book_append_sheet(wb, studentSheet, 'Daftar Siswa')

      const recapSheet = XLSX.utils.json_to_sheet(
        recapRows.length > 0
          ? recapRows
          : [{ No: '-', Kelas: 'Belum ada data kelas' }]
      )
      recapSheet['!cols'] = [
        { wch: 5 },
        { wch: 16 },
        { wch: 9 },
        { wch: 26 },
        { wch: 12 },
        { wch: 13 },
        { wch: 13 },
        { wch: 20 },
        { wch: 13 },
      ]
      XLSX.utils.book_append_sheet(wb, recapSheet, 'Rekap Per Kelas')

      XLSX.writeFile(wb, `Monitoring_Login_Ortu_${todayWIB()}.xlsx`)
    } catch {
      setExportError('Gagal mengekspor data Excel. Silakan coba lagi.')
    } finally {
      setIsExporting(false)
    }
  }

  const belumPct = summary.totalSiswa > 0
    ? Math.round((summary.belumLogin / summary.totalSiswa) * 1000) / 10
    : 0
  const aktif7Pct = summary.totalSiswa > 0
    ? Math.round((summary.aktif7Hari / summary.totalSiswa) * 1000) / 10
    : 0

  return (
    <div className="space-y-4">
      {scopeMode === 'scoped' && (
        <div className="flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-3 text-xs text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
          <div>
            {filterOptions.kelasList.length === 0 ? (
              <span>Anda belum memiliki kelas binaan sebagai Wali Kelas atau Guru BK pada tahun ajaran aktif.</span>
            ) : (
              <span>
                Tampilan difokuskan ke kelas binaan Anda ({filterOptions.kelasList.length} kelas:{' '}
                {filterOptions.kelasList.map(k => k.nama).join(', ')}).
              </span>
            )}
          </div>
        </div>
      )}

      {/* Ringkasan KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Total Siswa Aktif"
          value={summary.totalSiswa}
          subtext={filters.kelasId || filters.tingkat ? 'Sesuai cakupan filter kelas' : 'Seluruh siswa aktif'}
          icon={<Users className="h-4 w-4 text-slate-500" />}
          tone="slate"
        />
        <KpiCard
          label="Sudah Login"
          value={summary.sudahLogin}
          subtext={`${formatPercent(summary.persentaseLogin)} dari total`}
          icon={<UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
          tone="emerald"
        />
        <KpiCard
          label="Belum Pernah Login"
          value={summary.belumLogin}
          subtext={`${formatPercent(belumPct)} perlu tindak lanjut`}
          icon={<UserX className="h-4 w-4 text-rose-600 dark:text-rose-400" />}
          tone="rose"
        />
        <KpiCard
          label="Aktif 7 Hari Terakhir"
          value={summary.aktif7Hari}
          subtext={`${formatPercent(aktif7Pct)} aktif pekan ini`}
          icon={<Activity className="h-4 w-4 text-teal-600 dark:text-teal-400" />}
          tone="teal"
        />
      </div>

      {exportError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {exportError}
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={next => updateParams({ tab: next === 'kelas' ? 'kelas' : 'siswa' })}
        className="space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList className="h-auto">
            <TabsTrigger value="siswa">Daftar Siswa ({total})</TabsTrigger>
            <TabsTrigger value="kelas">Rekap per Kelas ({classRecaps.length})</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2" data-dashboard-guide-target="actions">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={isExporting || summary.totalSiswa === 0}
              className="h-9 gap-1.5 text-xs"
            >
              {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              <span>Export Excel</span>
            </Button>
          </div>
        </div>

        {/* TAB 1: DAFTAR SISWA */}
        <TabsContent value="siswa" className="space-y-3">
          <div
            className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950"
            data-dashboard-guide-target="filters"
          >
            <form onSubmit={handleSearchSubmit} className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-6">
              <div className="relative md:col-span-2">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  placeholder="Cari nama siswa, NISN, atau nama ortu..."
                  className="h-9 pl-8 text-xs"
                />
              </div>

              <Select
                value={filters.status || 'all'}
                onValueChange={value => updateParams({ status: value === 'all' ? null : value, page: 1 })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Status login" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua status login</SelectItem>
                  <SelectItem value="sudah">Sudah Login</SelectItem>
                  <SelectItem value="belum">Belum Login</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.tingkat || 'all'} onValueChange={handleTingkatChange}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Semua tingkat" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua tingkat</SelectItem>
                  {filterOptions.tingkatList.map(t => (
                    <SelectItem key={t} value={String(t)}>Tingkat {t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.kelasId || 'all'}
                onValueChange={value => updateParams({ kelasId: value === 'all' ? null : value, page: 1 })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Semua kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua kelas</SelectItem>
                  {visibleKelasOptions.map(k => (
                    <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.aktivitas || 'all'}
                onValueChange={value => updateParams({ aktivitas: value === 'all' ? null : value, page: 1 })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Aktivitas portal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua aktivitas</SelectItem>
                  <SelectItem value="7d">Aktif 7 hari terakhir</SelectItem>
                  <SelectItem value="30d">Aktif 30 hari terakhir</SelectItem>
                  <SelectItem value="inactive_30d">Tidak aktif &gt; 30 hari</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex flex-wrap items-center justify-between gap-2 md:col-span-2 xl:col-span-6 pt-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-slate-500">Urutkan:</span>
                  <Select
                    value={filters.sort || 'nama_asc'}
                    onValueChange={value => updateParams({ sort: value === 'nama_asc' ? null : value, page: 1 })}
                  >
                    <SelectTrigger className="h-8 w-[195px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nama_asc">Kelas &amp; Nama Siswa</SelectItem>
                      <SelectItem value="belum_dulu">Belum Login Terlebih Dulu</SelectItem>
                      <SelectItem value="last_login_desc">Terakhir Login Terbaru</SelectItem>
                      <SelectItem value="last_seen_desc">Terakhir Buka Portal Terbaru</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  {hasActiveFilters && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleResetFilters}
                      disabled={isPending}
                      className="h-8 gap-1 text-xs text-slate-600"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Reset</span>
                    </Button>
                  )}
                  <Button type="submit" size="sm" disabled={isPending} className="h-8 px-3 text-xs">
                    {isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                    Cari
                  </Button>
                </div>
              </div>
            </form>
          </div>

          <div
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950"
            data-dashboard-guide-target="results"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-xs sm:text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Siswa &amp; Orang Tua</th>
                    <th className="px-4 py-3 text-left font-semibold">Kelas</th>
                    <th className="px-4 py-3 text-left font-semibold">Status Login</th>
                    <th className="px-4 py-3 text-left font-semibold">Terakhir Login</th>
                    <th className="px-4 py-3 text-left font-semibold">Terakhir Buka Portal</th>
                    <th className="px-4 py-3 text-center font-semibold">Jml Login</th>
                    <th className="px-4 py-3 text-right font-semibold">Tindak Lanjut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map(row => {
                    const lastLoginText = formatDateTimeWIB(row.last_login_at)
                    const lastLoginRel = formatRelativeTime(row.last_login_at)
                    const lastSeenText = formatDateTimeWIB(row.last_seen_at)
                    const lastSeenRel = formatRelativeTime(row.last_seen_at)
                    const ortu = parentNamesLabel(row)

                    return (
                      <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900 dark:text-slate-100">{row.nama_lengkap}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="font-mono">NISN {row.nisn || '-'}</span>
                            {ortu !== '-' && (
                              <>
                                <span aria-hidden="true">•</span>
                                <span className="truncate max-w-[240px]" title={ortu}>Ortu: {ortu}</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-700 dark:text-slate-300">
                          {row.kelas_nama}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {row.status_login === 'sudah' ? (
                            <div className="space-y-0.5">
                              <Badge
                                variant="outline"
                                className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/50 dark:text-emerald-300"
                              >
                                Sudah Login
                              </Badge>
                              {row.data_source === 'backfill_credential' && (
                                <div className="text-[10px] text-slate-400">Riwayat awal</div>
                              )}
                            </div>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/70 dark:bg-rose-950/50 dark:text-rose-300"
                            >
                              Belum Login
                            </Badge>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {lastLoginText ? (
                            <div>
                              <div className="text-xs font-medium text-slate-800 dark:text-slate-200">{lastLoginText}</div>
                              {lastLoginRel && (
                                <div className="text-[11px] text-slate-400">{lastLoginRel}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {lastSeenText ? (
                            <div>
                              <div className="text-xs font-medium text-slate-800 dark:text-slate-200">{lastSeenText}</div>
                              {lastSeenRel && (
                                <div className="text-[11px] text-slate-400">{lastSeenRel}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-center tabular-nums text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {row.status_login === 'sudah' ? `${row.login_count}x` : '0'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {row.wa_url ? (
                            <a
                              href={row.wa_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={
                                row.status_login === 'belum'
                                  ? 'inline-flex items-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-[11px] font-semibold text-teal-800 transition-colors hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-300 dark:hover:bg-teal-900/60'
                                  : 'inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                              }
                              title={`Kirim pesan WhatsApp ke ${row.nomor_whatsapp}`}
                            >
                              <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                              <span>{row.status_login === 'belum' ? 'Ingatkan WA' : 'Hubungi WA'}</span>
                            </a>
                          ) : (
                            <span className="text-[11px] text-slate-400">No. WA belum ada</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                        Tidak ada data siswa yang cocok dengan filter saat ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <DataPagination
              total={total}
              page={page}
              pageSize={pageSize}
              entityLabel="siswa"
              onPageChange={next => updateParams({ page: next })}
              onPageSizeChange={next => updateParams({ page: 1, pageSize: next })}
            />
          </div>
        </TabsContent>

        {/* TAB 2: REKAP PER KELAS */}
        <TabsContent value="kelas" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Filter Tingkat:</span>
              <Select value={filters.tingkat || 'all'} onValueChange={handleTingkatChange}>
                <SelectTrigger className="h-8 w-[160px] text-xs">
                  <SelectValue placeholder="Semua tingkat" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua tingkat</SelectItem>
                  {filterOptions.tingkatList.map(t => (
                    <SelectItem key={t} value={String(t)}>Tingkat {t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              variant={sortClassLowestFirst ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortClassLowestFirst(v => !v)}
              className="h-8 text-xs"
            >
              {sortClassLowestFirst ? 'Urutan: Persentase Terendah' : 'Urutkan Terendah Dulu'}
            </Button>
          </div>

          <div
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950"
            data-dashboard-guide-target="results"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-xs sm:text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Kelas &amp; Wali Kelas</th>
                    <th className="px-4 py-3 text-center font-semibold">Total Siswa</th>
                    <th className="px-4 py-3 text-center font-semibold">Sudah Login</th>
                    <th className="px-4 py-3 text-center font-semibold">Belum Login</th>
                    <th className="px-4 py-3 text-center font-semibold">Aktif 7 Hari</th>
                    <th className="px-4 py-3 text-left font-semibold min-w-[180px]">Progres Adopsi</th>
                    <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sortedClassRecaps.map(recap => (
                    <tr key={recap.kelas_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{recap.kelas_nama}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Wali: {recap.wali_kelas_nama || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums font-medium">{recap.total_siswa}</td>
                      <td className="px-4 py-3 text-center tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                        {recap.sudah_login}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                        {recap.belum_login}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums text-slate-600 dark:text-slate-300">
                        {recap.aktif_7_hari}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className="h-full rounded-full bg-emerald-600 transition-all dark:bg-emerald-500"
                              style={{ width: `${Math.min(100, Math.max(0, recap.persentase_login))}%` }}
                            />
                          </div>
                          <span className="w-12 text-right text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                            {formatPercent(recap.persentase_login)}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {recap.belum_login > 0 ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-[11px]"
                            onClick={() => updateParams({
                              tab: 'siswa',
                              kelasId: recap.kelas_id,
                              tingkat: String(recap.tingkat),
                              status: 'belum',
                              page: 1,
                            })}
                          >
                            <span>Lihat Belum Login</span>
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        ) : (
                          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            Semua sudah login
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {sortedClassRecaps.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                        Belum ada data rekap kelas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function KpiCard({
  label,
  value,
  subtext,
  icon,
  tone,
}: {
  label: string
  value: number
  subtext: string
  icon: React.ReactNode
  tone: 'slate' | 'emerald' | 'rose' | 'teal'
}) {
  const valueTone = {
    slate: 'text-slate-900 dark:text-slate-50',
    emerald: 'text-emerald-700 dark:text-emerald-400',
    rose: 'text-rose-700 dark:text-rose-400',
    teal: 'text-teal-700 dark:text-teal-400',
  }[tone]

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</span>
        {icon}
      </div>
      <div className={`mt-1.5 text-2xl font-bold tabular-nums tracking-tight ${valueTone}`}>
        {value.toLocaleString('id-ID')}
      </div>
      <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{subtext}</div>
    </div>
  )
}
