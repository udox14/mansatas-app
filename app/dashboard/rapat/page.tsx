import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { RapatClient } from './components/RapatClient'
import { formatTanggalPanjang } from '@/lib/time'
import { getUserRoles } from '@/lib/features'
import { ALL_ROLES } from '@/config/menu'
import { PageHeader } from '@/components/layout/page-header'
import { getAllUsersForCheckbox } from './actions'

export const dynamic = 'force-dynamic'

export default async function RapatPage() {
  const user = await getCurrentUser()
  if (!user) return null

  const db = await getDB()

  // 1. Undangan Masuk (sebagai peserta)
  const undanganMasukRaw = await db.prepare(`
    SELECT
      pr.id as peserta_id, pr.status_kehadiran, pr.alasan_tidak_hadir,
      ur.id as rapat_id, ur.agenda, ur.tanggal, ur.waktu, ur.tempat, ur.catatan,
      p.nama_lengkap as pengundang_nama
    FROM peserta_rapat pr
    JOIN undangan_rapat ur ON pr.rapat_id = ur.id
    JOIN "user" p ON ur.pengundang_id = p.id
    WHERE pr.user_id = ?
    ORDER BY ur.tanggal DESC, ur.waktu DESC
  `).bind(user.id).all<any>()

  const undanganMasuk = (undanganMasukRaw.results || []).map((r: any) => ({
    ...r,
    tanggalFmt: formatTanggalPanjang(r.tanggal)
  }))

  // 2. Undangan Dibuat (jika admin)
  let rapatDibuat: any[] = []
  const roles = await getUserRoles(db, user.id)
  const canCreate = roles.some(r => ['super_admin', 'admin_tu', 'kepsek'].includes(r))

  if (canCreate) {
    const rapatDibuatRaw = await db.prepare(`
      SELECT
        ur.id, ur.agenda, ur.tanggal, ur.waktu, ur.tempat, ur.created_at,
        (SELECT COUNT(*) FROM peserta_rapat WHERE rapat_id = ur.id) as total_peserta,
        (SELECT COUNT(*) FROM peserta_rapat WHERE rapat_id = ur.id AND status_kehadiran = 'HADIR') as total_hadir,
        (SELECT COUNT(*) FROM peserta_rapat WHERE rapat_id = ur.id AND status_kehadiran = 'TIDAK_HADIR') as total_tidak_hadir,
        (SELECT COUNT(*) FROM peserta_rapat WHERE rapat_id = ur.id AND status_kehadiran = 'BELUM_RESPOND') as total_belum
      FROM undangan_rapat ur
      WHERE ur.pengundang_id = ?
      ORDER BY ur.tanggal DESC, ur.waktu DESC
    `).bind(user.id).all<any>()

    rapatDibuat = (rapatDibuatRaw.results || []).map((r: any) => ({
      ...r,
      tanggalFmt: formatTanggalPanjang(r.tanggal)
    }))
  }

  // 3. Semua user untuk checkbox (hanya load jika admin)
  const allUsers = canCreate ? await getAllUsersForCheckbox() : []

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Undangan Rapat"
        description="Kelola jadwal pertemuan, undangan rapat dinas, dan konfirmasi kehadiran."
      />

      <RapatClient
        undanganMasuk={undanganMasuk}
        rapatDibuat={rapatDibuat}
        canCreate={canCreate}
        roles={[...ALL_ROLES]}
        allUsers={allUsers}
      />
    </div>
  )
}
