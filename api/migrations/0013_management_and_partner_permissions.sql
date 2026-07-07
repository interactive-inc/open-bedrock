-- ウェーブ2の permission 追加と経営プリセットロール。
-- 稟議の横断閲覧、取引先・契約、会議体・意思決定記録、経営ダッシュボード。
-- 経営(executive)プリセットロールを新設し、経営の記録と俯瞰に必要な最小権限を持たせる。
-- 0004_iam_seed.sql と同じく INSERT OR IGNORE で冪等に追加する。

INSERT OR IGNORE INTO permissions (key, description, category) VALUES
  ('ringi:read:all', '全社の稟議を横断で閲覧する', 'ringi'),
  ('partner:manage', '取引先台帳を管理する', 'partner'),
  ('contract:manage', '契約記録を管理する', 'partner'),
  ('contract:read:all', '全社の契約記録を横断で閲覧する', 'partner'),
  ('meeting:manage', '会議体マスタを管理する', 'meeting'),
  ('decision:manage', '会社の意思決定記録を記録・更新する', 'decision'),
  ('management_dashboard:view', '経営ダッシュボードを閲覧する', 'dashboard');

INSERT OR IGNORE INTO roles (key, name, description, is_system, created_at) VALUES
  ('executive', '経営', '経営の記録(稟議・会議体・意思決定)と会社状態の俯瞰。個別の人事操作は持たない', 0, 0);

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key = 'admin' AND p.key IN (
    'ringi:read:all',
    'partner:manage',
    'contract:manage',
    'contract:read:all',
    'meeting:manage',
    'decision:manage',
    'management_dashboard:view'
  );

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key = 'hr' AND p.key = 'management_dashboard:view';

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key = 'executive' AND p.key IN (
    'dashboard:view',
    'employee:read',
    'management_dashboard:view',
    'ringi:read:all',
    'goal:read:all',
    'meeting:manage',
    'decision:manage',
    'contract:read:all'
  );

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key = 'general_affairs' AND p.key IN (
    'partner:manage',
    'contract:manage',
    'contract:read:all'
  );

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key = 'auditor' AND p.key IN (
    'ringi:read:all',
    'contract:read:all'
  );
