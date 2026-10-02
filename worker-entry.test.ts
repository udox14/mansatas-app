import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ fetch: vi.fn(), process: vi.fn() }))
vi.mock('./.open-next/worker.js', () => ({ default: { fetch: state.fetch } }))
vi.mock('@/lib/notification-engine', () => ({ processNotificationQueueMessage: state.process }))
import worker from './worker-entry'

beforeEach(() => vi.clearAllMocks())

describe('notification worker after WhatsApp removal', () => {
  it('dispatches the scheduled reminder with no WhatsApp request', async () => {
    const fetch = vi.fn().mockResolvedValue({ status: 200 })
    await worker.scheduled({ cron: '*/5 * * * *', scheduledTime: 1_800_000_000_000 }, { CRON_SECRET: 'test', SELF: { fetch } } as unknown as CloudflareEnv)
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledWith('https://mansatas.internal/api/cron/reminder-jadwal', { method: 'GET', headers: { Authorization: 'Bearer test', 'cf-cron': 'true' } })
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
