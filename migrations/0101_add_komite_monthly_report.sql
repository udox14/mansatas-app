ALTER TABLE fin_cashflow_entries ADD COLUMN proof_number TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fin_cashflow_entries_proof_number
  ON fin_cashflow_entries(lower(proof_number))
  WHERE proof_number IS NOT NULL AND trim(proof_number) <> '';

CREATE TABLE IF NOT EXISTS fin_cashflow_proof_sequences (
  direction TEXT NOT NULL CHECK (direction IN ('income', 'expense')),
  period TEXT NOT NULL CHECK (period GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  counter INTEGER NOT NULL DEFAULT 0 CHECK (counter >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (direction, period)
);

CREATE TABLE IF NOT EXISTS fin_monthly_opening_balances (
  period TEXT PRIMARY KEY CHECK (period GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  amount INTEGER NOT NULL,
  note TEXT,
  updated_by TEXT REFERENCES "user"(id),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

