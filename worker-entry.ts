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
        fetch(`${baseUrl}/api/cron/reminder-jadwal`, { method: "GET", headers }),
        fetch(`${baseUrl}/api/cron/whatsapp`, { method: "GET", headers }),
      ]);

      const [reminderText, whatsappText] = await Promise.all([
        reminderResponse.text(),
        whatsappResponse.text(),
      ]);

      try {
        console.log("Cron reminder result:", JSON.parse(reminderText));
      } catch {
        console.log("Cron reminder result (raw):", reminderText);
      }

      try {
        console.log("Cron WhatsApp result:", JSON.parse(whatsappText));
      } catch {
        console.log("Cron WhatsApp result (raw):", whatsappText);
      }
    } catch (error: any) {
      console.error("Cron dispatcher error:", error?.message || error);
    }
  },
};

// Re-export vital Cloudflare handlers (ISR, Durable Objects, etc)
// @ts-ignore
export * from "./.open-next/worker.js";
