// Lokasi: app/dashboard/buku-tamu/components/buku-tamu-page-wrapper.tsx
// Server component — fetch data awal lalu render client components

import { getDB } from '@/utils/db'
import { todayWIB } from '@/lib/time'
import { BukuTamuClient } from './buku-tamu-client'
import { BukuTamuAdminClient } from './buku-tamu-admin-client'
import { BukuTamuPageTabs } from './buku-tamu-page-tabs'
import type { EntriTamu } from '../actions'

interface Props {
  userId: string
  userRoles: string[]
  isAdmin: boolean
}

export async function BukuTamuPageWrapper({ userId, userRoles, isAdmin }: Props) {
  const db = await getDB()
  const today = todayWIB()

  // Fetch data tamu hari ini
  const { results: tamuHariIniRaw } = await db.prepare(`
    SELECT bt.id, bt.tanggal, bt.waktu, bt.kategori, bt.nama, bt.instansi,
           bt.maksud_tujuan, bt.foto_url, bt.dicatat_oleh, bt.created_at,
           u.nama_lengkap as pencatat_nama
    FROM buku_tamu bt
    LEFT JOIN "user" u ON bt.dicatat_oleh = u.id
    WHERE bt.tanggal = ?
    ORDER BY bt.waktu DESC
  `).bind(today).all<any>()

  const tamuHariIni: EntriTamu[] = tamuHariIniRaw || []

  // Fetch data untuk admin monitoring (semua, default tanpa filter)
  let adminData: EntriTamu[] = []
  let adminTotal = 0
  if (isAdmin) {
    const [dataRes, countRes] = await Promise.all([
      db.prepare(`
        SELECT bt.id, bt.tanggal, bt.waktu, bt.kategori, bt.nama, bt.instansi,
               bt.maksud_tujuan, bt.foto_url, bt.dicatat_oleh, bt.created_at,
               u.nama_lengkap as pencatat_nama
        FROM buku_tamu bt
        LEFT JOIN "user" u ON bt.dicatat_oleh = u.id
        ORDER BY bt.tanggal DESC, bt.waktu DESC
        LIMIT 50
      `).all<any>(),
      db.prepare('SELECT COUNT(*) as total FROM buku_tamu').first<any>(),
    ])
    adminData = dataRes.results || []
    adminTotal = countRes?.total || 0
  }

  return (
    <BukuTamuPageTabs
      tamuHariIni={tamuHariIni}
      userRoles={userRoles}
      isAdmin={isAdmin}
      adminData={adminData}
      adminTotal={adminTotal}
    />
  )
}
