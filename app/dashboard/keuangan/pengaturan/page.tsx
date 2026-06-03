import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { checkFeatureAccess } from '@/lib/features'
import { getSystemSetting } from '@/lib/system-settings'
import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { PengaturanKomiteClient } from './pengaturan-client'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Pengaturan Komite | Keuangan MANSATAS' }

export default async function PengaturanKomitePage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, session.user.id, 'keuangan-pengaturan')
  if (!allowed) redirect('/dashboard')

  const settings = {
    bankLabel: await getSystemSetting('keuangan_komite_bank_label', 'BJB Syariah'),
    rekening: await getSystemSetting('keuangan_komite_rekening', '5160256984318'),
    atasNama: await getSystemSetting('keuangan_komite_atas_nama', 'Komite MAN 1 Tasikmalaya'),
    whatsapp: await getSystemSetting('keuangan_komite_whatsapp', '6282215860650'),
    qrisUrl: await getSystemSetting('keuangan_komite_qris_url', '/QRISkomite.jpeg'),
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <PageHeader
        title="Pengaturan Komite"
        description="Kelola rekening, kontak, dan QR code pembayaran yang tampil di Portal Orang Tua."
      />
      <PengaturanKomiteClient initialSettings={settings} />
    </div>
  )
}
