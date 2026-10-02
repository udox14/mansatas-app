-- Deploy the application without Sarpras/WhatsApp BEFORE applying this migration.
-- Run as ONE transaction (Wrangler migrations apply / D1 batch), never statement-by-statement.
-- Historical migrations remain unchanged; these temporary empty placeholders make
-- already-missing module tables safe to inspect. A failed guard rolls back everything.
CREATE TABLE _retired_module_targets (name TEXT PRIMARY KEY);
INSERT INTO _retired_module_targets VALUES
  ('sarpras_aset'), ('sarpras_kategori'), ('wa_daily_locks'),
  ('wa_campaign_recipients'), ('wa_outbox'), ('wa_campaigns');

CREATE TABLE _retired_module_guard (
  empty_tables INTEGER CONSTRAINT retired_modules_must_be_empty CHECK (empty_tables = 1),
  independent INTEGER CONSTRAINT retired_modules_have_external_dependencies CHECK (independent = 1),
  valid_configs INTEGER CONSTRAINT retired_modules_invalid_navigation_json CHECK (valid_configs = 1)
);

-- Reject foreign keys, views, triggers, or other schema objects outside the modules.
-- The SQL-text check is deliberately conservative: any mention needs manual review.
INSERT INTO _retired_module_guard (independent)
SELECT NOT EXISTS (
  SELECT 1 FROM sqlite_schema AS s, _retired_module_targets AS t
  WHERE s.type IN ('table', 'view', 'trigger', 'index')
    AND lower(s.tbl_name) NOT IN (SELECT name FROM _retired_module_targets)
    AND instr(lower(COALESCE(s.sql, '')), t.name) > 0
);

CREATE TABLE IF NOT EXISTS sarpras_aset (id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS sarpras_kategori (id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS wa_daily_locks (id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS wa_campaign_recipients (id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS wa_outbox (id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS wa_campaigns (id TEXT PRIMARY KEY);

INSERT INTO _retired_module_guard (empty_tables)
SELECT NOT EXISTS (SELECT 1 FROM sarpras_aset)
   AND NOT EXISTS (SELECT 1 FROM sarpras_kategori)
   AND NOT EXISTS (SELECT 1 FROM wa_daily_locks)
   AND NOT EXISTS (SELECT 1 FROM wa_campaign_recipients)
   AND NOT EXISTS (SELECT 1 FROM wa_outbox)
   AND NOT EXISTS (SELECT 1 FROM wa_campaigns);

-- Core metadata tables must exist from the preceding migrations. Do not recreate
-- or reset them here. NULL/empty navigation means the existing application default.
CREATE TABLE _retired_module_configs (
  kind TEXT NOT NULL,
  row_id TEXT NOT NULL,
  original TEXT NOT NULL,
  doc TEXT NOT NULL,
  PRIMARY KEY (kind, row_id)
);
INSERT INTO _retired_module_configs
SELECT 'template', id, groups_json, groups_json FROM sidebar_template_config
WHERE groups_json IS NOT NULL AND groups_json <> '';
INSERT INTO _retired_module_configs
SELECT 'sidebar', role, groups_json, groups_json FROM role_sidebar_configs
WHERE groups_json IS NOT NULL AND groups_json <> '';
INSERT INTO _retired_module_configs
SELECT 'role_nav', value, mobile_nav_links, mobile_nav_links FROM master_roles
WHERE mobile_nav_links IS NOT NULL AND mobile_nav_links <> '';
INSERT INTO _retired_module_configs
SELECT 'user_nav', id, bottom_nav_override, bottom_nav_override FROM "user"
WHERE bottom_nav_override IS NOT NULL AND bottom_nav_override <> '';

INSERT INTO _retired_module_guard (valid_configs)
SELECT NOT EXISTS (
  SELECT 1 FROM _retired_module_configs
  WHERE CASE WHEN json_valid(doc) THEN
    CASE WHEN kind = 'sidebar' THEN json_type(doc) NOT IN ('array', 'object')
      ELSE json_type(doc) <> 'array' END
    ELSE 1 END
);

-- Re-scan after EACH removal to avoid array-index shifts and handle duplicates.
-- Only feature arrays are touched: group IDs, labels, order and other fields survive.
WITH RECURSIVE cleaned(kind, row_id, doc) AS (
  SELECT kind, row_id, doc FROM _retired_module_configs
  UNION ALL
  SELECT kind, row_id, json_remove(doc, (
    SELECT j.fullkey FROM json_tree(doc) AS j
    WHERE j.type = 'text' AND j.atom IN ('sarpras', 'whatsapp')
      AND typeof(j.key) = 'integer'
      AND ((kind IN ('role_nav', 'user_nav') AND j.path = '$')
        OR (kind IN ('template', 'sidebar') AND
          (j.path LIKE '$[%].items' OR j.path = '$.hiddenItemIds'
            OR j.path LIKE '$.itemPlacements.%')))
    LIMIT 1
  ))
  FROM cleaned
  WHERE EXISTS (
    SELECT 1 FROM json_tree(doc) AS j
    WHERE j.type = 'text' AND j.atom IN ('sarpras', 'whatsapp')
      AND typeof(j.key) = 'integer'
      AND ((kind IN ('role_nav', 'user_nav') AND j.path = '$')
        OR (kind IN ('template', 'sidebar') AND
          (j.path LIKE '$[%].items' OR j.path = '$.hiddenItemIds'
            OR j.path LIKE '$.itemPlacements.%')))
  )
)
UPDATE _retired_module_configs AS c SET doc = (
  SELECT doc FROM cleaned
  WHERE kind = c.kind AND row_id = c.row_id
  ORDER BY length(doc) ASC LIMIT 1
);

UPDATE sidebar_template_config SET groups_json = (
  SELECT doc FROM _retired_module_configs WHERE kind = 'template' AND row_id = sidebar_template_config.id
), updated_at = CURRENT_TIMESTAMP
WHERE id IN (SELECT row_id FROM _retired_module_configs WHERE kind = 'template' AND original <> doc);
UPDATE role_sidebar_configs SET groups_json = (
  SELECT doc FROM _retired_module_configs WHERE kind = 'sidebar' AND row_id = role_sidebar_configs.role
), updated_at = CURRENT_TIMESTAMP
WHERE role IN (SELECT row_id FROM _retired_module_configs WHERE kind = 'sidebar' AND original <> doc);
UPDATE master_roles SET mobile_nav_links = (
  SELECT doc FROM _retired_module_configs WHERE kind = 'role_nav' AND row_id = master_roles.value
)
WHERE value IN (SELECT row_id FROM _retired_module_configs WHERE kind = 'role_nav' AND original <> doc);
UPDATE "user" SET bottom_nav_override = (
  SELECT doc FROM _retired_module_configs WHERE kind = 'user_nav' AND row_id = "user".id
)
WHERE id IN (SELECT row_id FROM _retired_module_configs WHERE kind = 'user_nav' AND original <> doc);

DELETE FROM role_features WHERE feature_id IN ('sarpras', 'whatsapp');
DELETE FROM role_feature_permissions WHERE feature_id IN ('sarpras', 'whatsapp');
DELETE FROM user_feature_overrides WHERE feature_id IN ('sarpras', 'whatsapp');
DELETE FROM feature_display_settings WHERE feature_id IN ('sarpras', 'whatsapp');
DELETE FROM system_settings WHERE key IN (
  'cron_whatsapp_enabled', 'whatsapp_settings_password', 'whatsapp_provider',
  'whatsapp_access_token', 'whatsapp_phone_number_id', 'whatsapp_verify_token',
  'whatsapp_app_secret', 'whatsapp_graph_version', 'wablas_base_url',
  'wablas_token', 'wablas_secret_key', 'kirimdev_api_key', 'kirimdev_webhook_secret'
);

DROP TABLE wa_daily_locks;
DROP TABLE wa_campaign_recipients;
DROP TABLE wa_outbox;
DROP TABLE wa_campaigns;
DROP TABLE sarpras_aset;
DROP TABLE sarpras_kategori;
DROP TABLE _retired_module_configs;
DROP TABLE _retired_module_guard;
DROP TABLE _retired_module_targets;
