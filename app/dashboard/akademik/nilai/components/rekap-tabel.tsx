'use client'

import { useEffect, useMemo, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, FileSpreadsheet, AlertTriangle, Users } from 'lucide-react'
import { getRekapNilaiTabel, type RekapSiswaRow } from '../actions'
import { SEMESTER_MAP, SEMESTER_KEYS } from '../constants'

const DEFAULT_KKM = 77

type KelasGroup = { id: string; label: string; siswa: RekapSiswaRow[] }

function kelasLabel(s: RekapSiswaRow) {
  if (!s.kelas_id) return 'Tanpa Kelas'
  return `${s.tingkat}-${s.nomor_kelas} ${s.kelompok}`
}

export function RekapTabel() {
  const [loading, setLoading] = useState(true)
  const [siswa, setSiswa] = useState<RekapSiswaRow[]>([])
  const [mapelOrder, setMapelOrder] = useState<string[]>([])
  const [kodeByMapel, setKodeByMapel] = useState<Record<string, string>>({})
  const [semester, setSemester] = useState('nilai_smt1')
  const [kelasId, setKelasId] = useState<string>('')
  const [kkm, setKkm] = useState<number>(DEFAULT_KKM)

  useEffect(() => {
    getRekapNilaiTabel()
      .then((res) => {
        setSiswa(res.siswa)
        setMapelOrder(res.mapelOrder)
        setKodeByMapel(res.kodeByMapel || {})
      })
      .finally(() => setLoading(false))
  }, [])

  // Daftar kelas (grup)
  const kelasGroups = useMemo<KelasGroup[]>(() => {
    const map = new Map<string, KelasGroup>()
    for (const s of siswa) {
      const id = s.kelas_id || '__none__'
      if (!map.has(id)) map.set(id, { id, label: kelasLabel(s), siswa: [] })
      map.get(id)!.siswa.push(s)
    }
    return Array.from(map.values())
  }, [siswa])

  // Default pilih kelas pertama begitu data masuk
  useEffect(() => {
    if (!kelasId && kelasGroups.length > 0) setKelasId(kelasGroups[0].id)
  }, [kelasGroups, kelasId])

  const activeKelas = kelasGroups.find((k) => k.id === kelasId)

  // Kolom mapel = union mapel yg punya nilai di kelas+semester ini, urut sesuai master
  const mapelCols = useMemo<string[]>(() => {
    if (!activeKelas) return []
    const present = new Set<string>()
    for (const s of activeKelas.siswa) {
      const n = s.nilai[semester] || {}
      Object.keys(n).forEach((k) => present.add(k))
    }
    const ordered = mapelOrder.filter((m) => present.has(m))
    const extras = Array.from(present).filter((m) => !mapelOrder.includes(m)).sort()
    return [...ordered, ...extras]
  }, [activeKelas, semester, mapelOrder])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat rekap nilai...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Kontrol */}
      <div className="rounded-lg border border-surface bg-surface p-4 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="space-y-1.5 w-full sm:w-56">
          <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Kelas</Label>
          <Select value={kelasId} onValueChange={setKelasId}>
            <SelectTrigger className="h-9 text-xs rounded-lg"><SelectValue placeholder="Pilih kelas..." /></SelectTrigger>
            <SelectContent>
              {kelasGroups.map((k) => (
                <SelectItem key={k.id} value={k.id} className="text-xs">
                  {k.label} ({k.siswa.length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 w-full sm:w-56">
          <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Semester</Label>
          <Select value={semester} onValueChange={setSemester}>
            <SelectTrigger className="h-9 text-xs rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SEMESTER_KEYS.map((k) => (
                <SelectItem key={k} value={k} className="text-xs">{SEMESTER_MAP[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 w-full sm:w-32">
          <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">KKM</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={kkm}
            onChange={(e) => setKkm(Number(e.target.value) || 0)}
            className="h-9 text-xs rounded-lg"
          />
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground sm:ml-auto pb-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800" />
          Nilai di bawah KKM ({kkm})
        </div>
      </div>

      {/* Tabel */}
      {!activeKelas || activeKelas.siswa.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Users className="h-6 w-6 opacity-40" />
          Tidak ada siswa pada kelas ini.
        </div>
      ) : mapelCols.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <FileSpreadsheet className="h-6 w-6 opacity-40" />
          Belum ada nilai untuk {SEMESTER_MAP[semester]} di kelas {activeKelas.label}.
        </div>
      ) : (
        <RekapTable kelas={activeKelas} semester={semester} mapelCols={mapelCols} kkm={kkm} kodeByMapel={kodeByMapel} />
      )}
    </div>
  )
}

function RekapTable({
  kelas,
  semester,
  mapelCols,
  kkm,
  kodeByMapel,
}: {
  kelas: KelasGroup
  semester: string
  mapelCols: string[]
  kkm: number
  kodeByMapel: Record<string, string>
}) {
  // Hitung per-siswa
  const rows = kelas.siswa.map((s) => {
    const n = s.nilai[semester] || {}
    const vals = mapelCols.map((m) => (typeof n[m] === 'number' ? n[m] : null))
    const filled = vals.filter((v): v is number => v !== null)
    const jumlah = filled.reduce((a, b) => a + b, 0)
    const rata = filled.length ? jumlah / filled.length : null
    const tuntas = filled.length > 0 && filled.every((v) => v >= kkm)
    return { s, vals, jumlah, rata, belowCount: filled.filter((v) => v < kkm).length, tuntas }
  })

  // Rata-rata kelas per mapel
  const mapelAvg = mapelCols.map((_, ci) => {
    const col = rows.map((r) => r.vals[ci]).filter((v): v is number => v !== null)
    return col.length ? col.reduce((a, b) => a + b, 0) / col.length : null
  })

  const fmt = (v: number | null) => (v === null ? '–' : Number.isInteger(v) ? String(v) : v.toFixed(1))
  const cellBelow = (v: number | null) => v !== null && v < kkm

  return (
    <div className="rounded-lg border border-surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-xs">
          <colgroup>
            <col className="w-7" />
            <col className="w-[150px]" />
            {mapelCols.map((m) => (
              <col key={m} />
            ))}
            <col className="w-10" />
            <col className="w-10" />
          </colgroup>
          <thead>
            <tr className="bg-surface-2 text-slate-600 dark:text-slate-300">
              <th className="sticky left-0 z-20 bg-surface-2 px-1 py-2 text-left font-semibold border-b border-surface">#</th>
              <th className="sticky left-7 z-20 bg-surface-2 px-3 py-2 text-left font-semibold border-b border-r border-surface">
                Nama Siswa
              </th>
              {mapelCols.map((m) => (
                <th
                  key={m}
                  title={m}
                  className="px-1 py-2 text-center font-semibold border-b border-surface truncate cursor-help"
                >
                  {kodeByMapel[m] || m}
                </th>
              ))}
              <th className="px-1 py-2 text-center font-bold border-b border-l border-surface bg-surface-2">Jml</th>
              <th className="px-1 py-2 text-center font-bold border-b border-surface bg-surface-2">Rata</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={r.s.id} className="hover:bg-muted/40 border-b border-surface last:border-0">
                <td className="sticky left-0 z-10 bg-surface px-1 py-1.5 text-muted-foreground tabular-nums">{ri + 1}</td>
                <td className="sticky left-7 z-10 bg-surface px-3 py-1.5 border-r border-surface">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{r.s.nama_lengkap}</span>
                    {r.belowCount > 0 && (
                      <span title={`${r.belowCount} mapel di bawah KKM`}>
                        <AlertTriangle className="h-3 w-3 text-rose-500 shrink-0" />
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{r.s.nisn}</span>
                </td>
                {r.vals.map((v, ci) => (
                  <td
                    key={ci}
                    className={`px-1 py-1.5 text-center tabular-nums ${
                      cellBelow(v)
                        ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {fmt(v)}
                  </td>
                ))}
                <td className="px-1 py-1.5 text-center font-bold tabular-nums border-l border-surface bg-surface-2/40">
                  {fmt(r.jumlah)}
                </td>
                <td
                  className={`px-1 py-1.5 text-center font-bold tabular-nums bg-surface-2/40 ${
                    cellBelow(r.rata) ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {fmt(r.rata)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-surface-2 font-semibold text-slate-700 dark:text-slate-200">
              <td className="sticky left-0 z-10 bg-surface-2 px-1 py-2 border-t border-surface" />
              <td className="sticky left-7 z-10 bg-surface-2 px-3 py-2 border-t border-r border-surface">Rata-rata Kelas</td>
              {mapelAvg.map((v, ci) => (
                <td
                  key={ci}
                  className={`px-1 py-2 text-center tabular-nums border-t border-surface ${
                    cellBelow(v) ? 'text-rose-600 dark:text-rose-400' : ''
                  }`}
                >
                  {fmt(v)}
                </td>
              ))}
              <td className="border-t border-l border-surface" />
              <td className="border-t border-surface" />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="px-3 py-2 text-[11px] text-muted-foreground bg-surface-2/40 border-t border-surface flex flex-wrap gap-x-4 gap-y-1">
        <span>Total siswa: <strong>{rows.length}</strong></span>
        <span>Tuntas semua mapel: <strong className="text-emerald-600 dark:text-emerald-400">{rows.filter((r) => r.tuntas).length}</strong></span>
        <span>Ada nilai &lt; KKM: <strong className="text-rose-600 dark:text-rose-400">{rows.filter((r) => r.belowCount > 0).length}</strong></span>
        <span className="italic opacity-80">Header = kode mapel RDM; arahkan kursor untuk nama lengkap.</span>
      </div>
    </div>
  )
}
