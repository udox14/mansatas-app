-- Merge Monitoring Kedisiplinan into the canonical Kedisiplinan feature.
-- Apply as one migration transaction; no discipline records or schema are changed.

-- The canonical module receives all role grants and the union of configured CRUD
-- permissions. Action-level role checks in the discipline server actions remain
-- authoritative for input, master/sanction management, and clarification review.
INSERT OR IGNORE INTO role_features (role, feature_id)
SELECT role, 'kedisiplinan'
FROM role_features
WHERE feature_id = 'monitoring-kedisiplinan';

INSERT OR IGNORE INTO role_feature_permissions
  (role, feature_id, can_create, can_read, can_update, can_delete)
SELECT role, 'kedisiplinan', can_create, can_read, can_update, can_delete
FROM role_feature_permissions
WHERE feature_id = 'monitoring-kedisiplinan';

UPDATE role_feature_permissions AS target
SET can_create = MAX(can_create, COALESCE((SELECT legacy.can_create FROM role_feature_permissions legacy WHERE legacy.role = target.role AND legacy.feature_id = 'monitoring-kedisiplinan'), 0)),
    can_read = MAX(can_read, COALESCE((SELECT legacy.can_read FROM role_feature_permissions legacy WHERE legacy.role = target.role AND legacy.feature_id = 'monitoring-kedisiplinan'), 0)),
    can_update = MAX(can_update, COALESCE((SELECT legacy.can_update FROM role_feature_permissions legacy WHERE legacy.role = target.role AND legacy.feature_id = 'monitoring-kedisiplinan'), 0)),
    can_delete = MAX(can_delete, COALESCE((SELECT legacy.can_delete FROM role_feature_permissions legacy WHERE legacy.role = target.role AND legacy.feature_id = 'monitoring-kedisiplinan'), 0)),
    updated_at = CURRENT_TIMESTAMP
WHERE target.feature_id = 'kedisiplinan'
  AND EXISTS (
    SELECT 1 FROM role_feature_permissions legacy
    WHERE legacy.role = target.role AND legacy.feature_id = 'monitoring-kedisiplinan'
  );

-- Existing Kedisiplinan grants should remain readable even when a legacy role
-- grant predates its CRUD-permission row. Keep such rows read-only here.
INSERT OR IGNORE INTO role_feature_permissions
  (role, feature_id, can_create, can_read, can_update, can_delete)
SELECT role, 'kedisiplinan', 0, 1, 0, 0
FROM role_features
WHERE feature_id = 'kedisiplinan';

-- Collapse per-user overrides according to the previous OR access rule:
-- access survives if either old module was effectively allowed. A revoke on one
-- module cannot cancel access that remains through the other module.
CREATE TABLE _discipline_access_merge (
  user_id TEXT PRIMARY KEY,
  effective_access INTEGER NOT NULL,
  role_access INTEGER NOT NULL
);

WITH effective_user_roles AS (
  SELECT user_id, role FROM user_roles
  UNION ALL
  SELECT u.id, u.role
  FROM "user" u
  WHERE NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id)
), role_access AS (
  SELECT eur.user_id,
    MAX(CASE WHEN rf.feature_id = 'kedisiplinan' THEN 1 ELSE 0 END) AS kedisiplinan_role,
    MAX(CASE WHEN rf.feature_id = 'monitoring-kedisiplinan' THEN 1 ELSE 0 END) AS monitoring_role,
    MAX(CASE WHEN eur.role IN ('super_admin', 'play_reviewer') THEN 1 ELSE 0 END) AS universal_role
  FROM effective_user_roles eur
  LEFT JOIN role_features rf
    ON rf.role = eur.role AND rf.feature_id IN ('kedisiplinan', 'monitoring-kedisiplinan')
  GROUP BY eur.user_id
), user_overrides AS (
  SELECT user_id,
    MAX(CASE WHEN feature_id = 'kedisiplinan' AND action = 'grant' THEN 1 ELSE 0 END) AS kedisiplinan_grant,
    MAX(CASE WHEN feature_id = 'kedisiplinan' AND action = 'revoke' THEN 1 ELSE 0 END) AS kedisiplinan_revoke,
    MAX(CASE WHEN feature_id = 'monitoring-kedisiplinan' AND action = 'grant' THEN 1 ELSE 0 END) AS monitoring_grant,
    MAX(CASE WHEN feature_id = 'monitoring-kedisiplinan' AND action = 'revoke' THEN 1 ELSE 0 END) AS monitoring_revoke
  FROM user_feature_overrides
  WHERE feature_id IN ('kedisiplinan', 'monitoring-kedisiplinan')
  GROUP BY user_id
)
INSERT INTO _discipline_access_merge (user_id, effective_access, role_access)
SELECT u.id,
  CASE WHEN COALESCE(ra.universal_role, 0) = 1
    OR (COALESCE(ra.kedisiplinan_role, 0) = 1 AND COALESCE(uo.kedisiplinan_revoke, 0) = 0)
    OR (COALESCE(ra.monitoring_role, 0) = 1 AND COALESCE(uo.monitoring_revoke, 0) = 0)
    OR COALESCE(uo.kedisiplinan_grant, 0) = 1
    OR COALESCE(uo.monitoring_grant, 0) = 1
    THEN 1 ELSE 0 END,
  CASE WHEN COALESCE(ra.universal_role, 0) = 1
    OR COALESCE(ra.kedisiplinan_role, 0) = 1
    OR COALESCE(ra.monitoring_role, 0) = 1
    THEN 1 ELSE 0 END
FROM "user" u
LEFT JOIN role_access ra ON ra.user_id = u.id
LEFT JOIN user_overrides uo ON uo.user_id = u.id;

DELETE FROM user_feature_overrides
WHERE feature_id IN ('kedisiplinan', 'monitoring-kedisiplinan');

INSERT INTO user_feature_overrides (user_id, feature_id, action)
SELECT user_id, 'kedisiplinan', CASE WHEN effective_access = 1 THEN 'grant' ELSE 'revoke' END
FROM _discipline_access_merge
WHERE effective_access <> role_access;

DROP TABLE _discipline_access_merge;

-- Rewrite saved navigation IDs while preserving order, group labels, and custom
-- placements. If both IDs are present, the canonical item keeps its placement.
CREATE TABLE _discipline_merge_guard (
  valid_navigation INTEGER NOT NULL CHECK (valid_navigation = 1)
);
CREATE TABLE _discipline_navigation_configs (
  kind TEXT NOT NULL,
  row_id TEXT NOT NULL,
  original TEXT NOT NULL,
  doc TEXT NOT NULL,
  PRIMARY KEY (kind, row_id)
);

INSERT INTO _discipline_navigation_configs
SELECT 'template', id, groups_json, groups_json
FROM sidebar_template_config
WHERE groups_json IS NOT NULL AND groups_json <> '';
INSERT INTO _discipline_navigation_configs
SELECT 'sidebar', role, groups_json, groups_json
FROM role_sidebar_configs
WHERE groups_json IS NOT NULL AND groups_json <> '';
INSERT INTO _discipline_navigation_configs
SELECT 'role_nav', value, mobile_nav_links, mobile_nav_links
FROM master_roles
WHERE mobile_nav_links IS NOT NULL AND mobile_nav_links <> '';
INSERT INTO _discipline_navigation_configs
SELECT 'user_nav', id, bottom_nav_override, bottom_nav_override
FROM "user"
WHERE bottom_nav_override IS NOT NULL AND bottom_nav_override <> '';
INSERT INTO _discipline_navigation_configs
SELECT 'favorite', user_id, shortcut_ids, shortcut_ids
FROM user_dashboard_preferences
WHERE shortcut_ids IS NOT NULL AND shortcut_ids <> '';

INSERT INTO _discipline_merge_guard (valid_navigation)
SELECT NOT EXISTS (
  SELECT 1 FROM _discipline_navigation_configs
  WHERE CASE WHEN json_valid(doc) THEN
    CASE WHEN kind IN ('template', 'sidebar') THEN json_type(doc) NOT IN ('array', 'object')
      ELSE json_type(doc) <> 'array' END
    ELSE 1 END
);

-- Replace the legacy ID when it is the only placement; otherwise remove the
-- legacy placement so the existing canonical placement remains authoritative.
WITH RECURSIVE rewritten(kind, row_id, doc) AS (
  SELECT kind, row_id, doc FROM _discipline_navigation_configs
  UNION ALL
  SELECT r.kind, r.row_id,
    CASE WHEN EXISTS (
      SELECT 1 FROM json_tree(r.doc) AS canonical
      WHERE canonical.type = 'text' AND canonical.atom = 'kedisiplinan'
        AND typeof(canonical.key) = 'integer'
        AND ((r.kind IN ('role_nav', 'user_nav', 'favorite') AND canonical.path = '$')
          OR (r.kind IN ('template', 'sidebar') AND
            (canonical.path LIKE '$[%].items' OR canonical.path = '$.hiddenItemIds'
              OR canonical.path LIKE '$.itemPlacements.%')))
    ) THEN json_remove(r.doc, (
      SELECT legacy.fullkey FROM json_tree(r.doc) AS legacy
      WHERE legacy.type = 'text' AND legacy.atom = 'monitoring-kedisiplinan'
        AND typeof(legacy.key) = 'integer'
        AND ((r.kind IN ('role_nav', 'user_nav', 'favorite') AND legacy.path = '$')
          OR (r.kind IN ('template', 'sidebar') AND
            (legacy.path LIKE '$[%].items' OR legacy.path = '$.hiddenItemIds'
              OR legacy.path LIKE '$.itemPlacements.%')))
      LIMIT 1
    )) ELSE json_set(r.doc, (
      SELECT legacy.fullkey FROM json_tree(r.doc) AS legacy
      WHERE legacy.type = 'text' AND legacy.atom = 'monitoring-kedisiplinan'
        AND typeof(legacy.key) = 'integer'
        AND ((r.kind IN ('role_nav', 'user_nav', 'favorite') AND legacy.path = '$')
          OR (r.kind IN ('template', 'sidebar') AND
            (legacy.path LIKE '$[%].items' OR legacy.path = '$.hiddenItemIds'
              OR legacy.path LIKE '$.itemPlacements.%')))
      LIMIT 1
    ), 'kedisiplinan') END
  FROM rewritten r
  WHERE EXISTS (
    SELECT 1 FROM json_tree(r.doc) AS legacy
    WHERE legacy.type = 'text' AND legacy.atom = 'monitoring-kedisiplinan'
      AND typeof(legacy.key) = 'integer'
      AND ((r.kind IN ('role_nav', 'user_nav', 'favorite') AND legacy.path = '$')
        OR (r.kind IN ('template', 'sidebar') AND
          (legacy.path LIKE '$[%].items' OR legacy.path = '$.hiddenItemIds'
            OR legacy.path LIKE '$.itemPlacements.%')))
  )
)
UPDATE _discipline_navigation_configs AS target
SET doc = (
  SELECT doc FROM rewritten
  WHERE kind = target.kind AND row_id = target.row_id
  ORDER BY length(doc) ASC LIMIT 1
);

UPDATE sidebar_template_config
SET groups_json = (SELECT doc FROM _discipline_navigation_configs WHERE kind = 'template' AND row_id = sidebar_template_config.id),
    updated_at = CURRENT_TIMESTAMP
WHERE id IN (SELECT row_id FROM _discipline_navigation_configs WHERE kind = 'template' AND original <> doc);
UPDATE role_sidebar_configs
SET groups_json = (SELECT doc FROM _discipline_navigation_configs WHERE kind = 'sidebar' AND row_id = role_sidebar_configs.role),
    updated_at = CURRENT_TIMESTAMP
WHERE role IN (SELECT row_id FROM _discipline_navigation_configs WHERE kind = 'sidebar' AND original <> doc);
UPDATE master_roles
SET mobile_nav_links = (SELECT doc FROM _discipline_navigation_configs WHERE kind = 'role_nav' AND row_id = master_roles.value)
WHERE value IN (SELECT row_id FROM _discipline_navigation_configs WHERE kind = 'role_nav' AND original <> doc);
UPDATE "user"
SET bottom_nav_override = (SELECT doc FROM _discipline_navigation_configs WHERE kind = 'user_nav' AND row_id = "user".id)
WHERE id IN (SELECT row_id FROM _discipline_navigation_configs WHERE kind = 'user_nav' AND original <> doc);
UPDATE user_dashboard_preferences
SET shortcut_ids = (SELECT doc FROM _discipline_navigation_configs WHERE kind = 'favorite' AND row_id = user_dashboard_preferences.user_id),
    updated_at = CURRENT_TIMESTAMP
WHERE user_id IN (SELECT row_id FROM _discipline_navigation_configs WHERE kind = 'favorite' AND original <> doc);

INSERT INTO feature_display_settings (feature_id, title, updated_at)
VALUES ('kedisiplinan', 'Kedisiplinan', CURRENT_TIMESTAMP)
ON CONFLICT(feature_id) DO UPDATE SET
  title = excluded.title,
  updated_at = CASE WHEN feature_display_settings.title <> excluded.title
    THEN CURRENT_TIMESTAMP ELSE feature_display_settings.updated_at END;

DELETE FROM role_features WHERE feature_id = 'monitoring-kedisiplinan';
DELETE FROM role_feature_permissions WHERE feature_id = 'monitoring-kedisiplinan';
DELETE FROM user_feature_overrides WHERE feature_id = 'monitoring-kedisiplinan';
DELETE FROM feature_display_settings WHERE feature_id = 'monitoring-kedisiplinan';

DROP TABLE _discipline_navigation_configs;
DROP TABLE _discipline_merge_guard;
