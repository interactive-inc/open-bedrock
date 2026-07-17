-- 役職マスタの管理権限。hr / admin に付与。
INSERT OR IGNORE INTO permissions (key, description, category) VALUES
  ('position:manage', '役職マスタを管理する', 'position');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key IN ('hr', 'admin') AND p.key = 'position:manage';
