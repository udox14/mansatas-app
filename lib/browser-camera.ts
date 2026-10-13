export async function openBrowserCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Kamera di halaman tidak tersedia. Coba buka melalui browser terbaru.')
  let expired = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const request = navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
  }).then(stream => {
    if (expired) { stream.getTracks().forEach(track => track.stop()); throw new Error('Kamera terlambat merespons.') }
    return stream
  })
  try {
    return await Promise.race([request, new Promise<never>((_, reject) => {
      timer = setTimeout(() => { expired = true; reject(new Error('Kamera belum merespons. Pastikan izin kamera diberikan, lalu coba lagi.')) }, 20_000)
    })])
  } finally { clearTimeout(timer) }
}

export async function captureBrowserPhoto(video: HTMLVideoElement): Promise<File> {
  if (!video.videoWidth || !video.videoHeight || video.readyState < 2) throw new Error('Kamera belum siap. Tunggu gambar kamera tampil lalu ambil foto.')
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight))
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Foto gagal diproses. Coba ambil foto lagi.')
  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Pemotretan terlalu lama. Coba ambil foto lagi.')), 10_000)
    try {
      canvas.toBlob(result => {
        clearTimeout(timer)
        if (!result?.size) reject(new Error('Foto gagal diambil. Coba ambil foto lagi.'))
        else resolve(result)
      }, 'image/jpeg', 0.85)
    } catch (error) { clearTimeout(timer); reject(error) }
  })
  return new File([blob], `agenda_${Date.now()}.jpg`, { type: blob.type })
}
