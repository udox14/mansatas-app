-- Gabungkan izin DSPT/SPP ke fitur kanonis keuangan-dspt.
INSERT OR IGNORE INTO role_features (role, feature_id)
SELECT role, 'keuangan-dspt' FROM role_features WHERE feature_id = 'keuangan-spp';

INSERT OR IGNORE INTO role_feature_permissions
  (role, feature_id, can_create, can_read, can_update, can_delete)
SELECT role, 'keuangan-dspt', can_create, can_read, can_update, can_delete
FROM role_feature_permissions WHERE feature_id = 'keuangan-spp';

UPDATE role_feature_permissions AS target
SET can_create = MAX(can_create, COALESCE((SELECT legacy.can_create FROM role_feature_permissions legacy WHERE legacy.role=target.role AND legacy.feature_id='keuangan-spp'), 0)),
    can_read   = MAX(can_read,   COALESCE((SELECT legacy.can_read   FROM role_feature_permissions legacy WHERE legacy.role=target.role AND legacy.feature_id='keuangan-spp'), 0)),
    can_update = MAX(can_update, COALESCE((SELECT legacy.can_update FROM role_feature_permissions legacy WHERE legacy.role=target.role AND legacy.feature_id='keuangan-spp'), 0)),
    can_delete = MAX(can_delete, COALESCE((SELECT legacy.can_delete FROM role_feature_permissions legacy WHERE legacy.role=target.role AND legacy.feature_id='keuangan-spp'), 0)),
    updated_at = CURRENT_TIMESTAMP
WHERE target.feature_id='keuangan-dspt';

INSERT OR IGNORE INTO user_feature_overrides (user_id, feature_id, action)
SELECT user_id, 'keuangan-dspt', action FROM user_feature_overrides WHERE feature_id='keuangan-spp';

UPDATE user_feature_overrides AS target
SET action = CASE WHEN EXISTS (
  SELECT 1 FROM user_feature_overrides legacy
  WHERE legacy.user_id=target.user_id AND legacy.feature_id='keuangan-spp' AND legacy.action='grant'
) THEN 'grant' ELSE target.action END
WHERE target.feature_id='keuangan-dspt';

DELETE FROM role_feature_permissions WHERE feature_id='keuangan-spp';
DELETE FROM role_features WHERE feature_id='keuangan-spp';
DELETE FROM user_feature_overrides WHERE feature_id='keuangan-spp';

-- SPP bulanan tidak pernah diberlakukan. Tunggakan lama tetap berada di fin_spp_saldo_awal.
DROP TABLE IF EXISTS fin_spp_tagihan;
DROP TABLE IF EXISTS fin_spp_mulai;
DROP TABLE IF EXISTS fin_spp_setting;
