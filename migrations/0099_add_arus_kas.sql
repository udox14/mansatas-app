-- Ledger Arus Kas manual, kategori terkelola, dan jejak audit.
CREATE TABLE IF NOT EXISTS fin_cashflow_categories (
  id TEXT PRIMARY KEY,
  direction TEXT NOT NULL CHECK(direction IN ('income','expense')),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  is_system INTEGER NOT NULL DEFAULT 0 CHECK(is_system IN (0,1)),
  created_by TEXT REFERENCES "user"(id),
  updated_by TEXT REFERENCES "user"(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fin_cashflow_category_name
  ON fin_cashflow_categories(direction, name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_fin_cashflow_category_active
  ON fin_cashflow_categories(direction, is_active, sort_order);

INSERT OR IGNORE INTO fin_cashflow_categories (id,direction,name,sort_order,is_system) VALUES
  ('income-other','income','Pemasukan Lainnya',10,1),
  ('expense-snp-1','expense','Pengembangan Standar Kompetensi Lulusan',10,1),
  ('expense-snp-2','expense','Pengembangan Standar Isi',20,1),
  ('expense-snp-3','expense','Pengembangan Proses Pembelajaran',30,1),
  ('expense-snp-4','expense','Pengembangan Penilaian Pendidikan',40,1),
  ('expense-snp-5','expense','Pengembangan Standar Tenaga Kependidikan',50,1),
  ('expense-snp-6','expense','Pengembangan Standar Sarana dan Prasarana',60,1),
  ('expense-snp-7','expense','Pengembangan Standar Pengelolaan',70,1),
  ('expense-snp-8','expense','Pengembangan Standar Pembiayaan',80,1),
  ('expense-legacy-uncategorized','expense','Pengeluaran Lama Tanpa Kategori',990,0);

-- Pertahankan kategori lama tanpa memaksakan pemetaan SNP yang berisiko salah.
INSERT OR IGNORE INTO fin_cashflow_categories (id,direction,name,sort_order,is_system)
SELECT 'expense-legacy-' || lower(hex(randomblob(8))), 'expense', trim(kategori), 900, 0
FROM fin_kas_keluar
WHERE kategori IS NOT NULL AND trim(kategori) <> ''
GROUP BY lower(trim(kategori));

CREATE TABLE IF NOT EXISTS fin_cashflow_entries (
  id TEXT PRIMARY KEY,
  direction TEXT NOT NULL CHECK(direction IN ('income','expense')),
  category_id TEXT NOT NULL REFERENCES fin_cashflow_categories(id),
  transaction_date TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount > 0),
  method TEXT NOT NULL DEFAULT 'tunai' CHECK(method IN ('tunai','transfer','qris')),
  counterparty TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL,
  proof_url TEXT,
  created_by TEXT NOT NULL REFERENCES "user"(id),
  updated_by TEXT REFERENCES "user"(id),
  is_void INTEGER NOT NULL DEFAULT 0 CHECK(is_void IN (0,1)),
  void_reason TEXT,
  voided_by TEXT REFERENCES "user"(id),
  voided_at TEXT,
  legacy_kas_keluar_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fin_cashflow_entries_date
  ON fin_cashflow_entries(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_fin_cashflow_entries_filter
  ON fin_cashflow_entries(direction, is_void, category_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_fin_cashflow_entries_method
  ON fin_cashflow_entries(method, transaction_date DESC);

INSERT OR IGNORE INTO fin_cashflow_entries (
  id,direction,category_id,transaction_date,amount,method,counterparty,description,
  proof_url,created_by,created_at,updated_at,legacy_kas_keluar_id
)
SELECT
  'legacy-' || k.id,
  'expense',
  COALESCE((SELECT c.id FROM fin_cashflow_categories c
    WHERE c.direction='expense' AND lower(c.name)=lower(trim(COALESCE(k.kategori,''))) LIMIT 1), 'expense-legacy-uncategorized'),
  k.tanggal,k.jumlah,
  CASE WHEN k.metode IN ('tunai','transfer','qris') THEN k.metode ELSE 'tunai' END,
  '',k.keterangan,k.bukti_url,k.dibuat_oleh,k.created_at,k.created_at,k.id
FROM fin_kas_keluar k
WHERE k.jumlah > 0;

CREATE TABLE IF NOT EXISTS fin_cashflow_audit (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES fin_cashflow_entries(id),
  action TEXT NOT NULL CHECK(action IN ('create','update','void')),
  before_json TEXT,
  after_json TEXT,
  actor_id TEXT NOT NULL REFERENCES "user"(id),
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fin_cashflow_audit_entry
  ON fin_cashflow_audit(entry_id, created_at DESC);

PRAGMA optimize;
