// components/dashboard/GuruDashboard.tsx
import { JadwalMengajarToday } from './shared/JadwalMengajarToday'
import { KehadiranPribadiCard } from './shared/KehadiranPribadiCard'
import { PenugasanMasukCard } from './shared/PenugasanMasukCard'

type Props = {
  userId: string; nama: string; namaDepan: string; avatarUrl: string | null
  roleLabel: string; roleColor: string; sapaan: string
  taAktif: { id?: string; nama: string; semester: number } | null
  isGuruPiket?: boolean
}

export async function GuruDashboard({ userId, nama, namaDepan, avatarUrl, roleLabel, roleColor, sapaan, taAktif, isGuruPiket }: Props) {
  return (
    <div className="space-y-3 animate-in fade-in duration-500 pb-12">
      

      <KehadiranPribadiCard userId={userId} />

      {/* Penugasan Masuk (jika dia guru piket) */}
      {isGuruPiket && <PenugasanMasukCard userId={userId} />}

      {/* Jadwal via Shared Component */}
      <JadwalMengajarToday userId={userId} taAktif={taAktif} showAbsensiAction={true} />
    </div>
  )
}
