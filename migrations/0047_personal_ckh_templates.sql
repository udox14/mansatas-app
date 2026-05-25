-- Personal CKH templates
ALTER TABLE ckh_templates ADD COLUMN user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_ckh_templates_user ON ckh_templates(user_id, is_active, sort_order);
