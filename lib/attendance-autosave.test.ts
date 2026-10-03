import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AttendanceAutosave } from './attendance-autosave'
import { attendanceDraftKey, clearAttendanceDraft, readAttendanceDraft, writeAttendanceDraft } from './attendance-local-draft'

let storage: Map<string, string>
beforeEach(() => {
  vi.useFakeTimers()
  storage = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('attendance autosave batching and recovery', () => {
  it('waits two seconds after the last edit and saves multiple students together with their latest status', async () => {
    let changes: Record<string,string> = {}
    const save = vi.fn(async () => { expect(changes).toEqual({a:'IZIN',b:'SAKIT'}) })
    const scheduler = new AttendanceAutosave(save,vi.fn())
    changes = {a:'ALFA'}; scheduler.change(JSON.stringify(changes))
    await vi.advanceTimersByTimeAsync(1500)
    changes = {a:'IZIN',b:'SAKIT'}; scheduler.change(JSON.stringify(changes))
    await vi.advanceTimersByTimeAsync(1999); expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1); expect(save).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(10000); expect(save).toHaveBeenCalledTimes(1)
    scheduler.stop()
  })
  it('does not save a mount or a draft reverted before the deadline', async () => {
    const save = vi.fn(async () => {})
    const scheduler = new AttendanceAutosave(save,vi.fn())
    scheduler.change(''); await vi.advanceTimersByTimeAsync(2000)
    scheduler.change('changed'); scheduler.change(''); await vi.advanceTimersByTimeAsync(2000)
    expect(save).not.toHaveBeenCalled(); scheduler.stop()
  })
  it('a network reconnect does not bypass the two-second debounce when no send has failed', async () => {
    const save = vi.fn(async () => {})
    const scheduler = new AttendanceAutosave(save,vi.fn())
    scheduler.change('edit'); await vi.advanceTimersByTimeAsync(1000)
    scheduler.retryFailed(); expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000); expect(save).toHaveBeenCalledTimes(1)
    scheduler.stop()
  })
  it('retains the local draft across an offline save and refresh, then clears only after confirmed success', async () => {
    const key = attendanceDraftKey('wali','class:2026-10-03')
    const changes = [{siswa_id:'s',status:'SAKIT',keterangan:'Konfirmasi'}]
    writeAttendanceDraft(key,changes)
    const notify = vi.fn()
    const offline = new AttendanceAutosave(async () => { throw new Error('Offline') },notify)
    offline.change(JSON.stringify(changes)); await vi.advanceTimersByTimeAsync(2000)
    expect(notify).toHaveBeenLastCalledWith(false,'Offline')
    offline.stop()
    const restored = readAttendanceDraft(key)
    expect(restored).toEqual(changes)
    const save = vi.fn(async () => { clearAttendanceDraft(key,restored) })
    const refreshed = new AttendanceAutosave(save,vi.fn())
    refreshed.change(JSON.stringify(restored)); await vi.advanceTimersByTimeAsync(2000)
    expect(save).toHaveBeenCalledTimes(1); expect(readAttendanceDraft(key)).toBeNull()
    refreshed.stop()
  })
  it('pauses after failure, serializes retries, and handles edits arriving during an in-flight batch', async () => {
    let finish: (() => void) | undefined
    const save = vi.fn().mockRejectedValueOnce(new Error('Network')).mockImplementationOnce(() => new Promise<void>(resolve => { finish=resolve })).mockResolvedValue(undefined)
    const scheduler = new AttendanceAutosave(save,vi.fn())
    scheduler.change('a'); await vi.advanceTimersByTimeAsync(2000)
    await vi.advanceTimersByTimeAsync(10000); expect(save).toHaveBeenCalledTimes(1)
    scheduler.retry(); scheduler.retry(); expect(save).toHaveBeenCalledTimes(2)
    scheduler.change('b'); await vi.advanceTimersByTimeAsync(2000); expect(save).toHaveBeenCalledTimes(2)
    finish!(); await vi.advanceTimersByTimeAsync(1999); expect(save).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1); expect(save).toHaveBeenCalledTimes(3)
    scheduler.stop()
  })
  it('isolates users/contexts and never clears a newer tab draft on an older response', () => {
    const key = attendanceDraftKey('wali-a','class:date')
    const other = attendanceDraftKey('wali-b','class:date')
    const differentDay = attendanceDraftKey('wali-a','class:next-date')
    writeAttendanceDraft(key,{status:'ALFA'})
    writeAttendanceDraft(other,{status:'SAKIT'})
    writeAttendanceDraft(differentDay,{status:'IZIN'})
    writeAttendanceDraft(key,{status:'HADIR'})
    clearAttendanceDraft(key,{status:'ALFA'})
    expect(readAttendanceDraft(key)).toEqual({status:'HADIR'})
    expect(readAttendanceDraft(other)).toEqual({status:'SAKIT'})
    expect(readAttendanceDraft(differentDay)).toEqual({status:'IZIN'})
  })
  it('reports unavailable storage and preserves malformed stored data for inspection', () => {
    storage.set('bad','{broken')
    expect(() => readAttendanceDraft('bad')).toThrow()
    expect(storage.get('bad')).toBe('{broken')
    vi.stubGlobal('localStorage',{setItem:()=>{throw new Error('Quota')}})
    expect(() => writeAttendanceDraft('key',{})).toThrow('jangan refresh')
  })
})
