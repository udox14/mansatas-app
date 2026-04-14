-- =========================================================================
-- PATCH 05 — SEED CRITICAL DATA (from MTs production)
-- =========================================================================
-- Seed master/lookup tables: role_features (132 entries), master_roles,
-- master_jabatan_struktural, master_pelanggaran, bk_topik, pengaturan_presensi,
-- pengaturan_tunjangan, kedisiplinan_config.
--
-- Plus seed 4 MAN-specific roles: satpam, pramubakti, operator, bendahara_komite
--
-- WAJIB di-run setelah patch_04. Tanpa patch ini, sidebar bakal kosong terus.
--
-- AMAN: pakai INSERT OR IGNORE / INSERT OR REPLACE — bisa di-run berkali-kali.
-- =========================================================================

-- =========================================================================
-- 1. master_roles (10 dari MTs + 4 baru MAN)
-- =========================================================================
DELETE FROM master_roles;

INSERT INTO master_roles (value, label, is_custom, mobile_nav_links) VALUES ('super_admin', 'Super Admin', 0, '["siswa","monitoring-agenda","rekap-absensi","monitoring-presensi","dashboard"]');
INSERT INTO master_roles (value, label, is_custom, mobile_nav_links) VALUES ('admin_tu', 'Staff Tata Usaha', 0, '[]');
INSERT INTO master_roles (value, label, is_custom, mobile_nav_links) VALUES ('kepsek', 'Kepala Madrasah', 0, '[]');
INSERT INTO master_roles (value, label, is_custom, mobile_nav_links) VALUES ('wakamad', 'Wakil Kepala Madrasah', 0, '[]');
INSERT INTO master_roles (value, label, is_custom, mobile_nav_links) VALUES ('guru', 'Guru Mata Pelajaran', 0, '["agenda","kehadiran","program-unggulan","siswa","dashboard"]');
INSERT INTO master_roles (value, label, is_custom, mobile_nav_links) VALUES ('guru_bk', 'Guru BK', 0, '[]');
INSERT INTO master_roles (value, label, is_custom, mobile_nav_links) VALUES ('guru_piket', 'Guru Piket', 0, '[]');
INSERT INTO master_roles (value, label, is_custom, mobile_nav_links) VALUES ('wali_kelas', 'Wali Kelas', 0, '["siswa","agenda","nilai-harian","dashboard"]');
INSERT INTO master_roles (value, label, is_custom, mobile_nav_links) VALUES ('resepsionis', 'Resepsionis', 0, '[]');
INSERT INTO master_roles (value, label, is_custom, mobile_nav_links) VALUES ('guru_ppl', 'Guru PPL', 0, '[]');
INSERT INTO master_roles (value, label, is_custom, mobile_nav_links) VALUES ('satpam', 'Satpam', 0, '[]');
INSERT INTO master_roles (value, label, is_custom, mobile_nav_links) VALUES ('pramubakti', 'Pramubakti', 0, '[]');
INSERT INTO master_roles (value, label, is_custom, mobile_nav_links) VALUES ('operator', 'Operator EMIS', 0, '[]');
INSERT INTO master_roles (value, label, is_custom, mobile_nav_links) VALUES ('bendahara_komite', 'Bendahara Komite', 0, '[]');


-- =========================================================================
-- 2. role_features (132 entries dari MTs + minimal akses untuk role baru)
-- =========================================================================
DELETE FROM role_features;

INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'dashboard');
INSERT INTO role_features (role, feature_id) VALUES ('admin_tu', 'dashboard');
INSERT INTO role_features (role, feature_id) VALUES ('kepsek', 'dashboard');
INSERT INTO role_features (role, feature_id) VALUES ('wakamad', 'dashboard');
INSERT INTO role_features (role, feature_id) VALUES ('guru', 'dashboard');
INSERT INTO role_features (role, feature_id) VALUES ('guru_bk', 'dashboard');
INSERT INTO role_features (role, feature_id) VALUES ('guru_piket', 'dashboard');
INSERT INTO role_features (role, feature_id) VALUES ('wali_kelas', 'dashboard');
INSERT INTO role_features (role, feature_id) VALUES ('resepsionis', 'dashboard');
INSERT INTO role_features (role, feature_id) VALUES ('guru_ppl', 'dashboard');
INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'siswa');
INSERT INTO role_features (role, feature_id) VALUES ('admin_tu', 'siswa');
INSERT INTO role_features (role, feature_id) VALUES ('kepsek', 'siswa');
INSERT INTO role_features (role, feature_id) VALUES ('wakamad', 'siswa');
INSERT INTO role_features (role, feature_id) VALUES ('guru', 'siswa');
INSERT INTO role_features (role, feature_id) VALUES ('guru_bk', 'siswa');
INSERT INTO role_features (role, feature_id) VALUES ('wali_kelas', 'siswa');
INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'kelas');
INSERT INTO role_features (role, feature_id) VALUES ('admin_tu', 'kelas');
INSERT INTO role_features (role, feature_id) VALUES ('kepsek', 'kelas');
INSERT INTO role_features (role, feature_id) VALUES ('wakamad', 'kelas');
INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'plotting');
INSERT INTO role_features (role, feature_id) VALUES ('admin_tu', 'plotting');
INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'akademik');
INSERT INTO role_features (role, feature_id) VALUES ('admin_tu', 'akademik');
INSERT INTO role_features (role, feature_id) VALUES ('kepsek', 'akademik');
INSERT INTO role_features (role, feature_id) VALUES ('wakamad', 'akademik');
INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'akademik-nilai');
INSERT INTO role_features (role, feature_id) VALUES ('admin_tu', 'akademik-nilai');
INSERT INTO role_features (role, feature_id) VALUES ('kepsek', 'akademik-nilai');
INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'program-unggulan');
INSERT INTO role_features (role, feature_id) VALUES ('kepsek', 'program-unggulan');
INSERT INTO role_features (role, feature_id) VALUES ('guru', 'program-unggulan');
INSERT INTO role_features (role, feature_id) VALUES ('wali_kelas', 'program-unggulan');
INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'program-unggulan-kelola');
INSERT INTO role_features (role, feature_id) VALUES ('admin_tu', 'program-unggulan-kelola');
INSERT INTO role_features (role, feature_id) VALUES ('kepsek', 'program-unggulan-kelola');
INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'guru');
INSERT INTO role_features (role, feature_id) VALUES ('kepsek', 'guru');
INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'kehadiran');
INSERT INTO role_features (role, feature_id) VALUES ('kepsek', 'kehadiran');
INSERT INTO role_features (role, feature_id) VALUES ('guru', 'kehadiran');
INSERT INTO role_features (role, feature_id) VALUES ('guru_piket', 'kehadiran');
INSERT INTO role_features (role, feature_id) VALUES ('wali_kelas', 'kehadiran');
INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'rekap-absensi');
INSERT INTO role_features (role, feature_id) VALUES ('admin_tu', 'rekap-absensi');
INSERT INTO role_features (role, feature_id) VALUES ('kepsek', 'rekap-absensi');
INSERT INTO role_features (role, feature_id) VALUES ('wakamad', 'rekap-absensi');
INSERT INTO role_features (role, feature_id) VALUES ('wali_kelas', 'rekap-absensi');
INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'agenda');
INSERT INTO role_features (role, feature_id) VALUES ('kepsek', 'agenda');
INSERT INTO role_features (role, feature_id) VALUES ('guru', 'agenda');
INSERT INTO role_features (role, feature_id) VALUES ('wali_kelas', 'agenda');
INSERT INTO role_features (role, feature_id) VALUES ('guru_bk', 'agenda');
INSERT INTO role_features (role, feature_id) VALUES ('guru_piket', 'agenda');
INSERT INTO role_features (role, feature_id) VALUES ('guru_ppl', 'agenda');
INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'monitoring-agenda');
INSERT INTO role_features (role, feature_id) VALUES ('admin_tu', 'monitoring-agenda');
INSERT INTO role_features (role, feature_id) VALUES ('kepsek', 'monitoring-agenda');
INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'izin');
INSERT INTO role_features (role, feature_id) VALUES ('kepsek', 'izin');
INSERT INTO role_features (role, feature_id) VALUES ('guru_bk', 'izin');
INSERT INTO role_features (role, feature_id) VALUES ('guru_piket', 'izin');
INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'kedisiplinan');
INSERT INTO role_features (role, feature_id) VALUES ('kepsek', 'kedisiplinan');
INSERT INTO role_features (role, feature_id) VALUES ('wakamad', 'kedisiplinan');
INSERT INTO role_features (role, feature_id) VALUES ('guru_bk', 'kedisiplinan');
INSERT INTO role_features (role, feature_id) VALUES ('guru_piket', 'kedisiplinan');
INSERT INTO role_features (role, feature_id) VALUES ('guru_ppl', 'kedisiplinan');
INSERT INTO role_features (role, feature_id) VALUES ('wali_kelas', 'kedisiplinan');
INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'bk');
INSERT INTO role_features (role, feature_id) VALUES ('kepsek', 'bk');
INSERT INTO role_features (role, feature_id) VALUES ('guru_bk', 'bk');
INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'psikotes');
INSERT INTO role_features (role, feature_id) VALUES ('kepsek', 'psikotes');
INSERT INTO role_features (role, feature_id) VALUES ('guru_bk', 'psikotes');
INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'presensi');
INSERT INTO role_features (role, feature_id) VALUES ('resepsionis', 'presensi');
INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'monitoring-presensi');
INSERT INTO role_features (role, feature_id) VALUES ('kepsek', 'monitoring-presensi');
INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'surat');
INSERT INTO role_features (role, feature_id) VALUES ('admin_tu', 'surat');
INSERT INTO role_features (role, feature_id) VALUES ('kepsek', 'surat');
INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'settings');
INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'settings-fitur');
INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'sarpras');
INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'penugasan');
INSERT INTO role_features (role, feature_id) VALUES ('guru', 'penugasan');
INSERT INTO role_features (role, feature_id) VALUES ('guru_bk', 'penugasan');
INSERT INTO role_features (role, feature_id) VALUES ('guru_ppl', 'penugasan');
INSERT INTO role_features (role, feature_id) VALUES ('guru_piket', 'penugasan');
INSERT INTO role_features (role, feature_id) VALUES ('kepsek', 'penugasan');
INSERT INTO role_features (role, feature_id) VALUES ('wali_kelas', 'penugasan');
INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'monitoring-penugasan');
INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'rapat');
INSERT INTO role_features (role, feature_id) VALUES ('wakamad', 'rapat');
INSERT INTO role_features (role, feature_id) VALUES ('kepsek', 'rapat');
INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'settings-notifications');
INSERT INTO role_features (role, feature_id) VALUES ('admin_tu', 'monitoring-penugasan');
INSERT INTO role_features (role, feature_id) VALUES ('kepsek', 'monitoring-penugasan');
INSERT INTO role_features (role, feature_id) VALUES ('wakamad', 'monitoring-penugasan');
INSERT INTO role_features (role, feature_id) VALUES ('guru_bk', 'rapat');
INSERT INTO role_features (role, feature_id) VALUES ('guru', 'rapat');
INSERT INTO role_features (role, feature_id) VALUES ('guru_ppl', 'rapat');
INSERT INTO role_features (role, feature_id) VALUES ('guru_piket', 'rapat');
INSERT INTO role_features (role, feature_id) VALUES ('wali_kelas', 'rapat');
INSERT INTO role_features (role, feature_id) VALUES ('admin_tu', 'rapat');
INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'jadwal-piket');
INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'settings-jadwal-notif');
INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'nilai-harian');
INSERT INTO role_features (role, feature_id) VALUES ('kepsek', 'nilai-harian');
INSERT INTO role_features (role, feature_id) VALUES ('guru', 'nilai-harian');
INSERT INTO role_features (role, feature_id) VALUES ('wali_kelas', 'nilai-harian');
INSERT INTO role_features (role, feature_id) VALUES ('guru_ppl', 'nilai-harian');
INSERT INTO role_features (role, feature_id) VALUES ('guru_tahfidz', 'dashboard');
INSERT INTO role_features (role, feature_id) VALUES ('guru_tahfidz', 'tahfidz');
INSERT INTO role_features (role, feature_id) VALUES ('guru_tahfidz', 'siswa');
INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'tahfidz');
INSERT INTO role_features (role, feature_id) VALUES ('kepsek', 'tahfidz');
INSERT INTO role_features (role, feature_id) VALUES ('admin_tu', 'sarpras');
INSERT INTO role_features (role, feature_id) VALUES ('kepsek', 'plotting');
INSERT INTO role_features (role, feature_id) VALUES ('kepsek', 'sarpras');
INSERT INTO role_features (role, feature_id) VALUES ('kepsek', 'settings-notifications');
INSERT INTO role_features (role, feature_id) VALUES ('wali_kelas', 'tahfidz');
INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'kelola-ppl');
INSERT INTO role_features (role, feature_id) VALUES ('guru_ppl', 'kehadiran');
INSERT INTO role_features (role, feature_id) VALUES ('guru_ppl', 'program-unggulan');
INSERT INTO role_features (role, feature_id) VALUES ('resepsionis', 'buku-tamu');
INSERT INTO role_features (role, feature_id) VALUES ('super_admin', 'buku-tamu');
INSERT INTO role_features (role, feature_id) VALUES ('admin_tu', 'buku-tamu');
INSERT INTO role_features (role, feature_id) VALUES ('kepsek', 'buku-tamu');
INSERT INTO role_features (role, feature_id) VALUES ('wakamad', 'buku-tamu');
INSERT INTO role_features (role, feature_id) VALUES ('satpam', 'dashboard');
INSERT INTO role_features (role, feature_id) VALUES ('satpam', 'buku-tamu');
INSERT INTO role_features (role, feature_id) VALUES ('pramubakti', 'dashboard');
INSERT INTO role_features (role, feature_id) VALUES ('operator', 'dashboard');
INSERT INTO role_features (role, feature_id) VALUES ('operator', 'siswa');
INSERT INTO role_features (role, feature_id) VALUES ('operator', 'kelas');
INSERT INTO role_features (role, feature_id) VALUES ('operator', 'kelola-ppl');
INSERT INTO role_features (role, feature_id) VALUES ('bendahara_komite', 'dashboard');
INSERT INTO role_features (role, feature_id) VALUES ('bendahara_komite', 'siswa');


-- =========================================================================
-- 3. master_jabatan_struktural
-- =========================================================================
DELETE FROM master_jabatan_struktural;

INSERT INTO master_jabatan_struktural (id, nama, urutan, created_at) VALUES ('jbt_kepsek', 'Kepala Madrasah', 1, '2026-04-01 16:03:20');
INSERT INTO master_jabatan_struktural (id, nama, urutan, created_at) VALUES ('jbt_wakamad', 'Wakil Kepala Madrasah', 2, '2026-04-01 16:03:20');
INSERT INTO master_jabatan_struktural (id, nama, urutan, created_at) VALUES ('jbt_ktu', 'Kepala TU', 3, '2026-04-01 16:03:20');
INSERT INTO master_jabatan_struktural (id, nama, urutan, created_at) VALUES ('jbt_staff_tu', 'Staff TU', 4, '2026-04-01 16:03:20');
INSERT INTO master_jabatan_struktural (id, nama, urutan, created_at) VALUES ('9ff860bcb9c5b9b2763c5790ca860d97', 'Bendahara', 5, '2026-04-03 13:56:08');


-- =========================================================================
-- 4. master_pelanggaran
-- =========================================================================

INSERT OR IGNORE INTO master_pelanggaran (id, kategori, nama_pelanggaran, poin, created_at) VALUES ('20fd352c3df51309b0898dbdf22d880c', 'Sedang', 'Merokok di Lingkungan Madrasah', 10, '2026-04-12 01:06:27');


-- =========================================================================
-- 5. bk_topik
-- =========================================================================

INSERT OR IGNORE INTO bk_topik (id, bidang, nama, created_by, created_at) VALUES ('21f2dde3b95f0470a8b75db212ab9cac', 'Pribadi', 'Masalah keluarga', NULL, '2026-03-31 16:28:14');
INSERT OR IGNORE INTO bk_topik (id, bidang, nama, created_by, created_at) VALUES ('5e5aad349e93da7440cc984fa38e294b', 'Pribadi', 'Kesehatan mental', NULL, '2026-03-31 16:28:14');
INSERT OR IGNORE INTO bk_topik (id, bidang, nama, created_by, created_at) VALUES ('97fba1114e3ad110988005cbf33751d4', 'Pribadi', 'Kepercayaan diri', NULL, '2026-03-31 16:28:14');
INSERT OR IGNORE INTO bk_topik (id, bidang, nama, created_by, created_at) VALUES ('dfb86c78bbe1dd80b996ac9a745ad699', 'Pribadi', 'Manajemen emosi', NULL, '2026-03-31 16:28:14');
INSERT OR IGNORE INTO bk_topik (id, bidang, nama, created_by, created_at) VALUES ('8bf7664e402c43b9e386f3f10781c5aa', 'Karir', 'Pilihan jurusan', NULL, '2026-03-31 16:28:14');
INSERT OR IGNORE INTO bk_topik (id, bidang, nama, created_by, created_at) VALUES ('218e2c486eafa795291458fea0e29146', 'Karir', 'Minat dan bakat', NULL, '2026-03-31 16:28:14');
INSERT OR IGNORE INTO bk_topik (id, bidang, nama, created_by, created_at) VALUES ('10a12df659e8ab01b8ad95d945fa1d4b', 'Karir', 'Rencana masa depan', NULL, '2026-03-31 16:28:14');
INSERT OR IGNORE INTO bk_topik (id, bidang, nama, created_by, created_at) VALUES ('c6ab083728ab4a0b32d96e73d47f757c', 'Sosial', 'Masalah pertemanan', NULL, '2026-03-31 16:28:14');
INSERT OR IGNORE INTO bk_topik (id, bidang, nama, created_by, created_at) VALUES ('19611be960caec1528aa82435d08ec7d', 'Sosial', 'Bullying', NULL, '2026-03-31 16:28:14');
INSERT OR IGNORE INTO bk_topik (id, bidang, nama, created_by, created_at) VALUES ('bbbf88d177fdc528465cb278f1d10c28', 'Sosial', 'Adaptasi lingkungan', NULL, '2026-03-31 16:28:14');
INSERT OR IGNORE INTO bk_topik (id, bidang, nama, created_by, created_at) VALUES ('6449906f67821a72f2051297b3a95b23', 'Akademik', 'Kesulitan belajar', NULL, '2026-03-31 16:28:14');
INSERT OR IGNORE INTO bk_topik (id, bidang, nama, created_by, created_at) VALUES ('b47d6a4468baa2b8bdbf772dd86bf084', 'Akademik', 'Motivasi belajar', NULL, '2026-03-31 16:28:14');
INSERT OR IGNORE INTO bk_topik (id, bidang, nama, created_by, created_at) VALUES ('c92a2871ca09a761218632a2cdcad3e2', 'Akademik', 'Kehadiran / absensi', NULL, '2026-03-31 16:28:14');


-- =========================================================================
-- 6. pengaturan_presensi
-- =========================================================================
DELETE FROM pengaturan_presensi;

INSERT INTO pengaturan_presensi (id, jam_masuk, jam_pulang, batas_telat_menit, batas_pulang_cepat_menit, hari_kerja, updated_at) VALUES ('global', '07:00', '14:00', 15, 15, '[1,2,3,4,5,6]', '2026-04-01 16:03:20');


-- =========================================================================
-- 7. pengaturan_tunjangan
-- =========================================================================
DELETE FROM pengaturan_tunjangan;

INSERT INTO pengaturan_tunjangan (id, nominal_dalam, nominal_luar, tanggal_bayar, aturan_tiers, updated_at) VALUES ('global', 7500, 10000, 25, '[{"sampai_jam":"07:15:00","persen":100,"label":"s/d 07.15"},{"sampai_jam":"07:30:00","persen":75,"label":"07.15 – 07.30"},{"sampai_jam":"08:00:00","persen":50,"label":"07.30 – 08.00"},{"sampai_jam":null,"persen":0,"label":"> 08.00"}]', '2026-04-11 03:04:37');


-- =========================================================================
-- 8. kedisiplinan_config
-- =========================================================================
DELETE FROM kedisiplinan_config;

INSERT INTO kedisiplinan_config (id, key, value, label, keterangan, updated_at) VALUES ('a6bce9c3c708d48e0341e41a7ab7b382', 'threshold_perhatian', '25', 'Poin Butuh Perhatian', 'Siswa dengan akumulasi poin di atas nilai ini dianggap perlu pengawasan', '2026-04-12 01:03:32');
INSERT INTO kedisiplinan_config (id, key, value, label, keterangan, updated_at) VALUES ('3139482ce10996779bb83a7f4caf6c8a', 'threshold_peringatan', '50', 'Poin Peringatan Keras', 'Siswa dengan akumulasi poin di atas nilai ini mendapat peringatan keras (Surat Peringatan)', '2026-04-12 01:03:32');
INSERT INTO kedisiplinan_config (id, key, value, label, keterangan, updated_at) VALUES ('b93cee3f53d3361ed9284c011c781c82', 'threshold_kritis', '75', 'Poin Level Kritis', 'Siswa dengan akumulasi poin di atas nilai ini mendapat tindakan khusus / panggilan orang tua', '2026-04-12 01:03:32');
INSERT INTO kedisiplinan_config (id, key, value, label, keterangan, updated_at) VALUES ('16112000b59a82482a3a345f4058b801', 'credit_score_awal', '100', 'Credit Score Awal', 'Nilai awal credit score siswa di awal tahun ajaran. Poin pelanggaran akan mengurangi nilai ini', '2026-04-12 01:03:32');


-- =========================================================================
-- VERIFY:
--   wrangler d1 execute mansatas-db --remote --command="SELECT COUNT(*) FROM role_features"
--   → harus 141 (132 MTs + 9 baru MAN)
--
--   wrangler d1 execute mansatas-db --remote --command="SELECT COUNT(*) FROM master_roles"
--   → harus 14 (10 MTs + 4 baru)
-- =========================================================================
