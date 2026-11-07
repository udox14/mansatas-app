export const DEFAULT_BOS_SIGNER = { name: 'Ade Agus Sukmana, S.Pd.', nip: '19730730214111001' }
export const BOS_SIGNER_NAME_MAX = 120
export const BOS_SIGNER_NIP_MAX = 18
export const BOS_SIGNER_STORAGE_VERSION = 2

export function parseBosSigner(value: unknown) {
  if (!value || typeof value !== 'object' || !('name' in value) || !('nip' in value)) return null
  if (typeof value.name !== 'string' || typeof value.nip !== 'string') return null

  const name = value.name.trim()
  const nip = value.nip.trim()
  if (!name || name.length > BOS_SIGNER_NAME_MAX || /\p{Cc}/u.test(name)) return null
  if (nip.length > BOS_SIGNER_NIP_MAX || /\D/.test(nip)) return null
  return { name, nip }
}

export function readSavedBosSigner(value: unknown) {
  const signer = parseBosSigner(value)
  if (!signer) return DEFAULT_BOS_SIGNER

  const hasVersion = typeof value === 'object' && value !== null && 'version' in value
  // Older saves could store the previous blank default as a preference.
  if (!hasVersion && signer.name === DEFAULT_BOS_SIGNER.name && !signer.nip) return DEFAULT_BOS_SIGNER
  return signer
}
