-- legacy IAM role/permission/assignmentをcanonical System IAMへ移す。
INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at)
SELECT
  CAST(id AS TEXT),
  'company:' || key,
  CASE WHEN is_system = 1 THEN 'managed' ELSE 'custom' END,
  name,
  CASE
    WHEN created_at != 0 AND abs(created_at) < 100000000000 THEN created_at * 1000
    ELSE created_at
  END,
  CASE
    WHEN created_at != 0 AND abs(created_at) < 100000000000 THEN created_at * 1000
    ELSE created_at
  END
FROM roles;

INSERT INTO system_iam_role_permissions (role_id, permission_key)
SELECT CAST(role_permission.role_id AS TEXT), permission.key
FROM role_permissions AS role_permission
INNER JOIN permissions AS permission ON permission.id = role_permission.permission_id;

INSERT INTO system_role_bindings (
  id, account_id, role_id, resource_type, resource_id, created_at, revoked_at
)
SELECT
  'legacy:' || account_id || ':' || role_id,
  CAST(account_id AS TEXT),
  CAST(role_id AS TEXT),
  NULL,
  NULL,
  CASE
    WHEN granted_at != 0 AND abs(granted_at) < 100000000000 THEN granted_at * 1000
    ELSE granted_at
  END,
  NULL
FROM account_roles;

SELECT CASE WHEN
  (SELECT count(*) FROM roles) = (SELECT count(*) FROM system_iam_roles)
  AND (SELECT count(*) FROM role_permissions) =
      (SELECT count(*) FROM system_iam_role_permissions)
  AND (SELECT count(*) FROM account_roles) =
      (SELECT count(*) FROM system_role_bindings WHERE id LIKE 'legacy:%')
THEN 1 ELSE json_extract('', '$') END AS canonical_iam_backfill_complete;
