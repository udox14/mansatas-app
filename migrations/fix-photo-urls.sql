-- Migration: Ganti URL foto dari R2 public domain ke /api/media/ proxy
-- URL prefix = 'https://pub-cf9e4144c81e46f1b06fb2a0d277b844.r2.dev/' = 52 karakter
-- Jalankan satu-satu di Cloudflare Dashboard > D1 > Console

-- 1. Siswa: foto_url
UPDATE siswa
SET foto_url = '/api/media/' || substr(foto_url, 53)
WHERE foto_url IS NOT NULL AND substr(foto_url, 1, 52) = 'https://pub-cf9e4144c81e46f1b06fb2a0d277b844.r2.dev/';

-- 2. User: avatar_url
UPDATE "user"
SET avatar_url = '/api/media/' || substr(avatar_url, 53)
WHERE avatar_url IS NOT NULL AND substr(avatar_url, 1, 52) = 'https://pub-cf9e4144c81e46f1b06fb2a0d277b844.r2.dev/';

-- 3. Siswa pelanggaran: foto_url
UPDATE siswa_pelanggaran
SET foto_url = '/api/media/' || substr(foto_url, 53)
WHERE foto_url IS NOT NULL AND substr(foto_url, 1, 52) = 'https://pub-cf9e4144c81e46f1b06fb2a0d277b844.r2.dev/';

-- 4. Agenda guru: foto_url
UPDATE agenda_guru
SET foto_url = '/api/media/' || substr(foto_url, 53)
WHERE foto_url IS NOT NULL AND substr(foto_url, 1, 52) = 'https://pub-cf9e4144c81e46f1b06fb2a0d277b844.r2.dev/';
