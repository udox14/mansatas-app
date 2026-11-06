import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { getUserRoles } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { getStaffInbox } from '@/lib/staff-notification-inbox'
import { getAttendanceCorrectionReviewer } from '@/lib/attendance-correction-reviewer'
import { openStaffNotification } from './actions'

export const metadata = { title: 'Notifikasi Kelas Binaan - MANSATAS App' }
export const dynamic = 'force-dynamic'

export default async function WaliInboxPage({ searchParams }: { searchParams: Promise<{ before?: string; filter?: string; scope?: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const db = await getDB()
  const params = await searchParams
  const corrections = params.scope === 'koreksi'
  const allowed = corrections ? await getAttendanceCorrectionReviewer(db, user.id) :
    (await getUserRoles(db, user.id)).some(role => ['wali_kelas','super_admin','admin_tu','kepsek','wakamad'].includes(role))
  if (!allowed) redirect('/dashboard')
  const unread = params.filter === 'unread'
  const inbox = await getStaffInbox(db,user.id,{before:params.before,unread,corrections})
  function inboxHref(onlyUnread: boolean, before?: string) {
    const query = new URLSearchParams()
    if (corrections) query.set('scope', 'koreksi')
    if (onlyUnread) query.set('filter', 'unread')
    if (before) query.set('before', before)
    return `/dashboard/kelas-binaan/notifikasi${query.size ? `?${query}` : ''}`
  }
  return <div className="w-full space-y-4 pb-12">
    <PageHeader title={corrections ? 'Notifikasi Ajuan Koreksi' : 'Notifikasi Masuk'}
      description={corrections ? 'Pemberitahuan ajuan koreksi Alfa yang masuk untuk diperiksa.' : 'Notifikasi siswa binaan: kehadiran, pelanggaran, sanksi, surat peringatan, dan klarifikasi kedisiplinan.'}>
      <Link href={corrections ? '/dashboard/keterangan-absensi' : '/dashboard/kelas-binaan'} className="rounded-lg border px-3 py-2 text-xs font-semibold">{corrections ? 'Kembali ke Persetujuan Koreksi' : 'Kembali ke Kelas Binaan'}</Link>
    </PageHeader>
    <div className="flex flex-wrap items-center gap-2">
      <Link href={inboxHref(false)} aria-current={!unread ? 'page' : undefined} className={`rounded-lg border px-3 py-2 text-sm ${!unread ? 'border-amber-300 bg-amber-50 text-amber-900' : ''}`}>Semua</Link>
      <Link href={inboxHref(true)} aria-current={unread ? 'page' : undefined} className={`rounded-lg border px-3 py-2 text-sm ${unread ? 'border-amber-300 bg-amber-50 text-amber-900' : ''}`}>Belum dibaca ({inbox.unreadCount})</Link>
    </div>
    <p className="text-xs leading-5 text-muted-foreground">{corrections ? 'Buka ajuan untuk melihat status dan keputusan terbaru.' : 'Isi laporan menunjukkan catatan saat notifikasi dikirim. Buka laporan untuk memeriksa data terbaru dan melakukan koreksi. Riwayat mulai tersimpan setelah fitur ini aktif.'}</p>
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
            {corrections && <input type="hidden" name="scope" value="koreksi" />}
            <button className="min-h-10 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900" type="submit">{corrections ? 'Tinjau ajuan' : item.event_key === 'attendance_homeroom_alert' ? 'Buka & koreksi absensi' : 'Buka notifikasi'}</button>
          </form>
        </div>
      </article>)}
    </section>
    {inbox.nextCursor && <Link className="inline-block rounded-lg border px-4 py-2 text-sm font-semibold" href={inboxHref(unread, inbox.nextCursor)}>Lihat notifikasi lebih lama</Link>}
    {params.before && <Link className="ml-3 inline-block text-sm text-muted-foreground underline" href={inboxHref(unread)}>Kembali ke terbaru</Link>}
  </div>
}
