// Browser push endpoints only. Never fetch a URL chosen freely by the client.
export function validPushEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false
  try {
    const url = new URL(value)
    const host = url.hostname
    return url.protocol === 'https:' && !url.port && !url.username && !url.password && !url.hash
      && (((host === 'fcm.googleapis.com' || host === 'android.googleapis.com') && url.pathname.startsWith('/fcm/send/'))
        || host === 'updates.push.services.mozilla.com' || host.endsWith('.push.apple.com')
        || host.endsWith('.notify.windows.com') || host.endsWith('.wns.windows.com'))
  } catch {
    return false
  }
}

export function validPushKeys(p256dh: unknown, auth: unknown): p256dh is string {
  return typeof p256dh === 'string' && typeof auth === 'string'
    && /^B[A-Za-z0-9_-]{86}=?$/.test(p256dh) && /^[A-Za-z0-9_-]{22}={0,2}$/.test(auth)
}
