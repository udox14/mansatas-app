import { default as nextHandler } from "./.open-next/worker.js";
import { processNotificationQueueMessage, type NotificationQueueMessage } from "@/lib/notification-engine";
import type { FcmRuntimeEnv } from "@/lib/fcm";
import { processDsptReminderWork } from "@/lib/dspt-reminder-queue";
import { runScheduledReminders, type CronRuntimeEnv } from "@/lib/cron-dispatcher";

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

const SCANNER_DOTFILE_PATTERN = /^\/\.(?!well-known(?:\/|$))/i
const SCANNER_EXTENSION_PATTERN = /\.(?:php\d*|phtml|asp|aspx|jsp|cgi|sql|ini|conf|ya?ml|bak|old|orig|swp|env|toml|lock)$/i
const SCANNER_PATH_PATTERN = /^(?:\/(?:wp-admin|wp-login|wp-content|wp-includes|xmlrpc|phpmyadmin|pma|adminer|cgi-bin|actuator|server-status|telescope)(?:\/|$)|\/api\/actuator(?:\/|$)|\/appsettings(?:\.[^/]+)?\.json$|\/(?:app-)?ads\.txt$)/i

export function isBlockedScannerPath(pathname: string): boolean {
  if (!pathname || pathname === '/') return false
  return (
    SCANNER_DOTFILE_PATTERN.test(pathname)
    || SCANNER_EXTENSION_PATTERN.test(pathname)
    || SCANNER_PATH_PATTERN.test(pathname)
  )
}

const worker = nextHandler as unknown as NextWorker

const entrypoint = {
  // Main fetch handler dengan fast-path 404 untuk bot scanner & CSP report
  fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext) {
    const url = new URL(request.url)
    const { pathname } = url

    if (isBlockedScannerPath(pathname)) {
      return new Response('Not Found', {
        status: 404,
        headers: {
          'Cache-Control': 'public, max-age=3600',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }

    if (pathname === '/api/security/csp-report' && request.method === 'POST') {
      return new Response(null, {
        status: 204,
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    return worker.fetch(request, env, ctx)
  },

  // Custom scheduled handler — jalankan langsung in-process tanpa SELF.fetch
  // agar tidak memicu double-invocation HTTP OpenNext + clientDisconnected.
  async scheduled(event: ScheduledEvent, env: CloudflareEnv) {
    console.info(JSON.stringify({ event: 'cron_started', cron: event.cron, scheduledAt: new Date(event.scheduledTime).toISOString() }));

    try {
      const result = await runScheduledReminders(env as unknown as CronRuntimeEnv);

      console.info(JSON.stringify({
        event: 'cron_completed',
        izinAutoReturned: result.izinAutoReturned,
        announcementsProcessed: result.announcementsProcessed,
        automaticRemindersProcessed: result.automaticRemindersProcessed,
        attendanceNoticesProcessed: result.attendanceNoticesProcessed,
        photoCleanupSkipped: Boolean(result.modulePhotoCleanup.skipped),
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
