import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { getUserRoles } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { getStaffInbox } from '@/lib/staff-notification-inbox'
import { openStaffNotification } from './actions'

export const metadata = { title: 'Notifikasi Kelas Binaan - MANSATAS App' }
export const dynamic = 'force-dynamic'

export default async function WaliInboxPage({ searchParams }: { searchParams: Promise<{ before?: string; filter?: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const db = await getDB()
  const roles = await getUserRoles(db,user.id)
  if (!roles.some(role => ['wali_kelas','super_admin','admin_tu','kepsek','wakamad'].includes(role))) redirect('/dashboard')
  const params = await searchParams
  const unread = params.filter === 'unread'
  const inbox = await getStaffInbox(db,user.id,{before:params.before,unread})
  const olderParams = new URLSearchParams({before:inbox.nextCursor || '', ...(unread ? {filter:'unread'} : {})})
  return <div className="w-full space-y-4 pb-12">
    <PageHeader title="Notifikasi Masuk" description="Laporan yang diterima akun Anda tersimpan di sini, termasuk catatan kehadiran siswa binaan.">
      <Link href="/dashboard/kelas-binaan" className="rounded-lg border px-3 py-2 text-xs font-semibold">Kembali ke Kelas Binaan</Link>
    </PageHeader>
    <div className="flex flex-wrap items-center gap-2">
      <Link href="/dashboard/kelas-binaan/notifikasi" aria-current={!unread ? 'page' : undefined} className={`rounded-lg border px-3 py-2 text-sm ${!unread ? 'border-amber-300 bg-amber-50 text-amber-900' : ''}`}>Semua</Link>
      <Link href="/dashboard/kelas-binaan/notifikasi?filter=unread" aria-current={unread ? 'page' : undefined} className={`rounded-lg border px-3 py-2 text-sm ${unread ? 'border-amber-300 bg-amber-50 text-amber-900' : ''}`}>Belum dibaca ({inbox.unreadCount})</Link>
    </div>
    <p className="text-xs leading-5 text-muted-foreground">Isi laporan menunjukkan catatan saat notifikasi dikirim. Buka laporan untuk memeriksa data terbaru dan melakukan koreksi. Riwayat mulai tersimpan setelah fitur ini aktif.</p>
    <section aria-label="Daftar notifikasi" className="divide-y rounded-xl border bg-surface">
      {inbox.items.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">{unread ? 'Semua notifikasi sudah dibaca.' : 'Belum ada notifikasi masuk.'}</p> : inbox.items.map(item => <article key={item.id} className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-sm font-semibold">{item.title}</h2>
          <span className={`text-xs ${item.read_at ? 'text-muted-foreground' : 'font-semibold text-amber-700'}`}>{item.read_at ? 'Sudah dibaca' : 'Belum dibaca'}</span>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{item.message}</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <time dateTime={`${item.created_at.replace(' ','T')}Z`} className="text-xs text-muted-foreground">{new Date(`${item.created_at.replace(' ','T')}Z`).toLocaleString('id-ID',{timeZone:'Asia/Jakarta',dateStyle:'medium',timeStyle:'short'})} WIB</time>
          <form action={openStaffNotification}>
            <input type="hidden" name="id" value={item.id} />
            <button className="min-h-10 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900" type="submit">{item.event_key === 'attendance_homeroom_alert' ? 'Buka & koreksi absensi' : 'Buka notifikasi'}</button>
          </form>
        </div>
      </article>)}
    </section>
    {inbox.nextCursor && <Link className="inline-block rounded-lg border px-4 py-2 text-sm font-semibold" href={`/dashboard/kelas-binaan/notifikasi?${olderParams}`}>Lihat notifikasi lebih lama</Link>}
    {params.before && <Link className="ml-3 inline-block text-sm text-muted-foreground underline" href={`/dashboard/kelas-binaan/notifikasi${unread ? '?filter=unread' : ''}`}>Kembali ke terbaru</Link>}
  </div>
}
