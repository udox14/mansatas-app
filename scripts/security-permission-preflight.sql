-- Must return zero rows before fail-closed CRUD enforcement is released.
-- A user-level grant is intentionally read-only unless one of the user's roles
-- has an explicit CRUD permission for the same feature.
SELECT
  ufo.user_id,
  ufo.feature_id,
  GROUP_CONCAT(DISTINCT COALESCE(ur.role, u.role)) AS effective_roles
FROM user_feature_overrides ufo
JOIN "user" u ON u.id = ufo.user_id
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN role_feature_permissions rfp
  ON rfp.feature_id = ufo.feature_id
 AND rfp.role = COALESCE(ur.role, u.role)
WHERE ufo.action = 'grant'
GROUP BY ufo.user_id, ufo.feature_id
HAVING COALESCE(MAX(rfp.can_create), 0) = 0
   AND COALESCE(MAX(rfp.can_update), 0) = 0
   AND COALESCE(MAX(rfp.can_delete), 0) = 0;
