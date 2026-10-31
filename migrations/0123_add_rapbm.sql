-- Additive RAPBM version archive. No existing financial data is changed.
-- Rollback: remove menu/role grants in a forward fix; retain tables and stored source objects.
CREATE TABLE IF NOT EXISTS fin_rapbm_years (
    year INTEGER PRIMARY KEY CHECK(year BETWEEN 2000 AND 2199),
    active_version_id TEXT REFERENCES fin_rapbm_versions(id),
    publication_revision INTEGER NOT NULL DEFAULT 0
  );

CREATE TABLE IF NOT EXISTS fin_rapbm_versions (
    id TEXT PRIMARY KEY,year INTEGER NOT NULL REFERENCES fin_rapbm_years(year),
    version INTEGER NOT NULL CHECK(version>0),status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','superseded')),
    title TEXT NOT NULL,institution TEXT NOT NULL,sheet TEXT NOT NULL,
    income_totals_json TEXT NOT NULL,expense_totals_json TEXT NOT NULL,notes_json TEXT NOT NULL,
    original_filename TEXT NOT NULL,r2_key TEXT NOT NULL UNIQUE,source_sha256 TEXT NOT NULL,
    created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,created_by_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    published_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,published_at TEXT,
    notes_acknowledged INTEGER NOT NULL DEFAULT 0,UNIQUE(year,version)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_rapbm_published_year ON fin_rapbm_versions(year) WHERE status='published';

CREATE INDEX IF NOT EXISTS idx_rapbm_year_versions ON fin_rapbm_versions(year,version DESC);

CREATE TABLE IF NOT EXISTS fin_rapbm_groups (
    id TEXT PRIMARY KEY,version_id TEXT NOT NULL REFERENCES fin_rapbm_versions(id),
    section TEXT NOT NULL CHECK(section IN ('income','expense')),sort_order INTEGER NOT NULL,
    label TEXT NOT NULL,account TEXT,source_ref TEXT NOT NULL,subtotal_ref TEXT,
    apbn INTEGER CHECK(apbn IS NULL OR apbn>=0),komite INTEGER CHECK(komite IS NULL OR komite>=0),total INTEGER CHECK(total IS NULL OR total>=0)
  );

CREATE INDEX IF NOT EXISTS idx_rapbm_groups_version ON fin_rapbm_groups(version_id,section,sort_order);

CREATE TABLE IF NOT EXISTS fin_rapbm_items (
    id TEXT PRIMARY KEY,group_id TEXT NOT NULL REFERENCES fin_rapbm_groups(id),sort_order INTEGER NOT NULL,
    description TEXT NOT NULL,account TEXT,volume TEXT,unit TEXT,source_ref TEXT NOT NULL,
    apbn INTEGER CHECK(apbn IS NULL OR apbn>=0),komite INTEGER CHECK(komite IS NULL OR komite>=0),total INTEGER CHECK(total IS NULL OR total>=0)
  );

CREATE INDEX IF NOT EXISTS idx_rapbm_items_group ON fin_rapbm_items(group_id,sort_order);

CREATE TRIGGER IF NOT EXISTS rapbm_version_no_delete BEFORE DELETE ON fin_rapbm_versions
    BEGIN SELECT RAISE(ABORT,'Arsip RAPBM tidak boleh dihapus'); END;

CREATE TRIGGER IF NOT EXISTS rapbm_version_immutable BEFORE UPDATE OF year,version,title,institution,sheet,income_totals_json,expense_totals_json,notes_json,original_filename,r2_key,source_sha256,created_by_name,created_at ON fin_rapbm_versions
    BEGIN SELECT RAISE(ABORT,'Isi versi RAPBM tidak boleh diubah'); END;

CREATE TRIGGER IF NOT EXISTS rapbm_status_transition BEFORE UPDATE OF status ON fin_rapbm_versions
    WHEN NOT ((OLD.status='draft' AND NEW.status='published') OR (OLD.status='published' AND NEW.status='superseded'))
    BEGIN SELECT RAISE(ABORT,'Perubahan status RAPBM tidak diizinkan'); END;

CREATE TRIGGER IF NOT EXISTS rapbm_publication_immutable BEFORE UPDATE OF published_at,notes_acknowledged ON fin_rapbm_versions
    WHEN OLD.status<>'draft'
    BEGIN SELECT RAISE(ABORT,'Riwayat penerbitan RAPBM tidak boleh diubah'); END;

CREATE TRIGGER IF NOT EXISTS rapbm_groups_no_update BEFORE UPDATE ON fin_rapbm_groups BEGIN SELECT RAISE(ABORT,'Rincian RAPBM tidak boleh diubah'); END;

CREATE TRIGGER IF NOT EXISTS rapbm_groups_no_delete BEFORE DELETE ON fin_rapbm_groups BEGIN SELECT RAISE(ABORT,'Rincian RAPBM tidak boleh dihapus'); END;

CREATE TRIGGER IF NOT EXISTS rapbm_items_no_update BEFORE UPDATE ON fin_rapbm_items BEGIN SELECT RAISE(ABORT,'Rincian RAPBM tidak boleh diubah'); END;

CREATE TRIGGER IF NOT EXISTS rapbm_items_no_delete BEFORE DELETE ON fin_rapbm_items BEGIN SELECT RAISE(ABORT,'Rincian RAPBM tidak boleh dihapus'); END;

CREATE TRIGGER IF NOT EXISTS rapbm_group_draft_insert BEFORE INSERT ON fin_rapbm_groups
    WHEN NOT EXISTS (SELECT 1 FROM fin_rapbm_versions WHERE id=NEW.version_id AND status='draft')
    BEGIN SELECT RAISE(ABORT,'Versi RAPBM sudah terbit'); END;

CREATE TRIGGER IF NOT EXISTS rapbm_item_draft_insert BEFORE INSERT ON fin_rapbm_items
    WHEN NOT EXISTS (SELECT 1 FROM fin_rapbm_groups g JOIN fin_rapbm_versions v ON v.id=g.version_id WHERE g.id=NEW.group_id AND v.status='draft')
    BEGIN SELECT RAISE(ABORT,'Versi RAPBM sudah terbit'); END;

INSERT OR IGNORE INTO role_features (role,feature_id) VALUES ('super_admin','keuangan-rapbm');
INSERT OR IGNORE INTO role_feature_permissions (role,feature_id,can_create,can_read,can_update,can_delete) VALUES ('super_admin','keuangan-rapbm',1,1,1,0);
INSERT OR IGNORE INTO role_features (role,feature_id) VALUES ('bendahara_komite','keuangan-rapbm');
INSERT OR IGNORE INTO role_feature_permissions (role,feature_id,can_create,can_read,can_update,can_delete) VALUES ('bendahara_komite','keuangan-rapbm',1,1,1,0);
INSERT OR IGNORE INTO role_features (role,feature_id) VALUES ('ketua_komite','keuangan-rapbm');
INSERT OR IGNORE INTO role_feature_permissions (role,feature_id,can_create,can_read,can_update,can_delete) VALUES ('ketua_komite','keuangan-rapbm',0,1,0,0);
INSERT OR IGNORE INTO role_features (role,feature_id) VALUES ('anggota_komite','keuangan-rapbm');
INSERT OR IGNORE INTO role_feature_permissions (role,feature_id,can_create,can_read,can_update,can_delete) VALUES ('anggota_komite','keuangan-rapbm',0,1,0,0);
INSERT OR IGNORE INTO role_features (role,feature_id) VALUES ('kepsek','keuangan-rapbm');
INSERT OR IGNORE INTO role_feature_permissions (role,feature_id,can_create,can_read,can_update,can_delete) VALUES ('kepsek','keuangan-rapbm',0,1,0,0);
