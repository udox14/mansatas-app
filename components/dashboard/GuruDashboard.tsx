// components/dashboard/GuruDashboard.tsx
import { JadwalMengajarToday } from './shared/JadwalMengajarToday'
import { KehadiranPribadiCard } from './shared/KehadiranPribadiCard'
import { PenugasanMasukCard } from './shared/PenugasanMasukCard'

type Props = {
  userId: string; nama: string; namaDepan: string; avatarUrl: string | null
  roleLabel: string; roleColor: string; sapaan: string
  taAktif: { id?: string; nama: string; semester: number } | null
  isGuruPiket?: boolean
  dashboardVisibility?: Record<string, boolean>
}

export async function GuruDashboard({ userId, nama, namaDepan, avatarUrl, roleLabel, roleColor, sapaan, taAktif, isGuruPiket, dashboardVisibility }: Props) {
  const show = (id: string) => dashboardVisibility?.[id] !== false
  return (
    <div className="grid items-start gap-4 xl:grid-cols-2 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">


      {show('kehadiran_pribadi') && <KehadiranPribadiCard userId={userId} />}

      {/* Penugasan Masuk (jika dia guru piket) */}
      {isGuruPiket && <PenugasanMasukCard userId={userId} />}

      {/* Jadwal via Shared Component */}
      {show('jadwal_mengajar') && <JadwalMengajarToday userId={userId} taAktif={taAktif} showAbsensiAction={true} />}
    </div>
  )
}
