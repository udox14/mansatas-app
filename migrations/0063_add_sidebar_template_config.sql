CREATE TABLE IF NOT EXISTS sidebar_template_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  groups_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO sidebar_template_config (id, groups_json, updated_at)
VALUES (
  'default',
  '[{"id":"utama","label":"Utama","items":["dashboard"]},{"id":"data-master","label":"Data Master","items":["siswa","guru","kelas","plotting","ekstrakurikuler-master","pmb"]},{"id":"tugas-harian-guru","label":"Tugas Harian Guru","items":["agenda","agenda-kelas","ckh-generator","rppm-generator","kehadiran","nilai-harian","penugasan","ekstrakurikuler"]},{"id":"monitoring-akademik","label":"Monitoring Akademik","items":["akademik","kalender-pendidikan","analitik"]},{"id":"monitoring-rekap","label":"Monitoring & Rekap","items":["monitoring-agenda","monitoring-penugasan","monitoring-kedisiplinan","rekap-absensi","akademik-nilai"]},{"id":"program-khusus","label":"Program Khusus","items":["tahfidz"]},{"id":"kesiswaan-bk","label":"Kesiswaan & BK","items":["kelas-binaan","keterangan-absensi","jadwal-piket","izin","kedisiplinan","sp","bk","psikotes","tka","penerimaan-pt"]},{"id":"administrasi-hr","label":"Administrasi & HR","items":["tpg-dokumen","documentation","surat","rapat","sarpras","kelola-ppl","buku-tamu"]},{"id":"keuangan","label":"Keuangan","items":["keuangan-daftar-ulang","keuangan-transaksi","keuangan-dspt","keuangan-spp","keuangan-export","keuangan-kas-keluar","keuangan-laporan","keuangan-pengaturan"]},{"id":"sistem","label":"Sistem","items":["settings","whatsapp","settings-notifications","settings-jadwal-notif","settings-mobile-app","settings-fitur","pengumuman-ortu","kotak-saran-ortu"]}]',
  CURRENT_TIMESTAMP
);
