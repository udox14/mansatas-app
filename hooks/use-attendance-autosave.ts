'use client'

import { useEffect, useRef, useState } from 'react'
import { AttendanceAutosave } from '@/lib/attendance-autosave'
import { clearAttendanceDraft, readAttendanceDraft, writeAttendanceDraft } from '@/lib/attendance-local-draft'

export function useAttendanceAutosave(signature: string, save: () => Promise<void>, draft: {
  key: string; changes: unknown; restore: (changes: unknown) => void
}) {
  const saveRef = useRef(save)
  const signatureRef = useRef(signature)
  const draftRef = useRef(draft)
  useEffect(() => {
    saveRef.current = save
    signatureRef.current = signature
    draftRef.current = draft
  })
  const restoring = useRef(false)
  const backedUp = useRef(false)
  const lastWritten = useRef<{ key: string; changes: unknown } | null>(null)
  const scheduler = useRef<AttendanceAutosave | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [localError, setLocalError] = useState('')
  const [restored, setRestored] = useState(false)
  // Hydration from external device storage must precede scheduling the restored edits.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let mounted = true
    const current = new AttendanceAutosave(async () => {
      const { key, changes } = draftRef.current
      writeAttendanceDraft(key, changes)
      backedUp.current = true
      lastWritten.current = { key, changes }
      if (mounted) setLocalError('')
      if (!navigator.onLine) throw new Error('Tidak ada koneksi. Koreksi tersimpan di perangkat dan akan dicoba saat jaringan kembali.')
      await saveRef.current()
      clearAttendanceDraft(key, changes)
    }, (busy, message) => {
      if (mounted) { setSaving(busy); setError(message) }
    })
    scheduler.current = current
    try {
      const stored = readAttendanceDraft(draftRef.current.key)
      if (stored !== null) {
        restoring.current = true
        draftRef.current.restore(stored)
        setRestored(true)
      }
    } catch (cause) { setLocalError(cause instanceof Error ? cause.message : 'Draft perangkat tidak dapat dipulihkan.') }
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (signatureRef.current && !backedUp.current) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('beforeunload', beforeUnload)
    const online = () => { if (signatureRef.current) current.retryFailed() }
    window.addEventListener('online', online)
    return () => {
      mounted = false
      current.stop()
      // An internal navigation still submits the pending batch, without waiting for the timer.
      void current.flush()
      window.removeEventListener('beforeunload', beforeUnload)
      window.removeEventListener('online', online)
    }
  }, [])
  useEffect(() => {
    if (restoring.current) { restoring.current = false; return }
    if (signature) {
      try { writeAttendanceDraft(draftRef.current.key, draftRef.current.changes); lastWritten.current = { key: draftRef.current.key, changes: draftRef.current.changes }; backedUp.current = true; setLocalError('') }
      catch (cause) { backedUp.current = false; setLocalError(cause instanceof Error ? cause.message : 'Draft perangkat tidak dapat disimpan.') }
    } else if (lastWritten.current?.key === draftRef.current.key) {
      try { clearAttendanceDraft(lastWritten.current.key, lastWritten.current.changes) }
      catch (cause) { setLocalError(cause instanceof Error ? cause.message : 'Draft perangkat tidak dapat dibersihkan.') }
    }
    scheduler.current?.change(signature)
  }, [signature])
  /* eslint-enable react-hooks/set-state-in-effect */
  return { saving, error: localError || error, restored, retry: () => scheduler.current?.retry(),
    discard: () => { localStorage.removeItem(draftRef.current.key); setLocalError(''); setError(''); scheduler.current?.change('') } }
}
