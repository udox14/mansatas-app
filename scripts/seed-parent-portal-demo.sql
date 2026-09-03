-- Akun tutorial Portal Orang Tua. Jalankan sekali terhadap D1 aktif:
-- npx wrangler d1 execute mansatas-db --remote --file scripts/seed-parent-portal-demo.sql
--
-- NISN / kata sandi awal: 9000000001
-- Semua ID sengaja memakai prefix demo-parent- agar mudah diaudit dan dihapus.

INSERT INTO siswa (
  id, nisn, nis_lokal, nama_lengkap, jenis_kelamin, tempat_tinggal, kelas_id,
  status, foto_url, minat_jurusan, nik, tempat_lahir, tanggal_lahir,
  jumlah_saudara, anak_ke, status_anak, alamat_lengkap, rt, rw,
  desa_kelurahan, kecamatan, kabupaten_kota, provinsi, kode_pos,
  nomor_whatsapp, nomor_kk, nama_ayah, nik_ayah, tempat_lahir_ayah,
  tanggal_lahir_ayah, status_ayah, pendidikan_ayah, pekerjaan_ayah,
  penghasilan_ayah, nama_ibu, nik_ibu, tempat_lahir_ibu, tanggal_lahir_ibu,
  status_ibu, pendidikan_ibu, pekerjaan_ibu, penghasilan_ibu, tahun_masuk, updated_at
) VALUES (
  'demo-parent-nabila-2026', '9000000001', 'DEMO-2026-001', 'Nabila Azzahra (DEMO)', 'P', 'Non-Pesantren',
  '1af99326052f3db5334afd91542536c6', 'aktif', '/api/media/foto_siswa/demo-parent-nabila-2026/foto.svg',
  'Psikologi', '3200000000000001', 'Tasikmalaya', '2008-05-16', 2, 1, 'Kandung',
  'Jl. Contoh Tutorial No. 12', '02', '08', 'Sukamaju', 'Cihideung', 'Kota Tasikmalaya', 'Jawa Barat', '46124',
  '6281200000001', '3200000000000002', 'Rahmat Hidayat (DEMO)', '3200000000000003', 'Tasikmalaya', '1978-03-12',
  'Hidup', 'S1', 'Wiraswasta', 'Rp5.000.000 - Rp10.000.000',
  'Siti Nurhayati (DEMO)', '3200000000000004', 'Bandung', '1980-09-25', 'Hidup', 'S1', 'Guru',
  'Rp5.000.000 - Rp10.000.000', 2024, datetime('now')
)
ON CONFLICT(nisn) DO UPDATE SET
  nama_lengkap = excluded.nama_lengkap,
  kelas_id = excluded.kelas_id,
  status = excluded.status,
  foto_url = excluded.foto_url,
  nomor_whatsapp = excluded.nomor_whatsapp,
  updated_at = datetime('now');

INSERT INTO riwayat_kelas (id, siswa_id, kelas_id, tahun_ajaran_id, kelas_tingkat, kelas_nomor, kelas_kelompok, kelas_nama)
VALUES ('demo-riwayat-nabila-2026', 'demo-parent-nabila-2026', '1af99326052f3db5334afd91542536c6', '44e4dd4af13d99dac8cc0f99687aedd1', 12, '10', 'IPS', 'XII-10 IPS')
ON CONFLICT(siswa_id, tahun_ajaran_id) DO UPDATE SET
  kelas_id = excluded.kelas_id, kelas_tingkat = excluded.kelas_tingkat, kelas_nomor = excluded.kelas_nomor,
  kelas_kelompok = excluded.kelas_kelompok, kelas_nama = excluded.kelas_nama;

INSERT INTO rekap_nilai_akademik (id, siswa_id, nilai_smt1, nilai_smt2, nilai_smt3, nilai_smt4, nilai_smt5, nilai_smt6, updated_at)
VALUES (
  'demo-nilai-nabila-2026', 'demo-parent-nabila-2026',
  '{"Matematika":88,"Bahasa Indonesia":90,"Bahasa Inggris":89,"Ekonomi":91,"Sosiologi":90}',
  '{"Matematika":89,"Bahasa Indonesia":91,"Bahasa Inggris":90,"Ekonomi":90,"Sosiologi":92}',
  '{"Matematika":90,"Bahasa Indonesia":91,"Bahasa Inggris":92,"Ekonomi":92,"Sosiologi":91}',
  '{"Matematika":91,"Bahasa Indonesia":92,"Bahasa Inggris":93,"Ekonomi":91,"Sosiologi":93}',
  '{"Matematika":92,"Bahasa Indonesia":93,"Bahasa Inggris":94,"Ekonomi":93,"Sosiologi":94}',
  '{"Matematika":93,"Bahasa Indonesia":94,"Bahasa Inggris":95,"Ekonomi":94,"Sosiologi":95}', datetime('now')
)
ON CONFLICT(siswa_id) DO UPDATE SET
  nilai_smt1 = excluded.nilai_smt1, nilai_smt2 = excluded.nilai_smt2, nilai_smt3 = excluded.nilai_smt3,
  nilai_smt4 = excluded.nilai_smt4, nilai_smt5 = excluded.nilai_smt5, nilai_smt6 = excluded.nilai_smt6, updated_at = datetime('now');

INSERT INTO rekap_kehadiran_bulanan (id, siswa_id, kelas_id, tahun_ajaran_id, bulan, sakit, izin, alpa, diinput_oleh, updated_at)
VALUES
  ('demo-kehadiran-nabila-07', 'demo-parent-nabila-2026', '1af99326052f3db5334afd91542536c6', '44e4dd4af13d99dac8cc0f99687aedd1', 7, 1, 1, 0, '3062b683cc9de498f6db664f68ab4c76', datetime('now')),
  ('demo-kehadiran-nabila-08', 'demo-parent-nabila-2026', '1af99326052f3db5334afd91542536c6', '44e4dd4af13d99dac8cc0f99687aedd1', 8, 0, 1, 1, '3062b683cc9de498f6db664f68ab4c76', datetime('now')),
  ('demo-kehadiran-nabila-09', 'demo-parent-nabila-2026', '1af99326052f3db5334afd91542536c6', '44e4dd4af13d99dac8cc0f99687aedd1', 9, 1, 0, 0, '3062b683cc9de498f6db664f68ab4c76', datetime('now'))
ON CONFLICT(siswa_id, bulan, tahun_ajaran_id) DO UPDATE SET sakit = excluded.sakit, izin = excluded.izin, alpa = excluded.alpa, updated_at = datetime('now');

INSERT INTO tka_mapel_pilihan (id, siswa_id, tahun_ajaran_id, mapel_pilihan1, mapel_pilihan2, updated_at)
VALUES ('demo-tka-nabila-2026', 'demo-parent-nabila-2026', '44e4dd4af13d99dac8cc0f99687aedd1', 'Matematika', 'Bahasa Inggris', datetime('now'))
ON CONFLICT(siswa_id, tahun_ajaran_id) DO UPDATE SET mapel_pilihan1 = excluded.mapel_pilihan1, mapel_pilihan2 = excluded.mapel_pilihan2, updated_at = datetime('now');

INSERT INTO penerimaan_pt (id, siswa_id, tahun_ajaran_id, jalur, kampus_id, kampus_nama, program_studi, status, catatan, jenis_data, pilihan_ke, updated_at)
VALUES
  ('demo-pt-nabila-1', 'demo-parent-nabila-2026', '44e4dd4af13d99dac8cc0f99687aedd1', 'PILIHAN_TKA', 'DEMO-UI', 'Universitas Indonesia (contoh)', 'Psikologi', 'RENCANA', 'Data tutorial', 'PILIHAN_TKA', 1, datetime('now')),
  ('demo-pt-nabila-2', 'demo-parent-nabila-2026', '44e4dd4af13d99dac8cc0f99687aedd1', 'PILIHAN_TKA', 'DEMO-ITB', 'Institut Teknologi Bandung (contoh)', 'Desain Komunikasi Visual', 'RENCANA', 'Data tutorial', 'PILIHAN_TKA', 2, datetime('now'))
ON CONFLICT(siswa_id, tahun_ajaran_id, pilihan_ke) WHERE jenis_data = 'PILIHAN_TKA' DO UPDATE SET
  kampus_id = excluded.kampus_id, kampus_nama = excluded.kampus_nama, program_studi = excluded.program_studi, updated_at = datetime('now');

INSERT INTO parent_tka_approvals (id, siswa_id, tahun_ajaran_id, selection_fingerprint, selection_snapshot, statement_version, approved_by_parent_identifier, approved_at)
VALUES ('demo-tka-approval-nabila-2026', 'demo-parent-nabila-2026', '44e4dd4af13d99dac8cc0f99687aedd1',
  'a9bcd54c04ae4a59126373ab28a77c56f76bef40d1f481d248950328e9cfebf1',
  '{"mapelPilihan1":"Matematika","mapelPilihan2":"Bahasa Inggris","rencanaKategori":"KULIAH","rencanaCatatan":null,"pilihan1KampusId":"DEMO-UI","pilihan1KampusNama":"Universitas Indonesia (contoh)","pilihan1Prodi":"Psikologi","pilihan2KampusId":"DEMO-ITB","pilihan2KampusNama":"Institut Teknologi Bandung (contoh)","pilihan2Prodi":"Desain Komunikasi Visual"}',
  '2026-08-26.v1', '9000000001', datetime('now', '-2 day'))
ON CONFLICT(siswa_id, tahun_ajaran_id, selection_fingerprint) DO UPDATE SET approved_at = excluded.approved_at;

INSERT INTO siswa_pelanggaran (id, siswa_id, master_pelanggaran_id, tahun_ajaran_id, tanggal, jam_input, keterangan, diinput_oleh, nama_pelanggaran_snapshot, kategori_snapshot, poin_snapshot, publication_status, reviewed_by, reviewed_at, review_note, updated_at)
VALUES ('demo-pelanggaran-nabila-2026', 'demo-parent-nabila-2026', '073786d05489ca7a7c14431e2fb9de7c', '44e4dd4af13d99dac8cc0f99687aedd1', date('now', '-12 day'), '07:20', 'Contoh catatan ringan untuk tutorial; sudah dibina dan tidak berulang.', '3062b683cc9de498f6db664f68ab4c76', 'Datang terlambat lebih dari 5 menit atau terlambat masuk saat pergantian jam pelajaran', 'Ringan', 5, 'published', '3062b683cc9de498f6db664f68ab4c76', datetime('now', '-11 day'), 'Layak ditampilkan untuk tutorial.', datetime('now'))
ON CONFLICT(id) DO UPDATE SET tanggal = excluded.tanggal, keterangan = excluded.keterangan, updated_at = datetime('now');

INSERT INTO parent_discipline_clarifications (id, siswa_pelanggaran_id, siswa_id, parent_session_id, pelanggaran_nama_snapshot, pelanggaran_kategori_snapshot, pelanggaran_poin_snapshot, pelanggaran_tanggal_snapshot, request_message, status, response_message, handled_by, handled_at, created_at, updated_at)
VALUES ('demo-klarifikasi-nabila-2026', 'demo-pelanggaran-nabila-2026', 'demo-parent-nabila-2026', NULL, 'Keterlambatan masuk kelas', 'Ringan', 5, date('now', '-12 day'), 'Terima kasih atas informasinya. Anak sudah diingatkan untuk berangkat lebih awal.', 'selesai', 'Terima kasih, klarifikasi telah diterima dan dicatat.', '3062b683cc9de498f6db664f68ab4c76', datetime('now', '-10 day'), datetime('now', '-11 day'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET status = excluded.status, response_message = excluded.response_message, updated_at = datetime('now');

INSERT INTO bk_rekaman (id, siswa_id, guru_bk_id, tahun_ajaran_id, bidang, deskripsi, penanganan, tindak_lanjut, catatan_tindak_lanjut, created_at, updated_at)
VALUES ('demo-bk-nabila-2026', 'demo-parent-nabila-2026', '3062b683cc9de498f6db664f68ab4c76', '44e4dd4af13d99dac8cc0f99687aedd1', 'Pribadi', 'Contoh tindak lanjut pendampingan untuk kebutuhan tutorial portal.', '["Konseling singkat","Koordinasi orang tua"]', 'Pemanggilan orang tua', 'Pertemuan singkat untuk menyamakan dukungan belajar di rumah. Ini adalah data DEMO.', datetime('now', '-7 day'), datetime('now', '-7 day'))
ON CONFLICT(id) DO UPDATE SET catatan_tindak_lanjut = excluded.catatan_tindak_lanjut, updated_at = excluded.updated_at;

INSERT INTO parent_notifications (id, siswa_id, type, title, message, source_ref, level, is_read, created_at)
VALUES
  ('demo-notif-kehadiran-nabila-2026', 'demo-parent-nabila-2026', 'absensi', 'Rekap kehadiran diperbarui', 'Contoh notifikasi: terdapat satu ketidakhadiran yang sudah dikonfirmasi wali kelas.', 'demo:attendance:2026', 'info', 1, datetime('now', '-4 day')),
  ('demo-notif-disiplin-nabila-2026', 'demo-parent-nabila-2026', 'kedisiplinan', 'Catatan kedisiplinan', 'Contoh catatan ringan telah ditinjau dan ditindaklanjuti bersama sekolah.', 'demo:discipline:2026', 'warning', 0, datetime('now', '-3 day')),
  ('demo-notif-bk-nabila-2026', 'demo-parent-nabila-2026', 'pemanggilan', 'Pemanggilan orang tua', 'Pertemuan pendampingan telah dijadwalkan. Ini adalah data DEMO untuk tutorial.', 'bk:demo-bk-nabila-2026', 'critical', 0, datetime('now', '-2 day'))
ON CONFLICT(siswa_id, type, source_ref) DO UPDATE SET title = excluded.title, message = excluded.message, level = excluded.level, is_read = excluded.is_read;

INSERT INTO parent_summons (id, siswa_id, source_ref, reason, event_date, event_time, location, note, status, parent_response, parent_response_note, parent_responded_at, created_by, created_at, updated_at)
VALUES ('demo-summon-nabila-2026', 'demo-parent-nabila-2026', 'bk:demo-bk-nabila-2026', 'Pendampingan akademik dan kedisiplinan ringan (DEMO)', date('now', '+3 day'), '09:00', 'Ruang BK', 'Contoh agenda pemanggilan untuk video tutorial.', 'terkirim', 'hadir', 'Orang tua mengonfirmasi hadir sesuai jadwal.', datetime('now', '-1 day'), '3062b683cc9de498f6db664f68ab4c76', datetime('now', '-2 day'), datetime('now'))
ON CONFLICT(siswa_id, source_ref) DO UPDATE SET event_date = excluded.event_date, event_time = excluded.event_time, location = excluded.location, parent_response = excluded.parent_response, parent_response_note = excluded.parent_response_note, updated_at = datetime('now');

INSERT INTO parent_thread_notes (id, siswa_id, actor_type, actor_id, note_type, content, created_at)
VALUES ('demo-thread-nabila-2026', 'demo-parent-nabila-2026', 'orang_tua', '9000000001', 'respons_pemanggilan', 'Orang tua menyetujui jadwal pertemuan. Catatan ini adalah data DEMO.', datetime('now', '-1 day'))
ON CONFLICT(id) DO UPDATE SET content = excluded.content, created_at = excluded.created_at;

INSERT INTO parent_suggestions (id, parent_user_id, siswa_id, category, title, message, is_anonymous, status, read_at, handled_by, handled_at, created_at, updated_at)
VALUES ('demo-saran-nabila-2026', '9000000001', 'demo-parent-nabila-2026', 'Layanan', 'Saran untuk layanan informasi (DEMO)', 'Contoh saran orang tua: informasi jadwal dapat ditampilkan lebih awal. Saran ini sudah ditindaklanjuti untuk keperluan tutorial.', 0, 'selesai', datetime('now', '-5 day'), '3062b683cc9de498f6db664f68ab4c76', datetime('now', '-4 day'), datetime('now', '-6 day'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET status = excluded.status, handled_at = excluded.handled_at, updated_at = datetime('now');

INSERT INTO fin_dspt (id, siswa_id, nominal_target, total_dibayar, total_diskon, status, catatan, created_at, updated_at)
VALUES ('demo-dspt-nabila-2026', 'demo-parent-nabila-2026', 4000000, 2000000, 0, 'nyicil', 'Data DEMO untuk tutorial Portal Orang Tua.', datetime('now', '-60 day'), datetime('now'))
ON CONFLICT(siswa_id) DO UPDATE SET nominal_target = excluded.nominal_target, total_dibayar = excluded.total_dibayar, total_diskon = excluded.total_diskon, status = excluded.status, catatan = excluded.catatan, updated_at = datetime('now');

INSERT INTO fin_spp_saldo_awal (id, siswa_id, jumlah, total_dibayar, status, keterangan, created_at, updated_at)
VALUES ('demo-spp-nabila-2026', 'demo-parent-nabila-2026', 450000, 150000, 'belum_bayar', 'Tunggakan contoh untuk tutorial.', datetime('now', '-60 day'), datetime('now'))
ON CONFLICT(siswa_id) DO UPDATE SET jumlah = excluded.jumlah, total_dibayar = excluded.total_dibayar, status = excluded.status, keterangan = excluded.keterangan, updated_at = datetime('now');

INSERT INTO fin_transaksi (id, siswa_id, kategori, metode_bayar, jumlah_total, input_oleh, nomor_kuitansi, created_at)
VALUES ('demo-trx-nabila-2026', 'demo-parent-nabila-2026', 'DSPT', 'transfer', 2000000, '3062b683cc9de498f6db664f68ab4c76', 'DEMO-DSPT-2026-001', datetime('now', '-15 day'))
ON CONFLICT(id) DO UPDATE SET jumlah_total = excluded.jumlah_total, nomor_kuitansi = excluded.nomor_kuitansi, created_at = excluded.created_at;

INSERT INTO fin_transaksi_detail (id, transaksi_id, ref_type, ref_id, jumlah)
VALUES ('demo-trx-detail-nabila-2026', 'demo-trx-nabila-2026', 'dspt', 'demo-dspt-nabila-2026', 2000000)
ON CONFLICT(id) DO UPDATE SET jumlah = excluded.jumlah;

INSERT INTO fin_payment_submissions (id, siswa_id, dspt_id, kategori, metode_bayar, jumlah, status, bukti_url, bukti_uploaded_at, confirmed_by, confirmed_at, rejected_by, rejected_at, reject_reason, transaksi_id, bank_tujuan, created_at, updated_at)
VALUES
  ('demo-payment-confirmed-nabila-2026', 'demo-parent-nabila-2026', 'demo-dspt-nabila-2026', 'dspt', 'transfer', 2000000, 'terkonfirmasi', '/api/media/payment_proofs/demo-payment-confirmed-nabila-2026/bukti.png', datetime('now', '-15 day'), '3062b683cc9de498f6db664f68ab4c76', datetime('now', '-14 day'), NULL, NULL, NULL, 'demo-trx-nabila-2026', 'REKENING DEMO - BUKAN REKENING ASLI', datetime('now', '-15 day'), datetime('now')),
  ('demo-payment-pending-nabila-2026', 'demo-parent-nabila-2026', 'demo-dspt-nabila-2026', 'dspt', 'qris', 500000, 'menunggu_konfirmasi', '/api/media/payment_proofs/demo-payment-pending-nabila-2026/bukti.png', datetime('now', '-1 day'), NULL, NULL, NULL, NULL, NULL, NULL, NULL, datetime('now', '-1 day'), datetime('now')),
  ('demo-payment-rejected-nabila-2026', 'demo-parent-nabila-2026', 'demo-dspt-nabila-2026', 'dspt', 'transfer', 500000, 'ditolak', '/api/media/payment_proofs/demo-payment-rejected-nabila-2026/bukti.png', datetime('now', '-8 day'), NULL, NULL, '3062b683cc9de498f6db664f68ab4c76', datetime('now', '-7 day'), 'Contoh alasan penolakan: nominal pada bukti belum terbaca. Silakan unggah ulang.', NULL, 'REKENING DEMO - BUKAN REKENING ASLI', datetime('now', '-8 day'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET status = excluded.status, bukti_url = excluded.bukti_url, bukti_uploaded_at = excluded.bukti_uploaded_at, reject_reason = excluded.reject_reason, updated_at = datetime('now');
