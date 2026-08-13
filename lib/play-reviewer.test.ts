import { describe, expect, it } from 'vitest'
import { isReviewerReadSql, maskReviewerName, maskReviewerRecord } from './play-reviewer'

describe('Google Play reviewer protection', () => {
  it('masks names word by word', () => {
    expect(maskReviewerName('Azkia Kayla')).toBe('A**** K****')
  })

  it('masks personal fields without changing technical ids', () => {
    expect(maskReviewerRecord({
      id: 'student-123',
      nama_lengkap: 'Azkia Kayla',
      nisn: '1234567890',
      email: 'azkia@example.com',
      nomor_whatsapp: '628123456789',
      alamat: 'Jalan Rahasia',
      kelas_label: 'XI-A',
    })).toEqual({
      id: 'student-123',
      nama_lengkap: 'A**** K****',
      nisn: '1********0',
      email: 'a****@e******.c**',
      nomor_whatsapp: '6**********9',
      alamat: '[disamarkan untuk reviewer]',
      kelas_label: 'XI-A',
    })
  })

  it('masks generic names only for personal-data queries', () => {
    expect(maskReviewerRecord({ nama: 'Azkia Kayla' }, 'SELECT nama FROM siswa')).toEqual({ nama: 'A**** K****' })
    expect(maskReviewerRecord({ nama: 'Matematika' }, 'SELECT nama FROM mata_pelajaran')).toEqual({ nama: 'Matematika' })
  })

  it('allows reads and schema guards but rejects business writes', () => {
    expect(isReviewerReadSql('SELECT * FROM siswa')).toBe(true)
    expect(isReviewerReadSql('WITH rows AS (SELECT 1) SELECT * FROM rows')).toBe(true)
    expect(isReviewerReadSql('CREATE TABLE IF NOT EXISTS guard (id TEXT)')).toBe(true)
    expect(isReviewerReadSql('UPDATE siswa SET nama_lengkap = ?')).toBe(false)
    expect(isReviewerReadSql('INSERT INTO siswa (id) VALUES (?)')).toBe(false)
    expect(isReviewerReadSql('DELETE FROM siswa WHERE id = ?')).toBe(false)
  })
})
