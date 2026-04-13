// Lokasi: app/dashboard/agenda/actions-piket.ts
'use server'

import { getDB, dbInsert } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'
import { uploadToR2 } from '@/utils/r2'
import type { PolaJam, SlotJam } from '@/app/dashboard/settings/types'
import { nowWIB, currentTimeWIB, todayWIB } from '@/lib/time'
import { getEffectiveUser, getActAsDate } from '@/lib/act-as'

// ============================================================
// TYPES
// ============================================================
export type PiketShiftData = {
  jadwal_id: string
  user_id: string
  guru_nama: string
  shift_id: number
  shift_nama: string
  jam_mulai: number   // nomor jam pelajaran mulai
  jam_selesai: number // nomor jam pelajaran selesai
  slot_mulai: string  // HH:mm resolved dari jam_pelajaran
  slot_selesai: string
  hari: number
  sudah_isi: boolean
  agenda_id?: string
  status?: string
  foto_url?: string
  waktu_submit?: string
}

// ============================================================
// HELPER: resolve slot jam dari pola jam pelajaran
// ============================================================
function getPolaHariIni(polaJamRaw: string, hari: number): SlotJam[] {
  let polaList: PolaJam[] = []
  try { polaList = JSON.parse(polaJamRaw) } catch { return [] }
  const pola = polaList.find(p => p.hari.includes(hari))
  return pola?.slots ?? []
}

function getHariNumber(date: Date): number {
  const day = date.getUTCDay()
  return day === 0 ? 7 : day
}

// ============================================================
// 1. AMBIL JADWAL PIKET HARI INI (untuk tab Piket di agenda guru)
//    Mengembalikan semua shift piket yang dimiliki user di hari ini
//    beserta status apakah sudah isi agenda_piket hari ini
// ============================================================
export async function getJadwalPiketHariIni(dateOverride?: string): Promise<{
  error: string | null
  shifts: PiketShiftData[]
  tanggal: string
  hari: number
}> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', shifts: [], tanggal: '', hari: 0 }

  // Cek act-as
  const effective = await getEffectiveUser()
  const userId = effective?.isActingAs ? effective.effectiveUserId : user.id

  const db = await getDB()

  // Resolusi tanggal
  let tanggal: string
  let hari: number
  const resolvedDateOverride = dateOverride || (await getActAsDate()) || null
  if (resolvedDateOverride && /^\d{4}-\d{2}-\d{2}$/.test(resolvedDateOverride)) {
    tanggal = resolvedDateOverride
    const d = new Date(resolvedDateOverride + 'T00:00:00')
    const day = d.getDay()
    hari = day === 0 ? 7 : day
  } else {
    const now = nowWIB()
    tanggal = now.toISOString().split('T')[0]
    hari = getHariNumber(now)
  }

  if (hari === 7) return { error: null, shifts: [], tanggal, hari }

  // Ambil TA aktif untuk resolve slot jam
  const ta = await db.prepare(
    'SELECT id, jam_pelajaran FROM tahun_ajaran WHERE is_active = 1 LIMIT 1'
  ).first<any>()
  const slots: SlotJam[] = ta ? getPolaHariIni(ta.jam_pelajaran || '[]', hari) : []

  // Query jadwal piket user hari ini + cek agenda_piket existing
  const result = await db.prepare(`
    SELECT
      j.id as jadwal_id,
      j.user_id,
      u.nama_lengkap as guru_nama,
      s.id as shift_id,
      s.nama_shift,
      s.jam_mulai,
      s.jam_selesai,
      ap.id as agenda_id,
      ap.status as agenda_status,
      ap.foto_url,
      ap.waktu_submit
    FROM jadwal_guru_piket j
    JOIN pengaturan_shift_piket s ON j.shift_id = s.id
    JOIN "user" u ON j.user_id = u.id
    LEFT JOIN agenda_piket ap ON ap.jadwal_id = j.id AND ap.tanggal = ?
    WHERE j.user_id = ? AND j.hari = ?
    ORDER BY s.id ASC
  `).bind(tanggal, userId, hari).all<any>()

  const rows = result.results || []
  if (rows.length === 0) return { error: null, shifts: [], tanggal, hari }

  const shiftData: PiketShiftData[] = rows.map(r => {
    const slotMulai = slots.find(s => s.id === r.jam_mulai)
    const slotSelesai = slots.find(s => s.id === r.jam_selesai)
    return {
      jadwal_id: r.jadwal_id,
      user_id: r.user_id,
      guru_nama: r.guru_nama,
      shift_id: r.shift_id,
      shift_nama: r.nama_shift,
      jam_mulai: r.jam_mulai,
      jam_selesai: r.jam_selesai,
      slot_mulai: slotMulai?.mulai ?? '??:??',
      slot_selesai: slotSelesai?.selesai ?? '??:??',
      hari,
      sudah_isi: !!r.agenda_id,
      agenda_id: r.agenda_id ?? undefined,
      status: r.agenda_status ?? undefined,
      foto_url: r.foto_url ?? undefined,
      waktu_submit: r.waktu_submit ?? undefined,
    }
  })

  return { error: null, shifts: shiftData, tanggal, hari }
}

// ============================================================
// 2. SUBMIT AGENDA PIKET (guru)
//    Form: hanya foto (waktu submit otomatis = nowWIB())
//    Validasi: hanya bisa di dalam jam shift (bypass Act As)
//    Status: HADIR jika ≤10 menit dari jam mulai shift, TELAT jika >10 menit
// ============================================================
export async function submitAgendaPiket(formData: FormData): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const effective = await getEffectiveUser()
  const isActingAs = effective?.isActingAs || false
  const userId = isActingAs && effective?.effectiveUserId ? effective.effectiveUserId : user.id

  const jadwalId = formData.get('jadwal_id') as string
  const shiftId = parseInt(formData.get('shift_id') as string)
  const tanggal = formData.get('tanggal') as string
  const slotMulai = formData.get('slot_mulai') as string   // HH:mm
  const slotSelesai = formData.get('slot_selesai') as string
  const foto = formData.get('foto') as File | null

  if (!jadwalId || !tanggal) return { error: 'Data tidak lengkap.' }
  if (!foto || foto.size === 0) return { error: 'Foto wajib diambil sebagai bukti kehadiran.' }

  const db = await getDB()

  // Cek apakah sudah diisi
  const existing = await db.prepare(
    'SELECT id FROM agenda_piket WHERE jadwal_id = ? AND tanggal = ?'
  ).bind(jadwalId, tanggal).first<any>()
  if (existing) return { error: 'Agenda piket hari ini sudah diisi.' }

  const { hhmm: currentTime } = currentTimeWIB()

  // Validasi waktu shift (bypass jika Act As)
  if (!isActingAs && slotMulai && slotSelesai) {
    const [mulaiH, mulaiM] = slotMulai.split(':').map(Number)
    const [selesaiH, selesaiM] = slotSelesai.split(':').map(Number)
    const mulaiMinutes = mulaiH * 60 + mulaiM - 5  // toleransi 5 menit sebelum
    const selesaiMinutes = selesaiH * 60 + selesaiM
    const [curH, curM] = currentTime.split(':').map(Number)
    const currentMinutes = curH * 60 + curM

    if (currentMinutes < mulaiMinutes) {
      return { error: `Belum waktunya. Bisa isi mulai pukul ${slotMulai}.` }
    }
    if (currentMinutes > selesaiMinutes) {
      return { error: `Waktu pengisian sudah berakhir (batas: ${slotSelesai}).` }
    }
  }

  // Hitung status: HADIR jika ≤10 menit dari jam mulai, TELAT jika lebih
  let status: string
  if (isActingAs) {
    status = 'HADIR'
  } else {
    const [mulaiH2, mulaiM2] = slotMulai.split(':').map(Number)
    const batasTepat = mulaiH2 * 60 + mulaiM2 + 10
    const [curH2, curM2] = currentTime.split(':').map(Number)
    status = (curH2 * 60 + curM2) <= batasTepat ? 'HADIR' : 'TELAT'
  }

  // Upload foto ke R2
  const ext = foto.type === 'image/png' ? 'png' : foto.type === 'image/webp' ? 'webp' : 'jpg'
  const fileName = `piket_${userId}_${Date.now()}.${ext}`
  const uploadResult = await uploadToR2(foto, 'agenda_piket', fileName)
  if (uploadResult.error) return { error: `Gagal upload foto: ${uploadResult.error}` }

  const payload = {
    user_id: userId,
    jadwal_id: jadwalId,
    shift_id: shiftId,
    tanggal,
    foto_url: uploadResult.url,
    status,
    waktu_submit: nowWIB().toISOString(),
    diubah_oleh: effective?.realUserId || user.id,
  }

  const result = await dbInsert(db, 'agenda_piket', payload)
  if (result.error) {
    if (result.error.includes('UNIQUE')) return { error: 'Agenda piket sudah diisi hari ini.' }
    return { error: result.error }
  }

  revalidatePath('/dashboard/agenda')
  return { success: `Kehadiran piket berhasil dicatat! Status: ${status === 'HADIR' ? 'Hadir Tepat Waktu' : 'Telat'}` }
}
