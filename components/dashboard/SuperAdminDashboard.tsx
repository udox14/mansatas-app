import Link from 'next/link'
import { getDB } from '@/utils/db'
import { todayWIB } from '@/lib/time'
import { StatCard } from './shared/StatCard'
import { JadwalMengajarToday } from './shared/JadwalMengajarToday'
import { KehadiranPribadiCard } from './shared/KehadiranPribadiCard'
import { PenugasanMasukCard } from './shared/PenugasanMasukCard'
import { BreakdownSiswaModal } from './shared/BreakdownSiswaModal'
import {
  BookOpen,
  PaperPlaneTilt as Send,
  Users,
  UserGear as UserCog,
} from '@phosphor-icons/react/dist/ssr'

type Props = {
  userId: string
  nama: string
  namaDepan: string
  avatarUrl: string | null
  roleLabel: string
  roleColor: string
  sapaan: string
  taAktif: { id?: string; nama: string; semester: number } | null
  isGuruPiket?: boolean
  userRoles?: string[]
  primaryRole?: string
}

type AgendaStats = {
  total: number
  filled: number
  percent: number
}

function pct(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0
}

async function getAgendaStats(db: D1Database, today: string, taId?: string): Promise<AgendaStats> {
  if (!taId) return { total: 0, filled: 0, percent: 0 }

  const d = new Date(today + 'T00:00:00')
  const hariIni = d.getDay() === 0 ? 7 : d.getDay()

  const row = await db.prepare(`
    SELECT
      COUNT(DISTINCT jm.penugasan_id) as total,
      COUNT(DISTINCT CASE WHEN ag.id IS NOT NULL THEN jm.penugasan_id END) as filled
    FROM jadwal_mengajar jm
    JOIN penugasan_mengajar pm ON jm.penugasan_id = pm.id
    JOIN kelas k ON pm.kelas_id = k.id
    LEFT JOIN agenda_guru ag ON ag.penugasan_id = jm.penugasan_id AND ag.tanggal = ?
    WHERE jm.tahun_ajaran_id = ?
      AND jm.hari = ?
      AND (k.kbm_nonaktif_mulai IS NULL OR k.kbm_nonaktif_mulai > ?)
  `).bind(today, taId, hariIni, today).first<{ total: number; filled: number }>()

  const total = row?.total ?? 0
  const filled = row?.filled ?? 0
  return { total, filled, percent: pct(filled, total) }
}

export async function SuperAdminDashboard({
  userId,
  taAktif,
  isGuruPiket,
}: Props) {
  const db = await getDB()
  const today = todayWIB()

  const [
    counts,
    penugasan,
    agenda,
    breakdownAngkatan,
    breakdownKelas
  ] = await Promise.all([
    db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM siswa WHERE status = 'aktif') as siswa,
        (SELECT COUNT(*) FROM "user" WHERE nama_lengkap IS NOT NULL) as guru
    `).first<{ siswa: number; guru: number }>(),

    db.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'SELESAI' THEN 1 END) as selesai
      FROM delegasi_tugas WHERE tanggal = ?
    `).bind(today).first<{ total: number; selesai: number }>(),

    getAgendaStats(db, today, taAktif?.id),

    db.prepare(`
      SELECT tahun_masuk as angkatan, COUNT(*) as count 
      FROM siswa 
      WHERE status = 'aktif' AND tahun_masuk IS NOT NULL 
      GROUP BY tahun_masuk 
      ORDER BY tahun_masuk DESC
    `).all<{ angkatan: number; count: number }>(),

    taAktif ? db.prepare(`
      SELECT 
        (k.tingkat || '-' || k.nomor_kelas || COALESCE(' ' || k.kelompok, '')) as kelas, 
        COUNT(s.id) as count 
      FROM siswa s
      JOIN riwayat_kelas rk ON s.id = rk.siswa_id
      JOIN kelas k ON rk.kelas_id = k.id
      WHERE s.status = 'aktif' AND rk.tahun_ajaran_id = ?
      GROUP BY k.id
      ORDER BY k.tingkat ASC, k.nomor_kelas ASC, k.kelompok ASC
    `).bind(taAktif.id).all<{ kelas: string; count: number }>() : Promise.resolve({ results: [] }),
  ])

  const totalSiswa = counts?.siswa ?? 0
  const totalGuru = counts?.guru ?? 0
  const totalDelegasi = penugasan?.total ?? 0
  const selesaiDelegasi = penugasan?.selesai ?? 0

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-16">
      <KehadiranPribadiCard userId={userId} />

      {isGuruPiket && <PenugasanMasukCard userId={userId} />}

      <JadwalMengajarToday userId={userId} taAktif={taAktif} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Siswa Aktif Modal Trigger */}
        <BreakdownSiswaModal 
          total={totalSiswa} 
          angkatan={breakdownAngkatan.results ?? []} 
          kelas={breakdownKelas.results ?? []}
        >
          <div className="group flex items-center gap-3 rounded-2xl bg-white dark:bg-slate-800 p-3 sm:p-4 shadow-sm border border-slate-100 dark:border-slate-700/50 hover:shadow-md transition-all active:scale-[0.98]">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shrink-0">
              <Users className="h-6 w-6" weight="duotone" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5 truncate">Siswa Aktif</p>
              <div className="flex items-end gap-2">
                <p className="text-xl sm:text-2xl font-extrabold text-slate-800 dark:text-slate-50 tracking-tight leading-none tabular-nums">{totalSiswa}</p>
                <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate mb-0.5">Lihat rincian</p>
              </div>
            </div>
          </div>
        </BreakdownSiswaModal>

        <StatCard
          title="Guru & Pegawai"
          value={totalGuru}
          sub="terdaftar"
          icon={<UserCog className="h-6 w-6" weight="duotone" />}
          iconBg="bg-emerald-50 dark:bg-emerald-900/20"
          iconColor="text-emerald-600 dark:text-emerald-400"
          href="/dashboard/guru"
        />

        <StatCard
          title="Agenda Guru"
          value={`${agenda.percent}%`}
          sub={`${agenda.filled} dari ${agenda.total} terisi`}
          icon={<BookOpen className="h-6 w-6" weight="duotone" />}
          iconBg="bg-amber-50 dark:bg-amber-900/20"
          iconColor="text-amber-600 dark:text-amber-400"
          href="/dashboard/monitoring-agenda"
        />

        <StatCard
          title="Delegasi Tugas"
          value={`${selesaiDelegasi} / ${totalDelegasi}`}
          sub={totalDelegasi > 0 && selesaiDelegasi === totalDelegasi ? 'Semua selesai' : 'Sedang berjalan'}
          icon={<Send className="h-6 w-6" weight="duotone" />}
          iconBg="bg-purple-50 dark:bg-purple-900/20"
          iconColor="text-purple-600 dark:text-purple-400"
          href="/dashboard/monitoring-penugasan"
        />
      </div>
    </div>
  )
}
