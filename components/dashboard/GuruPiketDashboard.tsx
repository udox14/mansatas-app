// components/dashboard/GuruPiketDashboard.tsx
import Link from 'next/link'
import { getDB } from '@/utils/db'
import { todayWIB } from '@/lib/time'
import { JadwalMengajarToday } from './shared/JadwalMengajarToday'
import { KehadiranPribadiCard } from './shared/KehadiranPribadiCard'
import { PenugasanMasukCard } from './shared/PenugasanMasukCard'
import {
  MapPin, Clock, Door as DoorOpen, Warning as AlertTriangle,
  CheckCircle as CheckCircle2, ArrowRight,
} from '@phosphor-icons/react/dist/ssr'

type Props = {
  userId: string; nama: string; namaDepan: string; avatarUrl: string | null
  roleLabel: string; roleColor: string; sapaan: string
  taAktif: { id?: string; nama: string; semester: number } | null
  isGuruPiket?: boolean
}

export async function GuruPiketDashboard({ userId, nama, namaDepan, avatarUrl, roleLabel, roleColor, sapaan, taAktif, isGuruPiket }: Props) {
  const db = await getDB()
  const today = todayWIB()

  const [liveData, logHariIni] = await Promise.all([
    db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM izin_keluar_komplek WHERE status = 'BELUM KEMBALI') as di_luar,
        (SELECT COUNT(*) FROM izin_keluar_komplek WHERE DATE(waktu_keluar) = ?) as keluar_hari_ini,
        (SELECT COUNT(*) FROM izin_tidak_masuk_kelas WHERE tanggal = ?) as izin_kelas,
        (SELECT COUNT(*) FROM siswa_pelanggaran WHERE tanggal = ?) as pelanggaran_hari_ini
    `).bind(today, today, today).first<any>(),

    // Log izin keluar hari ini
    db.prepare(`
      SELECT ik.siswa_id, si.nama_lengkap, k.tingkat, k.nomor_kelas, k.kelompok,
        ik.keterangan, ik.waktu_keluar, ik.waktu_kembali, ik.status
      FROM izin_keluar_komplek ik
      JOIN siswa si ON ik.siswa_id = si.id
      JOIN kelas k ON si.kelas_id = k.id
      WHERE DATE(ik.waktu_keluar) = ?
      ORDER BY ik.created_at DESC LIMIT 8
    `).bind(today).all<any>().then(r => r.results ?? []),
  ])

  const diLuar         = liveData?.di_luar ?? 0
  const keluarHariIni  = liveData?.keluar_hari_ini ?? 0
  const izinKelas      = liveData?.izin_kelas ?? 0
  const pelanggaranHariIni = liveData?.pelanggaran_hari_ini ?? 0

  return (
    <div className="space-y-3 animate-in fade-in duration-500 pb-12">
      

      <KehadiranPribadiCard userId={userId} />

      {/* Penugasan Masuk */}
      {isGuruPiket && <PenugasanMasukCard userId={userId} />}

      <JadwalMengajarToday userId={userId} taAktif={taAktif} />
    </div>
  )
}
