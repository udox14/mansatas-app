-- Explicitly authorized on 2026-11-25: enable RAPBM Angkatan 2026 budget positions
-- so historical SPB/cashflow mapping, new SPB reviews, realizations, and expenses work immediately.
INSERT INTO fin_komite_transaction_guard SELECT 1, 0 WHERE NOT (
  EXISTS (
    SELECT 1 FROM fin_rapbm_versions
    WHERE id = 'c26a2026-1125-4e60-95a8-63ce80123b4b'
      AND year = 2026
      AND status = 'published'
      AND komite_cohort = 2026
  )
  AND EXISTS (
    SELECT 1 FROM fin_komite_rapbm_versions
    WHERE version_id = 'c26a2026-1125-4e60-95a8-63ce80123b4b'
      AND cohort = 2026
      AND enabled = 0
  )
  AND (
    SELECT SUM(p.amount)
    FROM fin_komite_budget_positions p
    JOIN fin_rapbm_groups g ON g.id = p.group_id
    WHERE g.version_id = 'c26a2026-1125-4e60-95a8-63ce80123b4b'
  ) = 2212200000
);

UPDATE fin_komite_rapbm_versions
SET enabled = 1,
    activated_by = COALESCE((SELECT id FROM "user" WHERE id = 'dd3f7cfea48304d777433295a671c3db'), activated_by),
    activated_at = datetime('now')
WHERE version_id = 'c26a2026-1125-4e60-95a8-63ce80123b4b'
  AND cohort = 2026
  AND enabled = 0;

UPDATE komite_pengajuan
SET status = 'menunggu_bendahara',
    fund_review_cycle = fund_review_cycle + 1,
    updated_at = datetime('now')
WHERE status = 'menunggu_ketua'
  AND NOT EXISTS (
    SELECT 1 FROM fin_komite_allocations a
    WHERE a.pengajuan_id = komite_pengajuan.id AND a.state = 'review'
  );

INSERT INTO activity_logs (
  id, actor_user_id, actor_name, actor_roles, module, action, severity,
  summary, entity_type, entity_id, entity_label, before_json, after_json, metadata_json
)
VALUES (
  lower(hex(randomblob(16))),
  (SELECT id FROM "user" WHERE id = 'dd3f7cfea48304d777433295a671c3db'),
  'M. Iqbal Abdul Wakil, M.Pd.',
  '["super_admin"]',
  'rapbm',
  'activate_komite_rapbm',
  'info',
  'Mengaktifkan Pagu RAPBM Komite Angkatan 2026 untuk pemetaan pengeluaran dan operasional Komite',
  'rapbm_version',
  'c26a2026-1125-4e60-95a8-63ce80123b4b',
  'RAPBM 2026 Angkatan 2026',
  '{"enabled":0}',
  '{"enabled":1,"cohort":2026,"total_pagu":2212200000}',
  '{"reason":"Aktivasi langsung atas permintaan pengguna agar pemetaan pengeluaran historis dan seluruh fitur Komite dapat digunakan"}'
);

INSERT INTO fin_komite_transaction_guard SELECT 1, 0 WHERE NOT (
  (
    SELECT COUNT(*)
    FROM fin_komite_budget_balances
    WHERE version_id = 'c26a2026-1125-4e60-95a8-63ce80123b4b'
      AND cohort = 2026
      AND enabled = 1
      AND active = 1
  ) = 17
);
