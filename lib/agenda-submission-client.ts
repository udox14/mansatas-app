export type AgendaSubmissionResult = {
  error?: string
  success?: string
  agenda?: { id: string; status: string }
}

// Fetch tidak memakai antrean Server Action. Abort membebaskan percobaan berikutnya,
// tetapi server mungkin sudah menyimpan: retry aman lewat unique jadwal/tanggal.
export async function sendAgenda(formData: FormData): Promise<AgendaSubmissionResult> {
  if (!navigator.onLine) throw new Error('Perangkat sedang offline. Materi dan foto tetap disimpan; sambungkan internet lalu coba kirim lagi.')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45_000)
  try {
    const response = await fetch('/api/agenda/submit', {
      method: 'POST', body: formData, credentials: 'include', cache: 'no-store', signal: controller.signal,
    })
    if (response.status === 401) throw new Error('Sesi login sudah berakhir. Login kembali, lalu buka Agenda Guru untuk melanjutkan draft.')
    if (response.status === 413) throw new Error('Foto terlalu besar untuk dikirim. Ambil ulang foto; materi tetap disimpan.')
    const parsed: unknown = await response.json().catch(() => null)
    if (!parsed || typeof parsed !== 'object') throw new Error('Respons server tidak dapat dibaca. Status penyimpanan belum dapat dipastikan; coba kirim lagi untuk memeriksa.')
    const result = parsed as AgendaSubmissionResult
    if (!response.ok || result.error) throw new Error(result.error || `Pengiriman gagal (kode ${response.status}). Materi dan foto tetap disimpan; coba kirim lagi.`)
    if (!result.success || typeof result.agenda?.id !== 'string' || !result.agenda.id ||
      !['TEPAT_WAKTU', 'TELAT', 'ALFA', 'SAKIT', 'IZIN'].includes(result.agenda.status)) throw new Error('Server belum mengonfirmasi agenda tersimpan. Materi dan foto tetap disimpan; coba kirim lagi untuk memeriksa.')
    return result
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Pengiriman melewati 45 detik. Status penyimpanan belum dapat dipastikan. Materi dan foto tetap disimpan; coba kirim lagi untuk memeriksa tanpa membuat agenda ganda.')
    if (error instanceof TypeError) throw new Error('Koneksi ke server terputus. Status penyimpanan belum dapat dipastikan. Materi dan foto tetap disimpan; periksa koneksi lalu coba kirim lagi.')
    throw error
  } finally {
    clearTimeout(timer)
  }
}
