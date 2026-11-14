-- Additive attribution and budget controls for Komite.
CREATE TABLE fin_komite_fund_settings (
  source TEXT PRIMARY KEY,
  allow_negative INTEGER NOT NULL CHECK(allow_negative IN (0,1)),
  updated_by TEXT NOT NULL REFERENCES "user"(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE fin_komite_opening_balances (
  period TEXT NOT NULL,
  source TEXT NOT NULL,
  amount INTEGER NOT NULL,
  note TEXT,
  updated_by TEXT NOT NULL REFERENCES "user"(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (period,source)
);

CREATE TABLE fin_komite_rapbm_versions (
  version_id TEXT PRIMARY KEY REFERENCES fin_rapbm_versions(id),
  cohort INTEGER NOT NULL CHECK(cohort BETWEEN 2026 AND 2199),
  previous_version_id TEXT UNIQUE REFERENCES fin_komite_rapbm_versions(version_id),
  activated_by TEXT NOT NULL REFERENCES "user"(id),
  activated_at TEXT NOT NULL DEFAULT (datetime('now')),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  prior_unspent INTEGER NOT NULL DEFAULT 0,
  carry_forward INTEGER NOT NULL DEFAULT 0,
  revision_reason TEXT
);
CREATE INDEX idx_komite_rapbm_cohort ON fin_komite_rapbm_versions(cohort);

CREATE TABLE fin_komite_budget_positions (
  group_id TEXT PRIMARY KEY REFERENCES fin_rapbm_groups(id),
  amount INTEGER NOT NULL CHECK(amount >= 0),
  reason TEXT
);

ALTER TABLE fin_cashflow_entries ADD COLUMN komite_revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fin_cashflow_entries ADD COLUMN komite_pre_migration INTEGER NOT NULL DEFAULT 0;
UPDATE fin_cashflow_entries SET komite_pre_migration=1;
ALTER TABLE fin_cashflow_entries ADD COLUMN komite_pengajuan_id TEXT REFERENCES komite_pengajuan(id);
CREATE UNIQUE INDEX uq_cashflow_spb_active
  ON fin_cashflow_entries(komite_pengajuan_id) WHERE is_void=0 AND komite_pengajuan_id IS NOT NULL;

ALTER TABLE komite_pengajuan ADD COLUMN komite_pre_migration INTEGER NOT NULL DEFAULT 0;
UPDATE komite_pengajuan SET komite_pre_migration=1 WHERE status='disetujui';
ALTER TABLE komite_pengajuan ADD COLUMN komite_cancelled_at TEXT;
ALTER TABLE komite_pengajuan ADD COLUMN komite_cancel_reason TEXT;
ALTER TABLE komite_pengajuan ADD COLUMN komite_cancelled_by TEXT REFERENCES "user"(id);

CREATE TABLE fin_komite_allocations (
  id TEXT PRIMARY KEY,
  pengajuan_id TEXT REFERENCES komite_pengajuan(id),
  cashflow_id TEXT REFERENCES fin_cashflow_entries(id),
  source TEXT NOT NULL CHECK(source='general' OR (source GLOB '[12][0-9][0-9][0-9]' AND CAST(source AS INTEGER) BETWEEN 2000 AND 2199)),
  group_id TEXT REFERENCES fin_komite_budget_positions(group_id),
  amount INTEGER NOT NULL CHECK(amount>0),
  state TEXT NOT NULL CHECK(state IN ('review','locked','realized','released')),
  actor_id TEXT NOT NULL REFERENCES "user"(id),
  mapping_note TEXT,
  historical INTEGER NOT NULL DEFAULT 0 CHECK(historical IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK ((pengajuan_id IS NULL) <> (cashflow_id IS NULL)),
  CHECK (group_id IS NOT NULL OR cashflow_id IS NOT NULL OR source='general' OR CAST(source AS INTEGER)<2026)
);
CREATE INDEX idx_komite_allocation_spb ON fin_komite_allocations(pengajuan_id,state);
CREATE INDEX idx_komite_allocation_cash ON fin_komite_allocations(cashflow_id,state);
CREATE INDEX idx_komite_allocation_position ON fin_komite_allocations(group_id,state);
CREATE INDEX idx_komite_allocation_source ON fin_komite_allocations(source,state);

INSERT OR IGNORE INTO fin_cashflow_categories(id,direction,name,sort_order,is_system)
VALUES('expense-komite-spb','expense','Pencairan SPB Komite',5,1);

CREATE TABLE fin_komite_spb_cash_parts (
  cashflow_id TEXT NOT NULL REFERENCES fin_cashflow_entries(id),
  source TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount>0),
  PRIMARY KEY(cashflow_id,source)
);

CREATE VIEW fin_komite_cash_ledger AS
SELECT
      'student-' || t.id AS id, 'student' AS origin, 'income' AS direction,
      CASE WHEN t.kategori='spp' THEN 'spp' ELSE 'dspt' END AS source,
      NULL AS category_id, CASE WHEN t.kategori='spp' THEN 'SPP' ELSE 'DSPT' END AS category_name,
      substr(t.created_at,1,10) AS transaction_date, t.jumlah_total AS amount,
      t.metode_bayar AS method, s.nama_lengkap AS counterparty,
      COALESCE(t.nomor_kuitansi,'Pembayaran siswa') AS description,
      t.bukti_transfer_url AS proof_url, t.nomor_kuitansi AS proof_number, t.input_oleh AS recorder_id,
      COALESCE(u.nama_lengkap,u.name,'Sistem') AS recorder_name,
      s.id AS student_id, s.nama_lengkap AS student_name,
      trim(COALESCE(k.tingkat || '-' || k.nomor_kelas || CASE WHEN k.kelompok IS NOT NULL AND k.kelompok<>'' THEN ' ' || k.kelompok ELSE '' END,'-')) AS student_class,
      s.tahun_masuk AS angkatan,
      CASE WHEN t.is_void=1 THEN 'void' ELSE 'active' END AS status,
      t.void_alasan AS void_reason, t.created_at AS created_at,
      s.kelas_id AS kelas_id, s.status AS student_status
    FROM fin_transaksi t
    JOIN siswa s ON s.id=t.siswa_id
    LEFT JOIN kelas k ON k.id=COALESCE(s.kelas_id,s.kelas_id_sebelum_keluar)
    LEFT JOIN "user" u ON u.id=t.input_oleh
    WHERE t.kategori IN ('dspt','spp')

    UNION ALL

    SELECT
      'student-dspt-balance-' || d.id, 'student', 'income', 'dspt', NULL, 'DSPT',
      substr(COALESCE(d.updated_at,d.created_at),1,10), d.total_dibayar-COALESCE(r.total_recorded,0),
      'tunai', s.nama_lengkap, 'Saldo DSPT tanpa rincian transaksi', NULL, NULL, NULL, 'Sistem',
      s.id, s.nama_lengkap,
      trim(COALESCE(k.tingkat || '-' || k.nomor_kelas || CASE WHEN k.kelompok IS NOT NULL AND k.kelompok<>'' THEN ' ' || k.kelompok ELSE '' END,'-')),
      s.tahun_masuk, 'active', NULL, COALESCE(d.updated_at,d.created_at), s.kelas_id, s.status
    FROM fin_dspt d
    JOIN siswa s ON s.id=d.siswa_id
    LEFT JOIN kelas k ON k.id=COALESCE(s.kelas_id,s.kelas_id_sebelum_keluar)
    LEFT JOIN (
      SELECT td.ref_id, SUM(td.jumlah) total_recorded
      FROM fin_transaksi_detail td JOIN fin_transaksi t ON t.id=td.transaksi_id
      WHERE td.ref_type='dspt' AND t.is_void=0 GROUP BY td.ref_id
    ) r ON r.ref_id=d.id
    WHERE d.total_dibayar-COALESCE(r.total_recorded,0) > 0

    UNION ALL

    SELECT
      'student-spp-balance-' || sp.id, 'student', 'income', 'spp', NULL, 'SPP',
      substr(COALESCE(sp.updated_at,sp.created_at),1,10), sp.total_dibayar-COALESCE(r.total_recorded,0),
      'tunai', s.nama_lengkap, 'Saldo SPP tanpa rincian transaksi', NULL, NULL, NULL, 'Sistem',
      s.id, s.nama_lengkap,
      trim(COALESCE(k.tingkat || '-' || k.nomor_kelas || CASE WHEN k.kelompok IS NOT NULL AND k.kelompok<>'' THEN ' ' || k.kelompok ELSE '' END,'-')),
      s.tahun_masuk, 'active', NULL, COALESCE(sp.updated_at,sp.created_at), s.kelas_id, s.status
    FROM fin_spp_saldo_awal sp
    JOIN siswa s ON s.id=sp.siswa_id
    LEFT JOIN kelas k ON k.id=COALESCE(s.kelas_id,s.kelas_id_sebelum_keluar)
    LEFT JOIN (
      SELECT td.ref_id, SUM(td.jumlah) total_recorded
      FROM fin_transaksi_detail td JOIN fin_transaksi t ON t.id=td.transaksi_id
      WHERE td.ref_type='spp_saldo_awal' AND t.is_void=0 GROUP BY td.ref_id
    ) r ON r.ref_id=sp.id
    WHERE sp.total_dibayar-COALESCE(r.total_recorded,0) > 0

    UNION ALL

    SELECT
      e.id, 'manual', e.direction, 'manual', e.category_id, c.name,
      e.transaction_date, e.amount, e.method, e.counterparty, e.description,
      e.proof_url, e.proof_number, e.created_by,
      COALESCE(u.nama_lengkap,u.name,'-'), NULL, NULL, NULL, NULL,
      CASE WHEN e.is_void=1 THEN 'void' ELSE 'active' END,
      e.void_reason, e.created_at, NULL, NULL
    FROM fin_cashflow_entries e
    JOIN fin_cashflow_categories c ON c.id=e.category_id
    LEFT JOIN "user" u ON u.id=e.created_by;

CREATE VIEW fin_komite_cash_parts AS
  SELECT l.id, COALESCE(CAST(l.angkatan AS TEXT),'unmapped') source, l.amount
  FROM fin_komite_cash_ledger l WHERE l.origin='student'
  UNION ALL
  SELECT a.cashflow_id,a.source,SUM(a.amount)
  FROM fin_komite_allocations a WHERE a.cashflow_id IS NOT NULL AND a.state='realized'
  GROUP BY a.cashflow_id,a.source
  UNION ALL
  SELECT cashflow_id,source,amount FROM fin_komite_spb_cash_parts
  UNION ALL
  SELECT e.id,'unmapped',e.amount
  FROM fin_cashflow_entries e
  WHERE NOT EXISTS (
    SELECT 1 FROM fin_komite_allocations a
    WHERE a.cashflow_id=e.id AND a.state='realized'
  ) AND NOT EXISTS (SELECT 1 FROM fin_komite_spb_cash_parts p WHERE p.cashflow_id=e.id);

CREATE VIEW fin_komite_fund_balances AS
  SELECT p.source,SUM(CASE l.direction WHEN 'income' THEN p.amount ELSE -p.amount END) amount
  FROM fin_komite_cash_parts p JOIN fin_komite_cash_ledger l ON l.id=p.id
  WHERE l.status='active' AND l.transaction_date<=date('now','+7 hours')
  GROUP BY p.source;

CREATE VIEW fin_komite_budget_balances AS
  SELECT p.group_id,g.version_id,v.cohort,g.label,g.account,p.amount,
    COALESCE(SUM(CASE WHEN a.state='locked' THEN a.amount END),0) locked,
    COALESCE(SUM(CASE WHEN a.state='realized' AND (a.cashflow_id IS NULL OR EXISTS(SELECT 1 FROM fin_cashflow_entries e WHERE e.id=a.cashflow_id AND e.is_void=0)) THEN a.amount END),0) realized,
    p.amount-COALESCE(SUM(CASE WHEN a.state IN ('locked','realized') AND
      (a.cashflow_id IS NULL OR EXISTS(SELECT 1 FROM fin_cashflow_entries e WHERE e.id=a.cashflow_id AND e.is_void=0))
      THEN a.amount END),0) available,
    v.enabled=1 AND NOT EXISTS(SELECT 1 FROM fin_komite_rapbm_versions next WHERE next.previous_version_id=v.version_id AND next.enabled=1) active, v.enabled
  FROM fin_komite_budget_positions p
  JOIN fin_rapbm_groups g ON g.id=p.group_id
  JOIN fin_komite_rapbm_versions v ON v.version_id=g.version_id
  LEFT JOIN fin_komite_allocations a ON a.group_id=p.group_id
  GROUP BY p.group_id;

CREATE TRIGGER komite_budget_allocate BEFORE INSERT ON fin_komite_allocations
WHEN NEW.group_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM fin_komite_budget_balances p
    WHERE p.group_id=NEW.group_id AND p.cohort=CAST(NEW.source AS INTEGER)
      AND (p.active=1 OR (p.enabled=0 AND NEW.historical=1)) AND p.available>=NEW.amount
  ) THEN RAISE(ABORT,'Pos RAPBM tidak aktif atau sisa pagu tidak cukup.') END;
END;

CREATE TRIGGER komite_budget_lock BEFORE UPDATE OF state ON fin_komite_allocations
WHEN OLD.state='review' AND NEW.state='locked' AND NEW.group_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM fin_komite_budget_balances p
    WHERE p.group_id=NEW.group_id AND p.active=1 AND p.available>=NEW.amount
  ) THEN RAISE(ABORT,'Pos RAPBM berubah atau sisa pagu tidak cukup.') END;
END;

-- Guard statements execute inside the same D1 batch as the writes they check.
CREATE TABLE fin_komite_transaction_guard (
  cash_available INTEGER NOT NULL CONSTRAINT komite_cash_insufficient CHECK(cash_available=1),
  unchanged INTEGER NOT NULL CONSTRAINT komite_write_conflict CHECK(unchanged=1)
);

CREATE TRIGGER komite_check_spb_budget BEFORE UPDATE OF status ON komite_pengajuan
WHEN OLD.status<>'disetujui' AND NEW.status='disetujui'
BEGIN
  SELECT CASE WHEN COALESCE((
    SELECT SUM(amount) FROM fin_komite_allocations WHERE pengajuan_id=NEW.id AND state='locked'
  ),0)<>NEW.nominal THEN RAISE(ABORT,'Alokasi SPB wajib sama dengan nominal yang disetujui.') END;
END;


ALTER TABLE komite_pengajuan ADD COLUMN fund_review_cycle INTEGER NOT NULL DEFAULT 0;
ALTER TABLE komite_pengajuan_reviews ADD COLUMN fund_review_cycle INTEGER NOT NULL DEFAULT 0;
DROP INDEX IF EXISTS uq_komite_review_stage_flow;
CREATE UNIQUE INDEX uq_komite_review_stage_flow ON komite_pengajuan_reviews(pengajuan_id,version_number,stage,workflow_version,fund_review_cycle);

ALTER TABLE fin_rapbm_versions ADD COLUMN komite_cohort INTEGER CHECK (komite_cohort BETWEEN 2026 AND 2199);
-- Associate the existing production upload with its confirmed cohort before locking the metadata.
UPDATE fin_rapbm_versions SET komite_cohort=2026
WHERE id='b18f2231-995c-4ea5-b3cc-de9b73076ff7' AND year=2026 AND version=1 AND komite_cohort IS NULL;
DROP INDEX uq_rapbm_published_year;
CREATE UNIQUE INDEX uq_rapbm_published_year ON fin_rapbm_versions(year,COALESCE(komite_cohort,0)) WHERE status='published';
CREATE TRIGGER rapbm_cohort_immutable BEFORE UPDATE OF komite_cohort ON fin_rapbm_versions
BEGIN SELECT RAISE(ABORT,'Angkatan versi RAPBM tidak boleh diubah'); END;
CREATE UNIQUE INDEX uq_komite_rapbm_first ON fin_komite_rapbm_versions(cohort) WHERE previous_version_id IS NULL;
CREATE VIEW fin_komite_revision_balance AS
SELECT current.version_id,current.cohort,
  COALESCE((SELECT SUM(p.available) FROM fin_komite_budget_balances p WHERE p.version_id=current.version_id),0) +
  COALESCE((SELECT SUM(p.available-child.prior_unspent) FROM (
    SELECT version_id,SUM(available) available FROM fin_komite_budget_balances GROUP BY version_id
  ) p JOIN fin_komite_rapbm_versions child ON child.previous_version_id=p.version_id
  WHERE child.cohort=current.cohort AND child.enabled=1),0) AS available
FROM fin_komite_rapbm_versions current
WHERE current.enabled=1 AND NOT EXISTS (
  SELECT 1 FROM fin_komite_rapbm_versions child WHERE child.previous_version_id=current.version_id AND child.enabled=1
);

CREATE TABLE fin_komite_fund_setting_audit (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL,
  before_value INTEGER NOT NULL,
  after_value INTEGER NOT NULL,
  actor_id TEXT NOT NULL REFERENCES "user"(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
