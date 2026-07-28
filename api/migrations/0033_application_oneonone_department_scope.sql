-- 申請(application)と 1on1(oneonone)に部署スコープ(:department)を追加する。
-- 既存の goal / attendance / leave と同パターン。
-- :department は admin のみに付与(escalation guard 用)。

INSERT OR IGNORE INTO permissions (key, description, category) VALUES
  ('application:read:department', '同じ部署の申請を閲覧する', 'application'),
  ('oneonone:read:department', '同じ部署の 1on1 を閲覧する', 'oneonone');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key = 'admin' AND p.key IN (
    'application:read:department',
    'oneonone:read:department'
  );
