import { JadwalPramubaktiToday } from './shared/JadwalPramubaktiToday'
import { PramubaktiCard } from './shared/PramubaktiCard'
import { JadwalMengajarToday } from './shared/JadwalMengajarToday'

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
  dashboardVisibility?: Record<string, boolean>
}

export async function PramubaktiDashboard({ userId, taAktif, dashboardVisibility }: Props) {
  const show = (id: string) => dashboardVisibility?.[id] !== false

  return (
    <div className="space-y-3 animate-in fade-in duration-500 pb-12">
      {/* Jadwal Tugas Hari Ini (Pramubakti) */}
      {show('jadwal_pramubakti') && <JadwalPramubaktiToday userId={userId} />}

      {/* Jadwal Mengajar (jika juga bertugas mengajar) */}
      {show('jadwal_mengajar') && <JadwalMengajarToday userId={userId} taAktif={taAktif} showAbsensiAction={true} />}

      {/* Performa dan Pekerjaan Bulanan */}
      {show('pramubakti_performa') && <PramubaktiCard userId={userId} />}
    </div>
  )
}
