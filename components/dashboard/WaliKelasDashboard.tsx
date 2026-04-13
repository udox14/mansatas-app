// components/dashboard/WaliKelasDashboard.tsx
import Link from 'next/link'
import { getDB } from '@/utils/db'
import { todayWIB } from '@/lib/time'
import { WelcomeStrip } from './shared/WelcomeStrip'
import { FeatureShortcuts } from './shared/FeatureShortcuts'
import { JadwalMengajarToday } from './shared/JadwalMengajarToday'
import { KehadiranPribadiCard } from './shared/KehadiranPribadiCard'
import {
  Library, CalendarCheck, Users, AlertTriangle,
  Star, ClipboardList, Send, ArrowRight, TrendingUp,
  CheckCircle2, BookOpen,
} from 'lucide-react'

type Props = {
  userId: string; nama: string; namaDepan: string; avatarUrl: string | null
  roleLabel: string; roleColor: string; sapaan: string
  taAktif: { id?: string; nama: string; semester: number } | null
}

export async function WaliKelasDashboard({ userId, nama, namaDepan, avatarUrl, roleLabel, roleColor, sapaan, taAktif }: Props) {
  const db = await getDB()
  const today = todayWIB()

  // Cari kelas yang diasuh
  const kelas = await db.prepare(`
    SELECT k.id, k.tingkat, k.nomor_kelas, k.kelompok,
      COUNT(s.id) as jumlah_siswa
    FROM kelas k
    LEFT JOIN siswa s ON s.kelas_id = k.id AND s.status = 'aktif'
    WHERE k.wali_kelas_id = ?
    GROUP BY k.id
  `).bind(userId).first<any>()

  const kelasId = kelas?.id

  const [absensiHariIni, siswaProblematik, agendaTerbaru, delegasiMasuk, rekapBulanan] = kelasId
    ? await Promise.all([
        db.prepare(`
          SELECT
            COUNT(CASE WHEN status = 'SAKIT' THEN 1 END) as sakit,
            COUNT(CASE WHEN status = 'IZIN'  THEN 1 END) as izin,
            COUNT(CASE WHEN status = 'ALFA'  THEN 1 END) as alfa
          FROM izin_tidak_masuk_kelas imk
          JOIN siswa s ON imk.siswa_id = s.id
          WHERE imk.tanggal = ? AND s.kelas_id = ?
        `).bind(today, kelasId).first<any>(),

        db.prepare(`
          SELECT sp.siswa_id, si.nama_lengkap, SUM(mp.poin) as total_poin, COUNT(*) as jumlah_kasus
          FROM siswa_pelanggaran sp
          JOIN siswa si ON sp.siswa_id = si.id
          JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
          WHERE si.kelas_id = ?
          GROUP BY sp.siswa_id ORDER BY total_poin DESC LIMIT 5
        `).bind(kelasId).all<any>().then(r => r.results ?? []),

        db.prepare(`
          SELECT ag.tanggal, mp.nama_mapel, ag.materi
          FROM agenda_guru ag
          JOIN penugasan_mengajar pm ON ag.penugasan_id = pm.id
          JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
          WHERE pm.kelas_id = ?
          ORDER BY ag.created_at DESC LIMIT 3
        `).bind(kelasId).all<any>().then(r => r.results ?? []).catch(() => []),

        db.prepare(`
          SELECT COUNT(*) as cnt FROM delegasi_tugas
          WHERE kepada_user_id = ? AND tanggal = ?
        `).bind(userId, today).first<{ cnt: number }>(),

        // Rekap absensi 7 hari terakhir kelas ini
        db.prepare(`
          SELECT DATE(imk.tanggal) as tgl, COUNT(DISTINCT imk.siswa_id) as tidak_hadir
          FROM izin_tidak_masuk_kelas imk
          JOIN siswa s ON imk.siswa_id = s.id
          WHERE s.kelas_id = ? AND imk.tanggal >= date(?, '-6 days')
          GROUP BY DATE(imk.tanggal) ORDER BY tgl
        `).bind(kelasId, today).all<any>().then(r => r.results ?? []),
      ])
    : [null, [], [], null, []]

  const jumlahSiswa = kelas?.jumlah_siswa ?? 0
  const tidakHadir  = (absensiHariIni as any)?.sakit + (absensiHariIni as any)?.izin + (absensiHariIni as any)?.alfa || 0
  const hadirEst    = Math.max(0, jumlahSiswa - tidakHadir)
  const namaKelas   = kelas ? `${kelas.tingkat}${kelas.kelompok ?? ''}-${kelas.nomor_kelas}` : null
  const delegasiCnt = (delegasiMasuk as any)?.cnt ?? 0
  const maxTidakHadir = Math.max(...(rekapBulanan as any[]).map((r: any) => r.tidak_hadir), 1)
  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

  if (!kelas) {
    return (
      <div className="space-y-3 animate-in fade-in duration-500 pb-12">
        <WelcomeStrip nama={nama} namaDepan={namaDepan} avatarUrl={avatarUrl}
          roleLabel={roleLabel} roleColor={roleColor} taAktif={taAktif} sapaan={sapaan} />
        <div className="rounded-xl border border-surface bg-surface shadow-sm p-8 flex flex-col items-center gap-3 text-center">
          <Library className="h-10 w-10 text-slate-300 dark:text-slate-700" />
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Belum ada kelas yang diasuh</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Hubungi Admin untuk penugasan kelas.</p>
          </div>
        </div>
        <KehadiranPribadiCard userId={userId} />
      </div>
    )
  }

  return (
    <div className="space-y-3 animate-in fade-in duration-500 pb-12">
      <WelcomeStrip nama={nama} namaDepan={namaDepan} avatarUrl={avatarUrl}
        roleLabel={roleLabel} roleColor={roleColor} taAktif={taAktif} sapaan={sapaan} />

      <KehadiranPribadiCard userId={userId} />

      <JadwalMengajarToday userId={userId} taAktif={taAktif} />

      {/* Profil Kelas */}
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-amber-50/30 dark:from-amber-900/20 dark:to-transparent shadow-sm px-5 py-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 shrink-0 rounded-xl bg-amber-500 flex items-center justify-center shadow-sm">
            <Library className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-widest">Wali Kelas</p>
            <p className="text-xl font-bold text-slate-800 dark:text-slate-100">Kelas {namaKelas}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
              <Users className="h-3 w-3" /> {jumlahSiswa} siswa aktif
            </p>
          </div>
        </div>
      </div>

      {/* Kehadiran Kelas Hari Ini */}
      <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
          <div className="p-1.5 rounded-md bg-emerald-50 border border-emerald-100">
            <CalendarCheck className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Kehadiran Kelas Hari Ini</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">Kelas {namaKelas}</p>
          </div>
          <Link href="/dashboard/rekap-absensi" className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1">
            Rekap <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-4 divide-x divide-slate-100 dark:divide-slate-800">
          {[
            { label: 'Hadir', val: hadirEst, color: 'text-emerald-600' },
            { label: 'Sakit', val: (absensiHariIni as any)?.sakit ?? 0, color: 'text-amber-600' },
            { label: 'Izin',  val: (absensiHariIni as any)?.izin  ?? 0, color: 'text-blue-600'  },
            { label: 'Alfa',  val: (absensiHariIni as any)?.alfa  ?? 0, color: 'text-rose-600'  },
          ].map(({ label, val, color }) => (
            <div key={label} className="flex flex-col items-center gap-0.5 py-3">
              <span className={`text-xl font-bold leading-none tabular-nums ${color}`}>{val}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Rekap 7 Hari */}
        <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
            <div className="p-1.5 rounded-md bg-blue-50 border border-blue-100">
              <ClipboardList className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Ketidakhadiran 7 Hari</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Siswa tidak masuk</p>
            </div>
          </div>
          <div className="p-3">
            {(rekapBulanan as any[]).length === 0 ? (
              <div className="flex flex-col items-center gap-1 py-4">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
                <p className="text-xs text-slate-400">Semua siswa hadir minggu ini!</p>
              </div>
            ) : (
              <div className="flex items-end gap-1.5 h-16">
                {(rekapBulanan as any[]).map((row: any, i: number) => {
                  const pct = Math.round((row.tidak_hadir / maxTidakHadir) * 100)
                  const dateObj = new Date(row.tgl + 'T00:00:00')
                  const dayName = dayNames[dateObj.getDay()]
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] text-rose-500 font-bold tabular-nums">{row.tidak_hadir}</span>
                      <div className="w-full flex items-end" style={{ height: 40 }}>
                        <div className="w-full rounded-t bg-rose-400 dark:bg-rose-600 min-h-[4px]"
                          style={{ height: `${Math.max(10, pct)}%` }} />
                      </div>
                      <span className="text-[9px] text-slate-400">{dayName}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Siswa Bermasalah */}
        <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
            <div className="p-1.5 rounded-md bg-rose-50 border border-rose-100">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Perlu Perhatian</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Poin tertinggi di kelas</p>
            </div>
            <Link href="/dashboard/kedisiplinan" className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1">
              Detail <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {(siswaProblematik as any[]).length === 0 ? (
            <div className="flex flex-col items-center gap-1 py-5 text-slate-400">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <p className="text-xs">Tidak ada kasus di kelas ini</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {(siswaProblematik as any[]).slice(0, 4).map((s: any, i: number) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2">
                  <div className="h-7 w-7 shrink-0 rounded-md bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-rose-500">{i + 1}</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-200 flex-1 truncate">{s.nama_lengkap}</p>
                  <span className="text-[10px] font-semibold text-rose-500 shrink-0">+{s.total_poin} poin</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Agenda Terbaru di Kelas */}
      {(agendaTerbaru as any[]).length > 0 && (
        <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
            <div className="p-1.5 rounded-md bg-emerald-50 border border-emerald-100">
              <BookOpen className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Agenda Kelas Terbaru</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Jurnal guru yang telah diisi</p>
            </div>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {(agendaTerbaru as any[]).map((a: any, i: number) => (
              <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                <div className="mt-0.5 shrink-0 h-6 w-6 rounded bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{a.nama_mapel}</p>
                  {a.materi && <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{a.materi}</p>}
                </div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                  {new Date(a.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shortcut Dinamis */}
      <FeatureShortcuts userId={userId} />
    </div>
  )
}
