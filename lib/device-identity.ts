export const DEVICE_ID_COOKIE = 'mansatas_device_id'

export function getDeviceId(hdrs: Headers | null) {
  if (!hdrs) return null
  const cookie = hdrs.get('cookie') || ''
  for (const part of cookie.split(';')) {
    const [name, ...value] = part.trim().split('=')
    if (name === DEVICE_ID_COOKIE) {
      const id = decodeURIComponent(value.join('='))
      return /^[0-9a-f-]{20,64}$/i.test(id) ? id : null
    }
  }
  return null
}
