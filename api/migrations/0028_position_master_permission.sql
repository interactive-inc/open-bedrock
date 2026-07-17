-- 役職マスタ(positions)の管理 permission を追加する。
-- 役職マスタは grade:manage と同じ人事データベースの職掌なので、hr / admin に付与する。
-- 閲覧 permission は作らない（マスタは全認証者が読める）。
-- 0004_iam_seed.sql と同じく INSERT OR IGNORE で冪等に追加する。

INSERT OR IGNORE INTO permissions (key, description, category) VALUES
  ('position:manage', '役職マスタを管理する', 'position');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key IN ('hr', 'admin') AND p.key = 'position:manage';
