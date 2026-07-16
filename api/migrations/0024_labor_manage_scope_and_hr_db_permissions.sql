-- ウェーブ1の permission 追加。
-- 1) 労務6ドメインの代理処理(manage): hr / admin。貸与品は総務(general_affairs)にも付与
-- 2) 休暇のスコープ: manager に leave:read:reports、admin に leave:read:department(escalation guard 用)
-- 3) 人事データベース: 等級(grade)と異動・在籍イベント(employee_event)。
--    grade:read:all は評価運営と監査にも付与する
-- 0004_iam_seed.sql と同じく INSERT OR IGNORE で冪等に追加する。

INSERT OR IGNORE INTO permissions (key, description, category) VALUES
  ('certificate_request:manage', '証明書発行依頼の状態を代理で進める', 'certificate-request'),
  ('resignation:manage', '退職手続きの状態を代理で進める', 'resignation'),
  ('life_event:manage', 'ライフイベント届の状態を代理で進める', 'life-event'),
  ('family_care_leave:manage', '産休・育休・介護休業の申出の状態を代理で進める', 'family-care-leave'),
  ('business_trip:manage', '出張申請の状態を代理で進める', 'business-trip'),
  ('rental:manage', '貸与品予約の状態を代理で進める', 'rental'),
  ('leave:read:reports', 'レポートライン配下の休暇申請を閲覧する', 'leave'),
  ('leave:read:department', '同じ部署の休暇申請を閲覧する', 'leave'),
  ('grade:manage', '等級マスタと等級の割当を管理する', 'grade'),
  ('grade:read:all', '全社の等級を閲覧する', 'grade'),
  ('grade:read:reports', 'レポートライン配下の等級を閲覧する', 'grade'),
  ('employee_event:manage', '異動・在籍イベントの履歴を記録する', 'employee'),
  ('employee_event:read:all', '全社の異動・在籍イベント履歴を閲覧する', 'employee');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key IN ('hr', 'admin') AND p.key IN (
    'certificate_request:manage',
    'resignation:manage',
    'life_event:manage',
    'family_care_leave:manage',
    'business_trip:manage',
    'rental:manage',
    'grade:manage',
    'grade:read:all',
    'employee_event:manage',
    'employee_event:read:all'
  );

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key = 'general_affairs' AND p.key = 'rental:manage';

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key IN ('manager', 'hr', 'admin') AND p.key IN (
    'leave:read:reports',
    'grade:read:reports'
  );

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key = 'admin' AND p.key = 'leave:read:department';

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key IN ('review_admin', 'auditor') AND p.key = 'grade:read:all';

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key = 'auditor' AND p.key = 'employee_event:read:all';
