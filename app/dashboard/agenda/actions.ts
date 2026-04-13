// Lokasi: app/dashboard/agenda/actions.ts
'use server'

import { getDB, dbInsert, dbUpdate } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'
import { uploadToR2 } from '@/utils/r2'
import type { PolaJam, SlotJam } from '@/app/dashboard/settings/types'
import { nowWIB, currentTimeWIB } from '@/lib/time'
import { formatNamaKelas } from '@/lib/utils'
import { getEffectiveUser, getActAsDate } from '@/lib/act-as'

// ============================================================
// TYPES
// ============================================================
type JadwalBlock = {
  penugasan_id: string
  mapel_nama: string
  kelas_label: string
  kelas_id: string
  guru_id: string
  guru_nama: string
  jam_ke_mulai: number
  jam_ke_selesai: number
  slot_mulai: string   // HH:mm
  slot_selesai: string // HH:mm
  sudah_isi: boolean
  agenda_id?: string
  status?: string
}

// ============================================================
// HELPER: parse pola jam dari tahun_ajaran
// ============================================================
function getPolaHariIni(polaJamRaw: string, hari: number): SlotJam[] {
  let polaList: PolaJam[] = []
  try { polaList = JSON.parse(polaJamRaw) } catch { return [] }
  const pola = polaList.find(p => p.hari.includes(hari))
  return pola?.slots ?? []
}

function getHariNumber(date: Date): number {
  // Untuk nowWIB() objects: gunakan getUTCDay() karena sudah digeser +7 jam
  // Untuk date biasa dengan string 'T00:00:00': gunakan getDay()
  const day = date.getUTCDay() // 0=Minggu, 1=Senin...6=Sabtu
  return day === 0 ? 7 : day // convert ke 1=Senin..7=Minggu
}

// ============================================================
// 1. AMBIL JADWAL GURU HARI INI (untuk form isi agenda)
//    Menerima optional guruId untuk fitur Act As
//    dan dateOverride untuk admin memilih tanggal
//    Mengelompokkan jam berurutan jadi satu "blok"
// ============================================================
export async function getJadwalGuruHariIni(guruIdOverride?: string, dateOverride?: string): Promise<{
  error: string | null
  blocks: JadwalBlock[]
  slots: SlotJam[]
  tanggal: string
  hari: number
}> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', blocks: [], slots: [], tanggal: '', hari: 0 }

  // Gunakan guruIdOverride jika tersedia (dari Act As), atau cek cookie act-as, fallback ke user.id
  let guruId = guruIdOverride || user.id
  if (!guruIdOverride) {
    const effective = await getEffectiveUser()
    if (effective?.isActingAs) {
      guruId = effective.effectiveUserId
    }
  }

  const db = await getDB()

  // Gunakan dateOverride jika tersedia (admin memilih tanggal)
  // Jika tidak ada explicit override, baca dari cookie act-as-date
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

  if (hari === 7) return { error: null, blocks: [], slots: [], tanggal, hari }

  // Ambil TA aktif + jam_pelajaran
  const ta = await db.prepare(
    'SELECT id, jam_pelajaran FROM tahun_ajaran WHERE is_active = 1 LIMIT 1'
  ).first<any>()
  if (!ta) return { error: 'Tahun ajaran aktif belum diatur', blocks: [], slots: [], tanggal, hari }

  const slots = getPolaHariIni(ta.jam_pelajaran || '[]', hari)
  if (slots.length === 0) return { error: null, blocks: [], slots: [], tanggal, hari }

  // Ambil jadwal hari ini + existing agenda dalam 1 query
  const result = await db.prepare(`
    SELECT
      jm.penugasan_id,
      jm.jam_ke,
      mp.nama_mapel,
      k.tingkat, k.nomor_kelas, k.kelompok, k.id as kelas_id,
      pm.guru_id,
      u.nama_lengkap as guru_nama,
      ag.id as agenda_id,
      ag.status as agenda_status
    FROM jadwal_mengajar jm
    JOIN penugasan_mengajar pm ON jm.penugasan_id = pm.id
    JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
    JOIN kelas k ON pm.kelas_id = k.id
    JOIN "user" u ON pm.guru_id = u.id
    LEFT JOIN agenda_guru ag ON ag.penugasan_id = jm.penugasan_id AND ag.tanggal = ?
    WHERE jm.tahun_ajaran_id = ? AND jm.hari = ? 
      AND (pm.guru_id = ? OR jm.id IN (SELECT jadwal_mengajar_id FROM guru_ppl_mapping WHERE guru_ppl_id = ?))
    ORDER BY jm.jam_ke ASC
  `).bind(tanggal, ta.id, hari, guruId, guruId).all<any>()

  const rows = result.results || []
  if (rows.length === 0) return { error: null, blocks: [], slots, tanggal, hari }

  // Group per penugasan_id → collect jam_ke → build blocks
  const grouped = new Map<string, { rows: any[], jamList: number[] }>()
  for (const r of rows) {
    const key = r.penugasan_id
    if (!grouped.has(key)) grouped.set(key, { rows: [r], jamList: [r.jam_ke] })
    else { grouped.get(key)!.rows.push(r); grouped.get(key)!.jamList.push(r.jam_ke) }
  }

  const blocks: JadwalBlock[] = []
  for (const [pid, data] of grouped) {
    const jamList = data.jamList.sort((a, b) => a - b)
    const first = data.rows[0]
    const jamMulai = jamList[0]
    const jamSelesai = jamList[jamList.length - 1]
    const slotMulai = slots.find(s => s.id === jamMulai)
    const slotSelesai = slots.find(s => s.id === jamSelesai)

    blocks.push({
      penugasan_id: pid,
      mapel_nama: first.nama_mapel,
      kelas_label: formatNamaKelas(first.tingkat, first.nomor_kelas, first.kelompok),
      kelas_id: first.kelas_id,
      guru_id: first.guru_id,
      guru_nama: first.guru_nama,
      jam_ke_mulai: jamMulai,
      jam_ke_selesai: jamSelesai,
      slot_mulai: slotMulai?.mulai ?? '??:??',
      slot_selesai: slotSelesai?.selesai ?? '??:??',
      sudah_isi: !!first.agenda_id,
      agenda_id: first.agenda_id ?? undefined,
      status: first.agenda_status ?? undefined,
    })
  }

  blocks.sort((a, b) => a.jam_ke_mulai - b.jam_ke_mulai)
  return { error: null, blocks, slots, tanggal, hari }
}

// ============================================================
// 2. SUBMIT AGENDA (guru)
//    Validasi: hanya bisa di jam pelajarannya (BYPASS untuk Act As)
//    Status: TEPAT_WAKTU jika ≤10 menit dari jam mulai, TELAT jika >10 menit
// ============================================================
export async function submitAgenda(formData: FormData): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  // Cek act-as: jika super admin, gunakan guru_id dari jadwal
  const effective = await getEffectiveUser()
  const isActingAs = effective?.isActingAs || false

  const penugasanId = formData.get('penugasan_id') as string
  const materi = (formData.get('materi') as string)?.trim()
  const foto = formData.get('foto') as File | null
  const tanggal = formData.get('tanggal') as string
  const jamKeMulai = parseInt(formData.get('jam_ke_mulai') as string)
  const jamKeSelesai = parseInt(formData.get('jam_ke_selesai') as string)
  const slotMulai = formData.get('slot_mulai') as string  // HH:mm
  const slotSelesai = formData.get('slot_selesai') as string // HH:mm

  if (!penugasanId || !materi || !tanggal) return { error: 'Materi wajib diisi.' }

  const db = await getDB()

  // Cek apakah sudah diisi
  const existing = await db.prepare(
    'SELECT id FROM agenda_guru WHERE penugasan_id = ? AND tanggal = ?'
  ).bind(penugasanId, tanggal).first<any>()
  if (existing) return { error: 'Agenda untuk jadwal ini sudah diisi hari ini.' }

  // Validasi: hanya bisa input di jam pelajarannya (dari mulai sampai selesai blok)
  const { hours: curH_, minutes: curM_, hhmm: currentTime } = currentTimeWIB()

  // BYPASS validasi waktu jika super admin Act As
  if (!isActingAs) {
    // Guru hanya bisa input mulai dari jam mulai sampai jam selesai bloknya
    // Toleransi: bisa mulai 5 menit sebelum jam mulai
    const [mulaiH, mulaiM] = slotMulai.split(':').map(Number)
    const [selesaiH, selesaiM] = slotSelesai.split(':').map(Number)
    const mulaiMinutes = mulaiH * 60 + mulaiM - 5  // 5 menit toleransi sebelum
    const selesaiMinutes = selesaiH * 60 + selesaiM
    const [curH, curM] = currentTime.split(':').map(Number)
    const currentMinutes = curH * 60 + curM

    if (currentMinutes < mulaiMinutes) {
      return { error: `Belum waktunya. Agenda bisa diisi mulai pukul ${slotMulai}.` }
    }
    if (currentMinutes > selesaiMinutes) {
      return { error: `Waktu pengisian sudah berakhir (batas: ${slotSelesai}).` }
    }
  }

  // Hitung status
  const [mulaiH2, mulaiM2] = slotMulai.split(':').map(Number)
  const batasTepat = mulaiH2 * 60 + mulaiM2 + 10 // 10 menit setelah jam mulai
  const [curH2, curM2] = currentTime.split(':').map(Number)
  const currentMinutes2 = curH2 * 60 + curM2
  // Jika act-as, selalu TEPAT_WAKTU karena diinput oleh admin
  const status = isActingAs ? 'TEPAT_WAKTU' : (currentMinutes2 <= batasTepat ? 'TEPAT_WAKTU' : 'TELAT')

  // Upload foto ke R2 (jika ada)
  let fotoUrl: string | null = null
  if (foto && foto.size > 0) {
    const ext = foto.type === 'image/png' ? 'png' : 'jpg'
    const fileName = `agenda_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`
    const uploadResult = await uploadToR2(foto, 'agenda', fileName)
    if (uploadResult.error) return { error: `Gagal upload foto: ${uploadResult.error}` }
    fotoUrl = uploadResult.url
  }

  // Ambil data penugasan untuk memastikan guru_id yang benar (terutama jika diwakilkan PPL)
  const penugasan = await db.prepare('SELECT guru_id FROM penugasan_mengajar WHERE id = ?').bind(penugasanId).first<any>()
  if (!penugasan) return { error: 'Penugasan tidak ditemukan.' }

  // guru_id yang disimpan harus guru utama pemilik penugasan
  const guruId = penugasan.guru_id

  const payload = {
    guru_id: guruId,
    penugasan_id: penugasanId,
    tanggal,
    jam_ke_mulai: jamKeMulai,
    jam_ke_selesai: jamKeSelesai,
    materi,
    foto_url: fotoUrl,
    status,
    waktu_input: nowWIB().toISOString(),
    diubah_oleh: effective?.realUserId || user.id, // audit trail: siapa admin yang input
  }

  const result = await dbInsert(db, 'agenda_guru', payload)
  if (result.error) {
    if (result.error.includes('UNIQUE')) return { error: 'Agenda sudah diisi untuk jadwal ini.' }
    return { error: result.error }
  }

  revalidatePath('/dashboard/agenda')
  return { success: `Agenda berhasil disimpan! Status: ${status === 'TEPAT_WAKTU' ? 'Tepat Waktu' : 'Telat'}` }
}

// ============================================================
// 3. AMBIL DETAIL AGENDA (untuk modal detail)
// ============================================================
export async function getAgendaDetail(agendaId: string) {
  const db = await getDB()
  const row = await db.prepare(`
    SELECT ag.*,
      u.nama_lengkap as guru_nama,
      mp.nama_mapel,
      k.tingkat, k.nomor_kelas, k.kelompok,
      editor.nama_lengkap as diubah_oleh_nama
    FROM agenda_guru ag
    JOIN penugasan_mengajar pm ON ag.penugasan_id = pm.id
    JOIN "user" u ON ag.guru_id = u.id
    JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
    JOIN kelas k ON pm.kelas_id = k.id
    LEFT JOIN "user" editor ON ag.diubah_oleh = editor.id
    WHERE ag.id = ?
  `).bind(agendaId).first<any>()
  return row ?? null
}

// ============================================================
// 4. AMBIL RIWAYAT MATERI (khusus teks)
// ============================================================
export async function getRiwayatMateri(guruIdOverride?: string): Promise<any[]> {
  const user = await getCurrentUser()
  if (!user) return []

  // Check Act As
  let guruId = guruIdOverride || user.id
  if (!guruIdOverride) {
    const effective = await getEffectiveUser()
    if (effective?.isActingAs) {
      guruId = effective.effectiveUserId
    }
  }

  const db = await getDB()
  const result = await db.prepare(`
    SELECT 
      ag.id, ag.tanggal, ag.materi, ag.waktu_input,
      ag.jam_ke_mulai, ag.jam_ke_selesai,
      mp.nama_mapel,
      k.tingkat, k.nomor_kelas, k.kelompok
    FROM agenda_guru ag
    JOIN penugasan_mengajar pm ON ag.penugasan_id = pm.id
    JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
    JOIN kelas k ON pm.kelas_id = k.id
    WHERE ag.guru_id = ?
    ORDER BY ag.waktu_input DESC
    LIMIT 100
  `).bind(guruId).all<any>()

  return result.results || []
}
