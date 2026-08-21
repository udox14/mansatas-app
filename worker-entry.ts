import { default as nextHandler } from "./.open-next/worker.js";

interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
}

type NextWorker = {
  fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext): Response | Promise<Response>
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
      const [reminderResponse, whatsappResponse] = await Promise.all([
        env.SELF.fetch("https://mansatas.internal/api/cron/reminder-jadwal", { method: "GET", headers }),
        env.SELF.fetch("https://mansatas.internal/api/cron/whatsapp", { method: "GET", headers }),
      ]);

      console.info(JSON.stringify({
        event: 'cron_completed',
        reminderStatus: reminderResponse.status,
        whatsappStatus: whatsappResponse.status,
      }));
    } catch (error: unknown) {
      console.error(JSON.stringify({
        event: 'cron_failed',
        error: error instanceof Error ? { name: error.name, message: error.message } : String(error),
      }));
    }
  },
};

export default entrypoint;

// Re-export vital Cloudflare handlers (ISR, Durable Objects, etc)
export * from "./.open-next/worker.js";
