-- Tambah fitur Monitoring Kedisiplinan sebagai pemisahan dari input Kedisiplinan.

INSERT OR IGNORE INTO role_features (role, feature_id) VALUES
('super_admin', 'monitoring-kedisiplinan'),
('admin_tu', 'monitoring-kedisiplinan'),
('kepsek', 'monitoring-kedisiplinan'),
('wakamad', 'monitoring-kedisiplinan'),
('guru_bk', 'monitoring-kedisiplinan'),
('guru_piket', 'monitoring-kedisiplinan'),
('wali_kelas', 'monitoring-kedisiplinan');

CREATE TABLE IF NOT EXISTS role_feature_permissions (
  role TEXT NOT NULL,
  feature_id TEXT NOT NULL,
  can_create INTEGER NOT NULL DEFAULT 1,
  can_read INTEGER NOT NULL DEFAULT 1,
  can_update INTEGER NOT NULL DEFAULT 1,
  can_delete INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role, feature_id),
  FOREIGN KEY (role) REFERENCES master_roles(value) ON DELETE CASCADE
);

INSERT OR IGNORE INTO role_feature_permissions
  (role, feature_id, can_create, can_read, can_update, can_delete)
VALUES
('super_admin', 'monitoring-kedisiplinan', 0, 1, 0, 0),
('admin_tu', 'monitoring-kedisiplinan', 0, 1, 0, 0),
('kepsek', 'monitoring-kedisiplinan', 0, 1, 0, 0),
('wakamad', 'monitoring-kedisiplinan', 0, 1, 0, 0),
('guru_bk', 'monitoring-kedisiplinan', 0, 1, 0, 0),
('guru_piket', 'monitoring-kedisiplinan', 0, 1, 0, 0),
('wali_kelas', 'monitoring-kedisiplinan', 0, 1, 0, 0);

CREATE TABLE IF NOT EXISTS role_sidebar_configs (
  role TEXT PRIMARY KEY,
  groups_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role) REFERENCES master_roles(value) ON DELETE CASCADE
);

UPDATE role_sidebar_configs
SET
  groups_json = json_set(groups_json, '$[' || (
    SELECT CAST(key AS INTEGER)
    FROM json_each(role_sidebar_configs.groups_json)
    WHERE json_extract(value, '$.id') = 'monitoring-rekap'
    LIMIT 1
  ) || '].items[#]', 'monitoring-kedisiplinan'),
  updated_at = CURRENT_TIMESTAMP
WHERE json_valid(groups_json)
  AND EXISTS (
    SELECT 1
    FROM json_each(role_sidebar_configs.groups_json)
    WHERE json_extract(value, '$.id') = 'monitoring-rekap'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM json_each(role_sidebar_configs.groups_json) AS g,
      json_each(g.value, '$.items') AS item
    WHERE item.value = 'monitoring-kedisiplinan'
  );

UPDATE role_sidebar_configs
SET
  groups_json = json_insert(
    groups_json,
    '$[#]',
    json_object(
      'id', 'monitoring-rekap',
      'label', 'Monitoring & Rekap',
      'items', json_array('monitoring-kedisiplinan')
    )
  ),
  updated_at = CURRENT_TIMESTAMP
WHERE json_valid(groups_json)
  AND NOT EXISTS (
    SELECT 1
    FROM json_each(role_sidebar_configs.groups_json)
    WHERE json_extract(value, '$.id') = 'monitoring-rekap'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM json_each(role_sidebar_configs.groups_json) AS g,
      json_each(g.value, '$.items') AS item
    WHERE item.value = 'monitoring-kedisiplinan'
  );
