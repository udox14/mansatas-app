export const COOKIE_NAME = 'session_token'

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
