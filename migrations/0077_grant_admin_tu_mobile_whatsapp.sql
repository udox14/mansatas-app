-- Selaraskan akses admin TU dengan menu operasional sistem.
-- Idempotent: aman dijalankan ulang.
INSERT OR IGNORE INTO role_features (role, feature_id)
VALUES
  ('admin_tu', 'whatsapp'),
  ('admin_tu', 'settings-mobile-app');
