import { redirect } from 'next/navigation'
import { MessageCircle, Play, RefreshCcw, SendHorizonal } from 'lucide-react'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { WA_FEATURE_ID, ensureWhatsAppTables, previewWhatsAppRecipients, type WaTargetScope } from '@/lib/whatsapp'
import { createWhatsappCampaignAction, processWhatsappOutboxAction } from './actions'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>
}

function one(value: string | string[] | undefined, fallback = '') {
  if (Array.isArray(value)) return value[0] || fallback
  return value || fallback
}

function parseScope(value: string): WaTargetScope {
  return ['all', 'kelas', 'tingkat', 'siswa'].includes(value) ? value as WaTargetScope : 'all'
}

function statusClass(status: string) {
  if (['sent', 'delivered', 'read', 'completed'].includes(status)) return 'bg-emerald-100 text-emerald-700'
  if (['failed', 'canceled'].includes(status)) return 'bg-rose-100 text-rose-700'
  if (['sending', 'processing'].includes(status)) return 'bg-sky-100 text-sky-700'
  return 'bg-slate-100 text-slate-700'
}

export default async function WhatsAppPage({ searchParams }: PageProps) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, WA_FEATURE_ID)
  if (!allowed) redirect('/dashboard')
  await ensureWhatsAppTables(db)

  const params = await Promise.resolve(searchParams || {})
  const targetScope = parseScope(one(params.target_scope, 'all'))
  const kelasId = one(params.kelas_id)
  const tingkatRaw = one(params.tingkat)
  const tingkat = tingkatRaw ? Number.parseInt(tingkatRaw, 10) : null
  const siswaIdsText = one(params.siswa_ids)
  const siswaIds = siswaIdsText.split(',').map(item => item.trim()).filter(Boolean)

  const [kelasRows, tingkatRows, preview, campaignRows, outboxRows, statRows] = await Promise.all([
    db.prepare(`
      SELECT id, tingkat, nomor_kelas, kelompok
      FROM kelas
      ORDER BY tingkat, kelompok, CAST(nomor_kelas AS INTEGER)
    `).all<any>(),
    db.prepare(`
      SELECT DISTINCT tingkat
      FROM kelas
      ORDER BY tingkat ASC
    `).all<any>(),
    previewWhatsAppRecipients(db, targetScope, { kelasId, tingkat, siswaIds }),
    db.prepare(`
      SELECT wc.*, u.nama_lengkap AS created_by_name
      FROM wa_campaigns wc
      LEFT JOIN "user" u ON u.id = wc.created_by
      ORDER BY wc.created_at DESC
      LIMIT 20
    `).all<any>(),
    db.prepare(`
      SELECT id, purpose, recipient_phone, recipient_name, status, scheduled_at, sent_at, error_message
      FROM wa_outbox
      ORDER BY created_at DESC
      LIMIT 20
    `).all<any>(),
    db.prepare(`
      SELECT status, COUNT(*) AS cnt
      FROM wa_outbox
      GROUP BY status
    `).all<any>(),
  ])

  const stats = new Map((statRows.results || []).map((row: any) => [row.status, row.cnt]))
  const selectedKelas = kelasRows.results?.find((row: any) => row.id === kelasId)
  const targetLabel = targetScope === 'kelas' && selectedKelas
    ? `Kelas ${selectedKelas.tingkat}-${selectedKelas.nomor_kelas}${selectedKelas.kelompok ? ` ${selectedKelas.kelompok}` : ''}`
    : targetScope === 'tingkat' && tingkat
      ? `Tingkat ${tingkat}`
      : targetScope === 'siswa'
        ? `${siswaIds.length} siswa pilihan`
        : 'Semua siswa aktif'

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-600" />
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Kirim WhatsApp</h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">Outbox WhatsApp untuk notifikasi ALFA dan broadcast teks via WABLAS.</p>
        </div>
        <form action={processWhatsappOutboxAction}>
          <button className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <Play className="h-4 w-4" />
            Proses Outbox
          </button>
        </form>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ['Queued', stats.get('queued') || 0],
          ['Sent', stats.get('sent') || 0],
          ['Delivered', stats.get('delivered') || 0],
          ['Failed', stats.get('failed') || 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[11px] font-medium uppercase text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <RefreshCcw className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Target & Preview</h2>
        </div>
        <form className="mt-4 grid gap-3 md:grid-cols-4" method="GET">
          <label className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            Target
            <select name="target_scope" defaultValue={targetScope} className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="all">Semua siswa aktif</option>
              <option value="kelas">Per kelas</option>
              <option value="tingkat">Per tingkat</option>
              <option value="siswa">Siswa pilihan</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            Kelas
            <select name="kelas_id" defaultValue={kelasId} className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="">Pilih kelas</option>
              {(kelasRows.results || []).map((row: any) => (
                <option key={row.id} value={row.id}>
                  {row.tingkat}-{row.nomor_kelas}{row.kelompok ? ` ${row.kelompok}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            Tingkat
            <select name="tingkat" defaultValue={tingkatRaw} className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="">Pilih tingkat</option>
              {(tingkatRows.results || []).map((row: any) => (
                <option key={row.tingkat} value={row.tingkat}>Tingkat {row.tingkat}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            ID siswa pilihan
            <input name="siswa_ids" defaultValue={siswaIdsText} placeholder="id1,id2,id3" className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
          </label>
          <div className="md:col-span-4">
            <button className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-900 px-3 text-xs font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900">
              <RefreshCcw className="h-4 w-4" />
              Preview Target
            </button>
          </div>
        </form>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-950">
            <p className="text-[11px] font-medium text-slate-500">Target</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{targetLabel}</p>
          </div>
          <div className="rounded-md bg-emerald-50 p-3 dark:bg-emerald-950/30">
            <p className="text-[11px] font-medium text-emerald-700">Nomor valid unik</p>
            <p className="mt-1 text-sm font-semibold text-emerald-800 dark:text-emerald-300">{preview.totalValidRecipients}</p>
          </div>
          <div className="rounded-md bg-amber-50 p-3 dark:bg-amber-950/30">
            <p className="text-[11px] font-medium text-amber-700">Nomor kosong/invalid</p>
            <p className="mt-1 text-sm font-semibold text-amber-800 dark:text-amber-300">{preview.totalInvalidOrEmpty}</p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <SendHorizonal className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Buat Broadcast</h2>
        </div>
        <form action={createWhatsappCampaignAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <input type="hidden" name="target_scope" value={targetScope} />
          <input type="hidden" name="kelas_id" value={kelasId} />
          <input type="hidden" name="tingkat" value={tingkatRaw} />
          <input type="hidden" name="siswa_ids" value={siswaIdsText} />
          <label className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            Judul campaign
            <input name="title" required placeholder="Info kegiatan / Tagihan DSPT" className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            Purpose
            <select name="purpose" defaultValue="school_announcement" className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="school_announcement">Pengumuman sekolah</option>
              <option value="billing_reminder">Tagihan DSPT</option>
              <option value="achievement_info">Info prestasi</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            Template
            <input name="template_name" placeholder="Opsional, dipakai kalau provider Meta" className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              Kategori
              <select name="category" defaultValue="utility" className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950">
                <option value="utility">Utility</option>
                <option value="marketing">Marketing</option>
                <option value="service">Service</option>
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              Bahasa
              <input name="language_code" defaultValue="id" className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
            </label>
          </div>
          <label className="space-y-1 text-xs font-medium text-slate-600 md:col-span-2 dark:text-slate-300">
            Isi teks
            <textarea name="body_text" required rows={5} placeholder="Tulis isi pesan yang akan dikirim ke WhatsApp." className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
            <p className="text-xs text-slate-500">Akan enqueue ke {preview.totalValidRecipients} nomor valid unik.</p>
            <button className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-700">
              <SendHorizonal className="h-4 w-4" />
              Enqueue Broadcast
            </button>
          </div>
        </form>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Campaign Terbaru</h2>
          <div className="mt-3 space-y-2">
            {(campaignRows.results || []).length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada campaign.</p>
            ) : (campaignRows.results || []).map((row: any) => (
              <div key={row.id} className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{row.title}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass(row.status)}`}>{row.status}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{row.total_enqueued}/{row.total_recipients} penerima - {row.created_by_name || '-'}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Outbox Terbaru</h2>
          <div className="mt-3 space-y-2">
            {(outboxRows.results || []).length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada outbox.</p>
            ) : (outboxRows.results || []).map((row: any) => (
              <div key={row.id} className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{row.recipient_name || row.recipient_phone}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass(row.status)}`}>{row.status}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{row.purpose} - {row.recipient_phone} - jadwal {row.scheduled_at}</p>
                {row.error_message && <p className="mt-1 text-xs text-rose-600">{row.error_message}</p>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
