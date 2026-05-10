// @ts-nocheck
import { default as nextHandler } from "./.open-next/worker.js";


interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
}

export default {
  // Main fetch handler dari Next.js (OpenNext)
  fetch: (nextHandler as any).fetch,

  // Custom scheduled handler untuk Cron Jobs — Notifikasi Terjadwal
  async scheduled(event: ScheduledEvent, env: any, ctx: any) {
    console.log("Cron trigger fired:", event.cron, "at", new Date(event.scheduledTime).toISOString());

    const baseUrl = env.BETTER_AUTH_URL || "https://mansatas-app.drudox.workers.dev";
    const cronSecret = env.CRON_SECRET || "mansatas-cron-xB2kLp9QrT";

    try {
      const response = await fetch(`${baseUrl}/api/cron/reminder-jadwal`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${cronSecret}`,
          "cf-cron": "true",
        },
      });

      const result = await response.json();
      console.log("Cron dispatcher result:", JSON.stringify(result));
    } catch (error: any) {
      console.error("Cron dispatcher error:", error?.message || error);
    }
  },
};

// Re-export vital Cloudflare handlers (ISR, Durable Objects, etc)
// @ts-ignore
export * from "./.open-next/worker.js";

