-- application:read:all を追加し、hr / admin に付与する。
-- 全社の申請を横断で閲覧する管理画面(GET /applications/admin)のための権限。
-- 0004_iam_seed.sql は INSERT OR IGNORE のため既存 DB には反映されない。冪等な追加として本ファイルを追記する。

INSERT OR IGNORE INTO permissions (key, description, category) VALUES
  ('application:read:all', '全社の申請を横断で閲覧する', 'application');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key IN ('hr', 'admin') AND p.key = 'application:read:all';
