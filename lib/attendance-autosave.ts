/** One debounced batch at a time. Failures pause until an edit or explicit retry. */
export class AttendanceAutosave {
  private timer: ReturnType<typeof setTimeout> | undefined
  private signature = ''
  private busy = false
  private stopped = false
  private failed = false
  constructor(private save: () => Promise<void>, private notify: (saving: boolean, error: string) => void) {}

  change(signature: string) {
    if (signature === this.signature) return
    this.signature = signature
    this.failed = false
    this.notify(this.busy, '')
    this.schedule()
  }
  private schedule() {
    clearTimeout(this.timer)
    if (!this.signature || this.busy || this.stopped || this.failed) return
    this.timer = setTimeout(() => { void this.flush() }, 2000)
  }
  async flush() {
    clearTimeout(this.timer)
    if (!this.signature || this.busy || this.failed) return
    const sent = this.signature
    this.busy = true
    this.notify(true, '')
    try {
      await this.save()
      if (this.signature === sent) this.signature = ''
      this.notify(false, '')
    } catch (cause) {
      this.failed = true
      this.notify(false, cause instanceof Error ? cause.message : 'Koreksi belum tersimpan. Coba kembali.')
    } finally {
      this.busy = false
      this.schedule()
    }
  }
  retry() { this.failed = false; void this.flush() }
  retryFailed() { if (this.failed) this.retry() }
  stop() { this.stopped = true; clearTimeout(this.timer) }
}
