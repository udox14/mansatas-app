-- Migration: Tambah feature keuangan-daftar-ulang ke role_features
-- Role: bendahara_komite dan pengurus_koperasi

INSERT OR IGNORE INTO role_features (role, feature_id)
VALUES
  ('bendahara_komite',   'keuangan-daftar-ulang'),
  ('pengurus_koperasi',  'keuangan-daftar-ulang'),
  ('super_admin',        'keuangan-daftar-ulang');
