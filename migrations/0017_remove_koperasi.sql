-- Hapus fitur koperasi dari modul keuangan

DELETE FROM fin_transaksi_detail
WHERE ref_type = 'koperasi_item'
   OR transaksi_id IN (
     SELECT id FROM fin_transaksi WHERE kategori = 'koperasi'
   );

DELETE FROM fin_transaksi
WHERE kategori = 'koperasi';

DELETE FROM fin_diskon
WHERE target_type = 'koperasi_item';

DELETE FROM fin_janji_bayar
WHERE target_type = 'koperasi';

DELETE FROM fin_import_log
WHERE tipe_data = 'koperasi';

DELETE FROM role_features
WHERE feature_id IN ('keuangan-koperasi')
   OR role = 'pengurus_koperasi';

DROP TABLE IF EXISTS fin_koperasi_tagihan_item;
DROP TABLE IF EXISTS fin_koperasi_tagihan;
DROP TABLE IF EXISTS fin_koperasi_master_item;
