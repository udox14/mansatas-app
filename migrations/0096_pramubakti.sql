-- Pramubakti: immutable schedule versions, membership history and evidence.
CREATE TABLE IF NOT EXISTS pb_schedule_versions (
 id TEXT PRIMARY KEY, effective_date TEXT NOT NULL UNIQUE, slots_json TEXT NOT NULL,
 actor_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS pb_members (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES "user"(id), start_date TEXT NOT NULL, end_date TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS pb_member_active ON pb_members(user_id) WHERE end_date IS NULL;
CREATE INDEX IF NOT EXISTS pb_member_period ON pb_members(start_date, end_date);
CREATE TABLE IF NOT EXISTS pb_holidays (
 id TEXT PRIMARY KEY, start_date TEXT NOT NULL, end_date TEXT NOT NULL, reason TEXT NOT NULL, actor_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pb_jobs (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);
INSERT OR IGNORE INTO pb_jobs VALUES ('membersihkan', 'Membersihkan', 1, 1), ('mengontrol', 'Mengontrol', 2, 1), ('sampah', 'Membuang Sampah', 3, 1);
CREATE TABLE IF NOT EXISTS pb_reports (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES "user"(id), tanggal TEXT NOT NULL,
 slot_id TEXT, jobs_json TEXT NOT NULL, tempat TEXT NOT NULL, foto_url TEXT NOT NULL,
 waktu_input TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('TEPAT_WAKTU','TELAT','TAMBAHAN')),
 actor_id TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
 UNIQUE(user_id, tanggal, slot_id)
);
CREATE INDEX IF NOT EXISTS pb_reports_period ON pb_reports(tanggal, user_id);
CREATE TABLE IF NOT EXISTS pb_leaves (
 user_id TEXT NOT NULL REFERENCES "user"(id), tanggal TEXT NOT NULL, slot_id TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('SAKIT','IZIN')), reason_id TEXT REFERENCES alasan_izin_guru(id),
 note TEXT NOT NULL, actor_id TEXT NOT NULL, updated_at TEXT NOT NULL, override_report INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(user_id, tanggal, slot_id)
);
CREATE INDEX IF NOT EXISTS pb_leaves_period ON pb_leaves(tanggal, user_id);
CREATE TRIGGER IF NOT EXISTS pb_report_leave_guard BEFORE INSERT ON pb_reports
WHEN NEW.slot_id IS NOT NULL AND EXISTS(SELECT 1 FROM pb_leaves WHERE user_id=NEW.user_id AND tanggal=NEW.tanggal AND slot_id=NEW.slot_id)
BEGIN SELECT RAISE(ABORT,'Slot sudah berstatus izin atau sakit.'); END;
CREATE TRIGGER IF NOT EXISTS pb_leave_report_guard BEFORE INSERT ON pb_leaves
WHEN NEW.override_report=0 AND EXISTS(SELECT 1 FROM pb_reports WHERE user_id=NEW.user_id AND tanggal=NEW.tanggal AND slot_id=NEW.slot_id)
BEGIN SELECT RAISE(ABORT,'Konfirmasi koreksi laporan hadir diperlukan.'); END;
CREATE TRIGGER IF NOT EXISTS pb_report_revision BEFORE UPDATE ON pb_reports
WHEN NEW.revision != OLD.revision+1
BEGIN SELECT RAISE(ABORT,'Laporan sudah berubah. Muat ulang halaman.'); END;
CREATE TABLE IF NOT EXISTS pb_audit (
 id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL,
 reason TEXT NOT NULL, before_json TEXT, after_json TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pb_templates (
 id INTEGER PRIMARY KEY CHECK(id=1), monthly TEXT NOT NULL, daily TEXT NOT NULL, actor_id TEXT NOT NULL
);
INSERT OR IGNORE INTO pb_templates VALUES (1, 'Melaksanakan layanan kebersihan dan pemeliharaan lingkungan madrasah.', 'Melaksanakan pekerjaan {pekerjaan} di {tempat}.', 'migration');
INSERT INTO pb_members(id, user_id, start_date)
 SELECT lower(hex(randomblob(16))), u.id, date('now','+7 hours') FROM "user" u
 WHERE (EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=u.id AND r.role='pramubakti')
 OR (NOT EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=u.id) AND u.role='pramubakti'))
 AND NOT EXISTS (SELECT 1 FROM pb_members m WHERE m.user_id=u.id AND m.end_date IS NULL);

CREATE TRIGGER IF NOT EXISTS pb_role_insert AFTER INSERT ON user_roles BEGIN
 UPDATE pb_members SET end_date=date('now','+7 hours') WHERE user_id=NEW.user_id AND end_date IS NULL AND NOT (EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=NEW.user_id AND r.role='pramubakti') OR (NOT EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=NEW.user_id) AND EXISTS (SELECT 1 FROM "user" u WHERE u.id=NEW.user_id AND u.role='pramubakti')));
 INSERT INTO pb_members(id,user_id,start_date) SELECT lower(hex(randomblob(16))), NEW.user_id, date('now','+7 hours')
 WHERE (EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=NEW.user_id AND r.role='pramubakti') OR (NOT EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=NEW.user_id) AND EXISTS (SELECT 1 FROM "user" u WHERE u.id=NEW.user_id AND u.role='pramubakti'))) AND NOT EXISTS (SELECT 1 FROM pb_members WHERE user_id=NEW.user_id AND end_date IS NULL);
END;
CREATE TRIGGER IF NOT EXISTS pb_role_delete AFTER DELETE ON user_roles BEGIN
 UPDATE pb_members SET end_date=date('now','+7 hours') WHERE user_id=OLD.user_id AND end_date IS NULL AND NOT (EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=OLD.user_id AND r.role='pramubakti') OR (NOT EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=OLD.user_id) AND EXISTS (SELECT 1 FROM "user" u WHERE u.id=OLD.user_id AND u.role='pramubakti')));
 INSERT INTO pb_members(id,user_id,start_date) SELECT lower(hex(randomblob(16))), OLD.user_id, date('now','+7 hours')
 WHERE (EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=OLD.user_id AND r.role='pramubakti') OR (NOT EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=OLD.user_id) AND EXISTS (SELECT 1 FROM "user" u WHERE u.id=OLD.user_id AND u.role='pramubakti'))) AND NOT EXISTS (SELECT 1 FROM pb_members WHERE user_id=OLD.user_id AND end_date IS NULL);
END;
CREATE TRIGGER IF NOT EXISTS pb_user_role AFTER UPDATE OF role ON "user" BEGIN
 UPDATE pb_members SET end_date=date('now','+7 hours') WHERE user_id=NEW.id AND end_date IS NULL AND NOT (EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=NEW.id AND r.role='pramubakti') OR (NOT EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=NEW.id) AND EXISTS (SELECT 1 FROM "user" u WHERE u.id=NEW.id AND u.role='pramubakti')));
 INSERT INTO pb_members(id,user_id,start_date) SELECT lower(hex(randomblob(16))), NEW.id, date('now','+7 hours')
 WHERE (EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=NEW.id AND r.role='pramubakti') OR (NOT EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=NEW.id) AND EXISTS (SELECT 1 FROM "user" u WHERE u.id=NEW.id AND u.role='pramubakti'))) AND NOT EXISTS (SELECT 1 FROM pb_members WHERE user_id=NEW.id AND end_date IS NULL);
END;
CREATE TRIGGER IF NOT EXISTS pb_user_insert AFTER INSERT ON "user" BEGIN
 UPDATE pb_members SET end_date=date('now','+7 hours') WHERE user_id=NEW.id AND end_date IS NULL AND NOT (EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=NEW.id AND r.role='pramubakti') OR (NOT EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=NEW.id) AND EXISTS (SELECT 1 FROM "user" u WHERE u.id=NEW.id AND u.role='pramubakti')));
 INSERT INTO pb_members(id,user_id,start_date) SELECT lower(hex(randomblob(16))), NEW.id, date('now','+7 hours')
 WHERE (EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=NEW.id AND r.role='pramubakti') OR (NOT EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=NEW.id) AND EXISTS (SELECT 1 FROM "user" u WHERE u.id=NEW.id AND u.role='pramubakti'))) AND NOT EXISTS (SELECT 1 FROM pb_members WHERE user_id=NEW.id AND end_date IS NULL);
END;
CREATE TRIGGER IF NOT EXISTS pb_role_update AFTER UPDATE OF role,user_id ON user_roles BEGIN
 UPDATE pb_members SET end_date=date('now','+7 hours') WHERE user_id=OLD.user_id AND end_date IS NULL
 AND NOT (EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=OLD.user_id AND r.role='pramubakti') OR (NOT EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=OLD.user_id) AND EXISTS(SELECT 1 FROM "user" u WHERE u.id=OLD.user_id AND u.role='pramubakti')));
 INSERT INTO pb_members(id,user_id,start_date) SELECT lower(hex(randomblob(16))),NEW.user_id,date('now','+7 hours')
 WHERE (EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=NEW.user_id AND r.role='pramubakti') OR (NOT EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=NEW.user_id) AND EXISTS(SELECT 1 FROM "user" u WHERE u.id=NEW.user_id AND u.role='pramubakti')))
 AND NOT EXISTS(SELECT 1 FROM pb_members WHERE user_id=NEW.user_id AND end_date IS NULL);
END;
INSERT OR IGNORE INTO role_features(role,feature_id) VALUES ('pramubakti','pelaporan-pramubakti');
INSERT OR IGNORE INTO role_feature_permissions(role,feature_id,can_create,can_read,can_update,can_delete) VALUES ('pramubakti','pelaporan-pramubakti',1,1,1,1);
INSERT OR IGNORE INTO role_features(role,feature_id) VALUES ('super_admin','pelaporan-pramubakti');
INSERT OR IGNORE INTO role_feature_permissions(role,feature_id,can_create,can_read,can_update,can_delete) VALUES ('super_admin','pelaporan-pramubakti',1,1,1,1);
INSERT OR IGNORE INTO role_features(role,feature_id) VALUES ('admin_tu','pelaporan-pramubakti');
INSERT OR IGNORE INTO role_feature_permissions(role,feature_id,can_create,can_read,can_update,can_delete) VALUES ('admin_tu','pelaporan-pramubakti',1,1,1,1);
INSERT OR IGNORE INTO role_features(role,feature_id) VALUES ('super_admin','monitoring-pramubakti');
INSERT OR IGNORE INTO role_feature_permissions(role,feature_id,can_create,can_read,can_update,can_delete) VALUES ('super_admin','monitoring-pramubakti',1,1,1,1);
INSERT OR IGNORE INTO role_features(role,feature_id) VALUES ('admin_tu','monitoring-pramubakti');
INSERT OR IGNORE INTO role_feature_permissions(role,feature_id,can_create,can_read,can_update,can_delete) VALUES ('admin_tu','monitoring-pramubakti',1,1,1,1);
INSERT OR IGNORE INTO role_features(role,feature_id) VALUES ('kepsek','monitoring-pramubakti');
INSERT OR IGNORE INTO role_feature_permissions(role,feature_id,can_create,can_read,can_update,can_delete) VALUES ('kepsek','monitoring-pramubakti',0,1,0,0);
INSERT OR IGNORE INTO role_features(role,feature_id) VALUES ('wakamad','monitoring-pramubakti');
INSERT OR IGNORE INTO role_feature_permissions(role,feature_id,can_create,can_read,can_update,can_delete) VALUES ('wakamad','monitoring-pramubakti',1,1,1,1);
INSERT OR IGNORE INTO role_features(role,feature_id) VALUES ('super_admin','settings-pramubakti');
INSERT OR IGNORE INTO role_feature_permissions(role,feature_id,can_create,can_read,can_update,can_delete) VALUES ('super_admin','settings-pramubakti',1,1,1,1);
INSERT OR IGNORE INTO role_features(role,feature_id) VALUES ('admin_tu','settings-pramubakti');
INSERT OR IGNORE INTO role_feature_permissions(role,feature_id,can_create,can_read,can_update,can_delete) VALUES ('admin_tu','settings-pramubakti',1,1,1,1);
