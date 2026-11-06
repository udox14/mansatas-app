import { default as nextHandler } from "./.open-next/worker.js";
import { processNotificationQueueMessage, type NotificationQueueMessage } from "@/lib/notification-engine";
import type { FcmRuntimeEnv } from "@/lib/fcm";
import { processDsptReminderWork } from "@/lib/dspt-reminder-queue";

interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
}

type NextWorker = {
  fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext): Response | Promise<Response>
}

type NotificationQueueMessageHandle = {
  body: NotificationQueueMessage
  attempts?: number
  ack: () => void
  retry: (options?: { delaySeconds?: number }) => void
}

type NotificationQueueBatch = {
  messages: NotificationQueueMessageHandle[]
}

type NotificationWorkerEnv = CloudflareEnv & {
  NOTIFICATION_QUEUE: {
    send: (body: unknown, options?: { contentType?: 'json'; delaySeconds?: number }) => Promise<void>
  }
}

const worker = nextHandler as unknown as NextWorker

const entrypoint = {
  // Main fetch handler dari Next.js (OpenNext)
  fetch: worker.fetch,

  // Custom scheduled handler untuk Cron Jobs — Notifikasi Terjadwal
  async scheduled(event: ScheduledEvent, env: CloudflareEnv) {
    console.info(JSON.stringify({ event: 'cron_started', cron: event.cron, scheduledAt: new Date(event.scheduledTime).toISOString() }));

    const cronSecret = env.CRON_SECRET;
    if (!cronSecret) {
      console.error("CRON_SECRET is not configured; skipping cron dispatcher.");
      return;
    }

    try {
      const headers = {
        "Authorization": `Bearer ${cronSecret}`,
        "cf-cron": "true",
      };
      const reminderResponse = await env.SELF.fetch("https://mansatas.internal/api/cron/reminder-jadwal", { method: "GET", headers });

      console.info(JSON.stringify({
        event: 'cron_completed',
        reminderStatus: reminderResponse.status,
      }));
    } catch (error: unknown) {
      console.error(JSON.stringify({
        event: 'cron_failed',
        error: error instanceof Error ? { name: error.name, message: error.message } : String(error),
      }));
    }
  },

  // Queue consumer untuk fan-out notifikasi. Setiap message di-ack/retry
  // secara eksplisit agar delivery at-least-once tetap idempotent di D1.
  async queue(batch: NotificationQueueBatch, env: NotificationWorkerEnv) {
    for (const message of batch.messages) {
      try {
        const result = message.body.dsptWork
          ? await processDsptReminderWork(message.body, env, message.attempts || 0)
          : await processNotificationQueueMessage(
            message.body,
            env as FcmRuntimeEnv & { DB: D1Database },
            message.attempts || 0,
          )
        if (result.retry) {
          message.retry({ delaySeconds: 60 })
        } else {
          message.ack()
        }
      } catch (error) {
        console.error(JSON.stringify({
          event: 'notification_queue_message_failed',
          attempts: message.attempts || 0,
          error: message.body?.dsptWork ? 'Pekerjaan DSPT gagal.'
            : error instanceof Error ? { name: error.name, message: error.message } : String(error),
        }))
        message.retry({ delaySeconds: 60 })
      }
    }
  },
};

export default entrypoint;

// Re-export vital Cloudflare handlers (ISR, Durable Objects, etc)
export * from "./.open-next/worker.js";
