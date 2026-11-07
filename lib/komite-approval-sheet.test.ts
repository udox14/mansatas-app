import { describe, expect, it } from 'vitest'
import { BOS_SIGNER_STORAGE_VERSION, DEFAULT_BOS_SIGNER, readSavedBosSigner } from './komite-approval-sheet'

describe('Preferensi Bendahara BOS', () => {
  it('fills the default NIP for new users and older saves with the blank default', () => {
    expect(readSavedBosSigner(null)).toEqual(DEFAULT_BOS_SIGNER)
    expect(readSavedBosSigner({ name: DEFAULT_BOS_SIGNER.name, nip: '' })).toEqual(DEFAULT_BOS_SIGNER)
  })

  it('preserves a saved override and a deliberately cleared NIP', () => {
    const custom = { name: 'Bendahara pengganti', nip: '001234567890123456' }
    const blank = { name: DEFAULT_BOS_SIGNER.name, nip: '' }
    expect(readSavedBosSigner(custom)).toEqual(custom)
    expect(readSavedBosSigner({ ...blank, version: BOS_SIGNER_STORAGE_VERSION })).toEqual(blank)
  })
})
