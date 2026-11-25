import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  fetch: vi.fn(),
  process: vi.fn(),
  runCron: vi.fn(),
}))
vi.mock('./.open-next/worker.js', () => ({ default: { fetch: state.fetch } }))
vi.mock('@/lib/notification-engine', () => ({ processNotificationQueueMessage: state.process }))
vi.mock('@/lib/cron-dispatcher', () => ({ runScheduledReminders: state.runCron }))
import worker, { isBlockedScannerPath } from './worker-entry'

beforeEach(() => vi.clearAllMocks())

describe('worker entrypoint optimizations and handlers', () => {
  it('runs scheduled reminders directly in-process without SELF.fetch', async () => {
    state.runCron.mockResolvedValueOnce({
      success: true,
      modulePhotoCleanup: { scanned: 0, deleted: 0, failed: 0, errors: [], skipped: true },
      izinAutoReturned: 0,
      announcementsProcessed: 1,
      automaticRemindersProcessed: 2,
      attendanceNoticesProcessed: 0,
    })
    const selfFetch = vi.fn()
    const env = { DB: {}, SELF: { fetch: selfFetch } } as unknown as CloudflareEnv
    await worker.scheduled({ cron: '*/5 * * * *', scheduledTime: 1_800_000_000_000 }, env)
    expect(state.runCron).toHaveBeenCalledOnce()
    expect(selfFetch).not.toHaveBeenCalled()
  })

  it('short-circuits bot scanner paths and csp-report before invoking Next.js', async () => {
    expect(isBlockedScannerPath('/.env.production')).toBe(true)
    expect(isBlockedScannerPath('/.git/refs/heads/main')).toBe(true)
    expect(isBlockedScannerPath('/appsettings.Production.json')).toBe(true)
    expect(isBlockedScannerPath('/app-ads.txt')).toBe(true)
    expect(isBlockedScannerPath('/.well-known/assetlinks.json')).toBe(false)
    expect(isBlockedScannerPath('/dashboard/kehadiran')).toBe(false)

    const env = {} as CloudflareEnv
    const ctx = {} as ExecutionContext

    const blockedRes = await worker.fetch(new Request('https://app.mansatas.com/.env.production'), env, ctx)
    expect(blockedRes.status).toBe(404)
    expect(state.fetch).not.toHaveBeenCalled()

    const cspRes = await worker.fetch(new Request('https://app.mansatas.com/api/security/csp-report', { method: 'POST', body: '{}' }), env, ctx)
    expect(cspRes.status).toBe(204)
    expect(state.fetch).not.toHaveBeenCalled()
  })

  it('continues acknowledging completed notifications and retrying failed deliveries', async () => {
    state.process.mockResolvedValueOnce({ retry: false }).mockResolvedValueOnce({ retry: true })
    const messages = [
      { body: { id: 'first' }, ack: vi.fn(), retry: vi.fn() },
      { body: { id: 'second' }, ack: vi.fn(), retry: vi.fn() },
    ]
    const env = { DB: {}, NOTIFICATION_QUEUE: {} }
    await worker.queue({ messages } as unknown as Parameters<typeof worker.queue>[0], env as unknown as Parameters<typeof worker.queue>[1])
    expect(state.process).toHaveBeenCalledTimes(2)
    expect(messages[0].ack).toHaveBeenCalledOnce()
    expect(messages[0].retry).not.toHaveBeenCalled()
    expect(messages[1].retry).toHaveBeenCalledWith({ delaySeconds: 60 })
    expect(messages[1].ack).not.toHaveBeenCalled()
  })
})
