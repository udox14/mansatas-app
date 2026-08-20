export const COOKIE_NAME = 'session_token'

// Sesi dibuat sangat panjang agar pengguna tetap login sampai memilih logout.
// Browser atau OS tetap dapat menghapus cookie jika data aplikasi dibersihkan.
export const SESSION_EXPIRY_DAYS = 10 * 365
export const SESSION_MAX_AGE_SECONDS = SESSION_EXPIRY_DAYS * 24 * 60 * 60

export function extractToken(hdrs: Headers): string | null {
  const cookieHeader = hdrs.get('cookie') || ''
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim()
    if (trimmed.startsWith(`${COOKIE_NAME}=`)) {
      return trimmed.slice(COOKIE_NAME.length + 1).split('.')[0]
    }
    if (trimmed.startsWith('better-auth.session_token=')) {
      return trimmed.slice('better-auth.session_token='.length).split('.')[0]
    }
    if (trimmed.startsWith('__Secure-better-auth.session_token=')) {
      return trimmed.slice('__Secure-better-auth.session_token='.length).split('.')[0]
    }
  }
  return null
}
