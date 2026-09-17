import Link from 'next/link'
import { getDB } from '@/utils/db-server'
import { todayWIB } from '@/lib/time'
import { formatNamaKelas } from '@/lib/utils'
import { Calendar, PlayCircle, Info, ClipboardText as ClipboardList, Clock, BookOpen } from '@phosphor-icons/react/dist/ssr'

type Props = {
  userId: string; nama: string; namaDepan: string; avatarUrl: string | null
  roleLabel: string; roleColor: string; sapaan: string
  taAktif: { id?: string; nama: string; semester: number; jam_pelajaran?: string | null } | null
  dashboardVisibility?: Record<string, boolean>
}

type PplScheduleRow = {
  penugasan_mengajar_id: string
  guru_utama: string
  nama_mapel: string
  tingkat: number
  nomor_kelas: number
  kelompok: string | null
  hari: number | null
  jam_list: string | null
}

type LessonSlot = { id: number; mulai: string; selesai: string }

const DAY_NAMES: Record<number, string> = {
  1: 'Senin', 2: 'Selasa', 3: 'Rabu', 4: 'Kamis', 5: 'Jumat', 6: 'Sabtu', 7: 'Minggu',
}

function getSlotsForDay(raw: string | null | undefined, day: number): LessonSlot[] {
  try {
    const parsed = JSON.parse(raw || '[]')
    if (!Array.isArray(parsed) || parsed.length === 0) return []
    const patterns = parsed[0]?.slots === undefined && parsed[0]?.hari === undefined
      ? [{ hari: [1, 2, 3, 4, 5, 6, 7], slots: parsed }]
      : parsed
    const pattern = patterns.find((item: any) => Array.isArray(item.hari) && item.hari.map(Number).includes(day))
    return Array.isArray(pattern?.slots)
      ? pattern.slots.map((slot: any) => ({ id: Number(slot.id), mulai: String(slot.mulai || ''), selesai: String(slot.selesai || '') }))
      : []
  } catch {
    return []
  }
}

function lessonTimeLabel(row: PplScheduleRow, jamPelajaran: string | null | undefined) {
  const jam = String(row.jam_list || '').split(',').map(Number).filter(Number.isFinite).sort((a, b) => a - b)
  if (jam.length === 0 || row.hari === null) return { jamKe: 'Jam belum diatur', waktu: '—' }
  const first = jam[0]
  const last = jam[jam.length - 1]
  const slots = getSlotsForDay(jamPelajaran, row.hari)
  const mulai = slots.find(slot => slot.id === first)?.mulai
  const selesai = slots.find(slot => slot.id === last)?.selesai
  return {
    jamKe: first === last ? `Jam ke-${first}` : `Jam ke-${first}–${last}`,
    waktu: mulai && selesai ? `${mulai}–${selesai}` : 'Waktu belum diatur',
  }
}

export async function GuruPPLDashboard({ userId, taAktif, dashboardVisibility }: Props) {
  const show = (id: string) => dashboardVisibility?.[id] !== false
  const db = await getDB()
  const today = todayWIB()
  
  // Ambil mapping aktif sekaligus jadwal mingguan untuk tahun ajaran berjalan.
  const { results: rawMappings } = taAktif?.id ? await db.prepare(`
    SELECT
      m.penugasan_mengajar_id,
      u.nama_lengkap AS guru_utama,
      mp.nama_mapel,
      k.tingkat,
      k.nomor_kelas,
      k.kelompok,
      jm.hari,
      GROUP_CONCAT(jm.jam_ke) AS jam_list
    FROM guru_ppl_mapping m
    JOIN penugasan_mengajar pm ON pm.id = m.penugasan_mengajar_id
    JOIN "user" u ON m.guru_utama_id = u.id
    JOIN mata_pelajaran mp ON mp.id = pm.mapel_id
    JOIN kelas k ON k.id = pm.kelas_id
    LEFT JOIN jadwal_mengajar jm
      ON jm.penugasan_id = pm.id
      AND jm.tahun_ajaran_id = pm.tahun_ajaran_id
    WHERE m.guru_ppl_id = ?
      AND m.berlaku_mulai <= ?
      AND (m.berlaku_selesai IS NULL OR m.berlaku_selesai >= ?)
      AND m.penugasan_mengajar_id IS NOT NULL
      AND pm.tahun_ajaran_id = ?
    GROUP BY m.penugasan_mengajar_id, u.nama_lengkap, mp.nama_mapel,
      k.tingkat, k.nomor_kelas, k.kelompok, jm.hari
    ORDER BY COALESCE(jm.hari, 8), MIN(jm.jam_ke), k.tingkat, k.nomor_kelas, mp.nama_mapel
  `).bind(userId, today, today, taAktif.id).all<PplScheduleRow>() : { results: [] as PplScheduleRow[] }

  const mappings = rawMappings || []
  const tkbm = new Set(mappings.map(mapping => mapping.penugasan_mengajar_id)).size

  // Ambil list guru utama yang digantikan (unik)
  const guruDigantikan = Array.from(new Set(mappings.map(m => m.guru_utama)))
  const scheduleGroups = Array.from(new Set(mappings.map(mapping => mapping.hari ?? 0)))
    .sort((a, b) => (a || 8) - (b || 8))
    .map(day => ({ day, rows: mappings.filter(mapping => (mapping.hari ?? 0) === day) }))
  const todayNumber = (() => {
    const day = new Date(`${today}T00:00:00`).getDay()
    return day === 0 ? 7 : day
  })()

  return (
    <div className="space-y-3 animate-in fade-in duration-500 pb-12">
      

      {(show('status_praktik') || show('menu_cepat')) && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Ringkasan Tugas */}
        {show('status_praktik') && (
        <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-900/10 shadow-sm overflow-hidden p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-800 border border-emerald-200 dark:border-emerald-700">
              <Info className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">Status Praktik Anda</h3>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">Anda menggantikan {guruDigantikan.length} Guru</p>
            </div>
          </div>
          
          <div className="space-y-2 mb-4">
            {guruDigantikan.length > 0 ? (
              <div className="text-xs text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Menyubstitusi:</span> {guruDigantikan.join(', ')}
              </div>
            ) : (
              <div className="text-xs text-amber-600 italic">Belum ada tugas penggantian yang ditugaskan kepada Anda.</div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2">
            <div className="bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 p-2 text-center">
              <p className="text-xl font-bold text-slate-800 dark:text-slate-200">{tkbm}</p>
              <p className="text-[10px] text-slate-500">Mapel–Kelas</p>
            </div>
          </div>
        </div>
        )}

        {/* Cepat Menu */}
        {show('menu_cepat') && (
        <div className="space-y-3">
          <Link href="/dashboard/agenda" className="group flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30">
                <Calendar className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:text-indigo-400 transition-colors">Isi Agenda (KBM)</h4>
                <p className="text-[11px] text-slate-500">Isi agenda harian kelas</p>
              </div>
            </div>
            <PlayCircle className="h-4 w-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
          </Link>

          <Link href="/dashboard/nilai-harian" className="group flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-rose-300 dark:hover:border-rose-700 transition-colors shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-900/30">
                <ClipboardList className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-rose-600 dark:text-rose-400 transition-colors">Nilai Harian</h4>
                <p className="text-[11px] text-slate-500">Input nilai evaluasi siswa</p>
              </div>
            </div>
            <PlayCircle className="h-4 w-4 text-slate-300 group-hover:text-rose-500 transition-colors" />
          </Link>
        </div>
        )}
      </div>
      )}

      {show('status_praktik') && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5 dark:border-slate-800">
            <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-2 dark:border-indigo-900 dark:bg-indigo-950/40">
              <Calendar className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Jadwal Praktik Mingguan</h3>
              <p className="text-[11px] text-slate-500">Kelas dan pelajaran yang menjadi tanggung jawab Anda sebagai PPL.</p>
            </div>
          </div>

          {scheduleGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center text-slate-400">
              <BookOpen className="h-7 w-7" />
              <p className="text-xs">Belum ada mapel–kelas yang dimapping kepada Anda.</p>
            </div>
          ) : (
            <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
              {scheduleGroups.map(group => {
                const isToday = group.day === todayNumber
                return (
                  <div key={group.day} className={`overflow-hidden rounded-xl border ${isToday ? 'border-indigo-200 bg-indigo-50/40 dark:border-indigo-800 dark:bg-indigo-950/20' : 'border-slate-200 dark:border-slate-800'}`}>
                    <div className="flex items-center justify-between border-b border-inherit px-3 py-2.5">
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{group.day ? DAY_NAMES[group.day] : 'Jadwal belum diatur'}</p>
                        <p className="text-[10px] text-slate-500">{group.rows.length} sesi mengajar</p>
                      </div>
                      {isToday && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[9px] font-bold text-white">Hari ini</span>}
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {group.rows.map(row => {
                        const time = lessonTimeLabel(row, taAktif?.jam_pelajaran)
                        return (
                          <div key={`${row.penugasan_mengajar_id}-${row.hari ?? 0}`} className="p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{row.nama_mapel}</p>
                                <p className="mt-0.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">Kelas {formatNamaKelas(row.tingkat, row.nomor_kelas, row.kelompok)}</p>
                              </div>
                              <div className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-right dark:bg-slate-800">
                                <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200">{time.waktu}</p>
                                <p className="text-[9px] text-slate-500">{time.jamKe}</p>
                              </div>
                            </div>
                            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500">
                              <Clock className="h-3 w-3" />
                              <span>Guru utama: <span className="font-medium text-slate-700 dark:text-slate-300">{row.guru_utama}</span></span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
