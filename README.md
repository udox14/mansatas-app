# MANSATAS — ERP MAN 1 Tasikmalaya

Sistem Informasi Manajemen Terpadu untuk MAN 1 Tasikmalaya.

## Stack

- **Frontend:** Next.js 16 + Tailwind CSS
- **Backend:** Cloudflare Workers (via OpenNext)
- **Database:** Cloudflare D1 (SQLite)
- **Storage:** Cloudflare R2
- **Auth:** Custom JWT (PBKDF2 + session token)

## Setup

1. Install dependencies: `npm install`
2. Init DB lokal: `npm run db:init`
3. Init DB remote: `npm run db:init:remote`
4. Dev: `npm run dev`
5. Deploy: `npm run deploy`

## Cloudflare Resources

- Worker: `mansatas-app`
- D1: `mansatas-db`
- R2: `mansatas-storage`
- KV: `NEXT_INC_CACHE_KV`

## Default Login

Password default pegawai: `mansatas2026`
