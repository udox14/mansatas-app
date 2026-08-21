const encoder = new TextEncoder()

export async function constantTimeSecretEqual(received: string | null | undefined, expected: string | null | undefined) {
  if (!received || !expected) return false
  const [left, right] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(received)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ])
  const a = new Uint8Array(left)
  const b = new Uint8Array(right)
  let mismatch = a.length ^ b.length
  const length = Math.max(a.length, b.length)
  for (let index = 0; index < length; index++) mismatch |= (a[index] || 0) ^ (b[index] || 0)
  return mismatch === 0
}
