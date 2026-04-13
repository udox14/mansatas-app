// Lokasi: app/dashboard/program-unggulan/actions.ts
'use server'

import { getDB } from '@/utils/db'
import { revalidatePath } from 'next/cache'
import { todayWIB } from '@/lib/time'
import { getActAsDate } from '@/lib/act-as'

// ============================================================
// TYPES
// ============================================================
type PuKelasGuru = {
  pu_kelas_id: string
  kelas_id: string
  tingkat: number
  nomor_kelas: string
  kelompok: string
  jam_mengajar: number
  pu_guru_kelas_id: string
}

type SiswaToTest = {
  hasil_id: string
  siswa_id: string
  nama_lengkap: string
  foto_url: string | null
  status: string
  nilai: string | null
}

// Mapping jam mengajar → jumlah siswa dites
const JAM_TO_SISWA: Record<number, number> = { 1: 1, 2: 3, 3: 4, 4: 5 }

// ============================================================
// 1. GET KELAS UNGGULAN UNTUK GURU
// ============================================================
export async function getKelasUnggulanGuru(guruId: string, dateOverride?: string) {
  const db = await getDB()
  const ta = await db.prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<{ id: string }>()
  if (!ta) return { data: [], error: 'Tahun ajaran aktif belum diatur' }

  let todayStr = todayWIB()
  const resolvedDate = dateOverride || (await getActAsDate()) || null
  if (resolvedDate && /^\d{4}-\d{2}-\d{2}$/.test(resolvedDate)) {
    todayStr = resolvedDate
  }

  // Cari hari dari string YYYY-MM-DD menggunakan Date UTC agar tidak tergeser zona waktu lokal
  const [y, m, d] = todayStr.split('-').map(Number)
  const dateObj = new Date(Date.UTC(y, m - 1, d))
  let hari = dateObj.getUTCDay()
  if (hari === 0) hari = 7

  // Ambil kelas unggulan yang diajar oleh guru ini PADA HARI INI berdasarkan jadwal nyata
  const result = await db.prepare(`
    SELECT
      pk.id       AS pu_kelas_id,
      k.id        AS kelas_id,
      k.tingkat, k.nomor_kelas, k.kelompok,
      COUNT(jm.jam_ke) AS jam_mengajar,
      'legacy'    AS pu_guru_kelas_id
    FROM penugasan_mengajar pm
    JOIN jadwal_mengajar jm ON jm.penugasan_id = pm.id
    JOIN pu_kelas_unggulan pk ON pk.kelas_id = pm.kelas_id AND pk.tahun_ajaran_id = pm.tahun_ajaran_id
    JOIN kelas k ON pm.kelas_id = k.id
    WHERE (pm.guru_id = ? OR pk.id IN (SELECT pu_kelas_id FROM guru_ppl_mapping WHERE guru_ppl_id = ?)) 
      AND pm.tahun_ajaran_id = ? AND jm.hari = ?
    GROUP BY pk.id, k.id, k.tingkat, k.nomor_kelas, k.kelompok
    ORDER BY k.tingkat, k.kelompok, k.nomor_kelas
  `).bind(guruId, guruId, ta.id, hari).all<PuKelasGuru>()

  return { data: result.results || [], error: null }
}

// ============================================================
// 2. GET / GENERATE DAFTAR SISWA TES HARI INI
//    Queue round-robin: siswa dgn tes selesai paling sedikit diprioritaskan
//    Sharing antar guru: siswa yg sudah di-assign hari ini oleh guru lain di-exclude
// ============================================================
export async function getSiswaTesList(puKelasId: string, guruId: string, jamMengajar: number, dateOverride?: string) {
  const db = await getDB()

  let today = todayWIB()
  const resolvedDate = dateOverride || (await getActAsDate()) || null
  if (resolvedDate && /^\d{4}-\d{2}-\d{2}$/.test(resolvedDate)) {
    today = resolvedDate
  }

  const jumlahSiswa = JAM_TO_SISWA[jamMengajar] ?? 3

  // Cek apakah sudah ada assignment untuk guru ini hari ini di kelas ini
  const existing = await db.prepare(`
    SELECT ht.id AS hasil_id, ht.siswa_id, s.nama_lengkap, s.foto_url, ht.status, ht.nilai
    FROM pu_hasil_tes ht
    JOIN siswa s ON ht.siswa_id = s.id
    WHERE ht.pu_kelas_id = ? AND ht.guru_id = ? AND ht.tanggal = ?
    ORDER BY s.nama_lengkap
  `).bind(puKelasId, guruId, today).all<SiswaToTest>()

  if (existing.results && existing.results.length > 0) {
    return { data: existing.results, isNew: false, error: null }
  }

  // Belum ada → generate baru
  // 1. Ambil kelas_id dari pu_kelas_unggulan
  const puKelas = await db.prepare('SELECT kelas_id FROM pu_kelas_unggulan WHERE id = ?').bind(puKelasId).first<{ kelas_id: string }>()
  if (!puKelas) return { data: [], isNew: false, error: 'Kelas unggulan tidak ditemukan' }

  // 2. Semua siswa aktif di kelas ini
  const allSiswa = await db.prepare(`
    SELECT id AS siswa_id, nama_lengkap, foto_url
    FROM siswa WHERE kelas_id = ? AND status = 'aktif'
  `).bind(puKelas.kelas_id).all<{ siswa_id: string; nama_lengkap: string; foto_url: string | null }>()
  const students = allSiswa.results || []
  if (students.length === 0) return { data: [], isNew: false, error: 'Tidak ada siswa aktif di kelas ini' }

  // 3. Hitung tes selesai per siswa di kelas ini (status='sudah')
  const completedCounts = await db.prepare(`
    SELECT siswa_id, COUNT(*) AS cnt
    FROM pu_hasil_tes
    WHERE pu_kelas_id = ? AND status = 'sudah'
    GROUP BY siswa_id
  `).bind(puKelasId).all<{ siswa_id: string; cnt: number }>()
  const countMap = new Map((completedCounts.results || []).map(r => [r.siswa_id, r.cnt]))

  // 4. Siswa yang sudah di-assign hari ini (oleh guru manapun)
  const todayAssigned = await db.prepare(`
    SELECT siswa_id FROM pu_hasil_tes
    WHERE pu_kelas_id = ? AND tanggal = ?
  `).bind(puKelasId, today).all<{ siswa_id: string }>()
  const todaySet = new Set((todayAssigned.results || []).map(r => r.siswa_id))

  // 5. Cari min completed count
  const studentCounts = students.map(s => ({
    ...s,
    completed: countMap.get(s.siswa_id) || 0
  }))
  const minCompleted = Math.min(...studentCounts.map(s => s.completed))

  // 6. Queue = siswa dgn completed == minCompleted, belum di-assign hari ini
  let queue = studentCounts.filter(s => s.completed === minCompleted && !todaySet.has(s.siswa_id))

  // Jika queue kurang, ambil dari round berikutnya
  if (queue.length < jumlahSiswa) {
    const nextQueue = studentCounts
      .filter(s => s.completed === minCompleted + 1 && !todaySet.has(s.siswa_id))
    queue = [...queue, ...nextQueue]
  }

  // Jika masih kurang, ambil siapapun yg belum di-assign hari ini
  if (queue.length < jumlahSiswa) {
    const remaining = studentCounts
      .filter(s => !todaySet.has(s.siswa_id) && !queue.find(q => q.siswa_id === s.siswa_id))
      .sort((a, b) => a.completed - b.completed)
    queue = [...queue, ...remaining]
  }

  if (queue.length === 0) {
    return { data: [], isNew: false, error: 'Semua siswa sudah di-assign tes hari ini' }
  }

  // 7. Shuffle & take
  const shuffled = queue.sort(() => Math.random() - 0.5)
  const selected = shuffled.slice(0, Math.min(jumlahSiswa, shuffled.length))
  const roundNumber = minCompleted + 1

  // 8. Batch insert ke pu_hasil_tes
  const stmts = selected.map(s =>
    db.prepare(`
      INSERT INTO pu_hasil_tes (pu_kelas_id, siswa_id, guru_id, tanggal, status, round_number)
      VALUES (?, ?, ?, ?, 'belum', ?)
    `).bind(puKelasId, s.siswa_id, guruId, today, roundNumber)
  )
  await db.batch(stmts)

  // 9. Ambil hasil yg baru diinsert
  const newResult = await db.prepare(`
    SELECT ht.id AS hasil_id, ht.siswa_id, s.nama_lengkap, s.foto_url, ht.status, ht.nilai
    FROM pu_hasil_tes ht
    JOIN siswa s ON ht.siswa_id = s.id
    WHERE ht.pu_kelas_id = ? AND ht.guru_id = ? AND ht.tanggal = ?
    ORDER BY s.nama_lengkap
  `).bind(puKelasId, guruId, today).all<SiswaToTest>()

  return { data: newResult.results || [], isNew: true, error: null }
}

// ============================================================
// 3. SIMPAN NILAI TES
// ============================================================
export async function simpanNilaiTes(hasilId: string, nilai: string) {
  const db = await getDB()
  try {
    await db.prepare(`
      UPDATE pu_hasil_tes SET nilai = ?, status = 'sudah', updated_at = datetime('now')
      WHERE id = ?
    `).bind(nilai, hasilId).run()
    revalidatePath('/dashboard/program-unggulan')
    return { success: true, error: null }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ============================================================
// 4. TANDAI TIDAK HADIR
// ============================================================
export async function tandaiTidakHadir(hasilId: string, statusAbsen: 'sakit' | 'izin' | 'alfa') {
  const db = await getDB()
  try {
    await db.prepare(`
      UPDATE pu_hasil_tes SET status = ?, nilai = NULL, updated_at = datetime('now')
      WHERE id = ?
    `).bind(statusAbsen, hasilId).run()
    revalidatePath('/dashboard/program-unggulan')
    return { success: true, error: null }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ============================================================
// 5. RESET STATUS (kembali ke 'belum' jika salah input)
// ============================================================
export async function resetStatusTes(hasilId: string) {
  const db = await getDB()
  try {
    await db.prepare(`
      UPDATE pu_hasil_tes SET status = 'belum', nilai = NULL, updated_at = datetime('now')
      WHERE id = ?
    `).bind(hasilId).run()
    revalidatePath('/dashboard/program-unggulan')
    return { success: true, error: null }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ============================================================
// 6. GET MATERI TES UNTUK KELAS
//    Mengirim format HTML legacy agar sesuai dengan tes-client
// ============================================================
export async function getMateriTes(puKelasId: string) {
  const db = await getDB()

  // Ambil materi mingguan aktif (urut dari yang terbaru)
  const result = await db.prepare(`
    SELECT m.id, m.program, m.minggu_mulai, m.konten
    FROM pu_materi_mingguan m
    JOIN pu_materi_mingguan_kelas mk ON mk.materi_id = m.id
    WHERE mk.pu_kelas_id = ?
    ORDER BY m.minggu_mulai DESC, m.created_at DESC
  `).bind(puKelasId).all<{ id: string; program: string; minggu_mulai: string; konten: string }>()

  const HARI_NAMES: Record<number, string> = { 1: 'Senin', 2: 'Selasa', 3: 'Rabu', 4: 'Kamis', 5: 'Jumat', 6: 'Sabtu' }

  return (result.results || []).map((row, index) => {
    let judul = `Materi ${row.program === 'tahfidz' ? 'Tahfidz' : row.program === 'bahasa_arab' ? 'Bahasa Arab' : 'Bahasa Inggris'} (Mulai ${row.minggu_mulai})`
    let html = ''
    try {
      const data = JSON.parse(row.konten)

      if (row.program === 'tahfidz') {
        judul = `Tahfidz: Surah ${data.surat || ''} (${data.nama_arab || ''})`
        let tableHtml = '<table class="w-full text-sm"><thead><tr><th>Hari</th><th>Ayat</th><th>Teks</th></tr></thead><tbody>'
        for (let i = 1; i <= 6; i++) {
          const h = data.hari?.[i]
          if (h && (h.dari || h.sampai)) {
            tableHtml += `<tr>
              <td class="font-semibold whitespace-nowrap">${HARI_NAMES[i]}</td>
              <td class="whitespace-nowrap pb-2">Ayat ${h.dari} - ${h.sampai || h.dari}</td>
              <td dir="rtl" class="font-arabic text-right text-lg leading-loose">${h.teks_arab || '-'}</td>
            </tr>`
          }
        }
        tableHtml += '</tbody></table>'
        html = tableHtml
      }
      else if (row.program === 'bahasa_arab') {
        let listHtml = '<div class="space-y-4">'
        for (let i = 1; i <= 6; i++) {
          const items = data.hari?.[i]
          if (items && items.length > 0 && items.some((x: any) => x.kata || x.arti)) {
            listHtml += `<div class="border rounded p-3"><h4 class="font-bold text-blue-600 mb-2">${HARI_NAMES[i]}</h4><table class="w-full text-sm"><tbody>`
            for (const item of items) {
              if (!item.kata && !item.arti) continue
              listHtml += `<tr>
                <td dir="rtl" class="font-arabic text-right text-lg py-1">${item.kata || ''}</td>
                <td class="text-left py-1 pl-3 border-l text-gray-600">${item.arti || ''}</td>
              </tr>`
            }
            listHtml += '</tbody></table></div>'
          }
        }
        listHtml += '</div>'
        html = listHtml
      }
      else if (row.program === 'bahasa_inggris') {
        let contentHtml = '<div class="space-y-4">'
        for (let i = 1; i <= 6; i++) {
          const dayData = data.hari?.[i]
          if (!dayData) continue

          if (typeof dayData === 'string') {
            // Legacy format string
            if (dayData.trim() !== '') {
              contentHtml += `<div class="border rounded p-3"><h4 class="font-bold text-violet-600 mb-2">${HARI_NAMES[i]}</h4><p class="whitespace-pre-wrap">${dayData}</p></div>`
            }
          } else {
            // New table format
            const { vocab, phrasal } = dayData
            let hasVocab = vocab && vocab.length > 0 && vocab.some((v: any) => v.word)
            let hasPhrasal = phrasal && (phrasal.verb || phrasal.arti || phrasal.contoh)

            if (hasVocab || hasPhrasal) {
              contentHtml += `<div class="border rounded px-3 py-2"><h4 class="font-bold text-violet-600 mb-2 pb-1 border-b">${HARI_NAMES[i]}</h4>`

              if (hasVocab) {
                contentHtml += `<table class="w-full text-xs text-left mb-3">
                  <thead class="bg-gray-100">
                    <tr><th class="p-1">Word</th><th class="p-1">Phonetic</th><th class="p-1">Cara Baca</th><th class="p-1">POS</th><th class="p-1">Meaning</th></tr>
                  </thead>
                  <tbody>`
                vocab.forEach((v: any) => {
                  if (v.word) contentHtml += `<tr class="border-b">
                    <td class="p-1 font-semibold">${v.word}</td>
                    <td class="p-1 text-gray-500">${v.phonetic}</td>
                    <td class="p-1 text-blue-600">${v.cara_baca}</td>
                    <td class="p-1 text-xs text-gray-400">${v.pos}</td>
                    <td class="p-1">${v.meaning}</td>
                  </tr>`
                })
                contentHtml += '</tbody></table>'
              }

              if (hasPhrasal) {
                contentHtml += `<table class="w-full text-xs text-left">
                  <thead class="bg-gray-100">
                    <tr><th class="p-1 w-1/4">PV</th><th class="p-1 w-1/4">Arti</th><th class="p-1">Contoh</th></tr>
                  </thead>
                  <tbody>
                    <tr class="border-b">
                      <td class="p-1 font-semibold text-amber-600">${phrasal.verb || '-'}</td>
                      <td class="p-1">${phrasal.arti || '-'}</td>
                      <td class="p-1 italic text-gray-600">${phrasal.contoh || '-'}</td>
                    </tr>
                  </tbody>
                </table>`
              }
              contentHtml += '</div>'
            }
          }
        }
        contentHtml += '</div>'
        html = contentHtml
      }
    } catch (e) {
      html = '<p class="text-red-500">Format konten tidak valid</p>'
    }

    return {
      id: row.id,
      judul,
      konten: html || '<p class="text-gray-400">Belum ada materi untuk minggu ini.</p>',
      urutan: index
    }
  })
}
