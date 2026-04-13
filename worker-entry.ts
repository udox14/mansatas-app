// @ts-nocheck
import { default as nextHandler } from "./.open-next/worker.js";


interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
}

export default {
  // Main fetch handler dari Next.js (OpenNext)
  fetch: (nextHandler as any).fetch,

  // Custom scheduled handler untuk Cron Jobs
  async scheduled(event: ScheduledEvent, env: any, ctx: any) {
    console.log("Cron trigger fired:", event.cron, "at", new Date(event.scheduledTime).toISOString());
    
    // Potensi logika pengecekan notifikasi bisa taruh di sini
    // Untuk saat ini kita log agar terlihat di Wrangler Tail
    console.log("Cron task executed successfully.");
  },
};

// Re-export vital Cloudflare handlers (ISR, Durable Objects, etc)
// @ts-ignore
export * from "./.open-next/worker.js";

