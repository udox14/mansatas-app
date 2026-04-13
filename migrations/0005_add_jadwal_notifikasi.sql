-- Migration: Jadwal Notifikasi Terjadwal
-- Tabel untuk menyimpan notifikasi otomatis yang bisa dikonfigurasi admin

CREATE TABLE IF NOT EXISTS jadwal_notifikasi (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nama TEXT NOT NULL,                    -- Nama tampilan (misal: "Pengingat Mengajar")
  judul TEXT NOT NULL,                   -- Judul push notification
  isi TEXT NOT NULL,                     -- Body push notification
  url TEXT DEFAULT '/dashboard',         -- URL tujuan saat notif diklik
  jam TEXT NOT NULL,                     -- Jam kirim WIB format "HH:MM" misal "06:30"
  hari_aktif TEXT DEFAULT '[1,2,3,4,5,6]', -- JSON array hari [1=Sen, 7=Min]
  target_type TEXT DEFAULT 'all',        -- 'all', 'role', 'custom'
  target_role TEXT,                      -- Diisi jika target_type = 'role'
  target_user_ids TEXT DEFAULT '[]',    -- JSON array user IDs jika target_type = 'custom'
  is_active INTEGER DEFAULT 1,          -- 1 = aktif, 0 = nonaktif
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Seed: Jadwal Pengingat Mengajar yang sudah ada (migrasi dari hardcoded)
INSERT OR IGNORE INTO jadwal_notifikasi (id, nama, judul, isi, url, jam, hari_aktif, target_type, is_active)
VALUES (
  'system-pengingat-mengajar',
  'Pengingat Jadwal Mengajar',
  'Pengingat Jadwal Mengajar',
  'Selamat pagi! Anda memiliki jadwal mengajar hari ini. Silakan periksa dashboard untuk rincian kelas.',
  '/dashboard/jadwal-mengajar',
  '06:30',
  '[1,2,3,4,5,6]',
  'guru',
  1
);
