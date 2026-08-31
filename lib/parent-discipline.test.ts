import { describe, expect, it } from 'vitest'
import {
  normalizeDisciplineClarificationMode,
  normalizeDisciplinePublishMode,
  publicationStatusForMode,
} from './parent-discipline'

describe('parent discipline policy', () => {
  it('keeps backward-compatible defaults for invalid settings', () => {
    expect(normalizeDisciplinePublishMode('unknown')).toBe('immediate')
    expect(normalizeDisciplineClarificationMode('unknown')).toBe('whatsapp')
  })

  it('requires review only when verified mode is selected', () => {
    expect(publicationStatusForMode('immediate')).toBe('published')
    expect(publicationStatusForMode('verified')).toBe('pending')
  })

  it('accepts every supported clarification mode', () => {
    expect(normalizeDisciplineClarificationMode('whatsapp')).toBe('whatsapp')
    expect(normalizeDisciplineClarificationMode('form')).toBe('form')
    expect(normalizeDisciplineClarificationMode('disabled')).toBe('disabled')
  })
})
