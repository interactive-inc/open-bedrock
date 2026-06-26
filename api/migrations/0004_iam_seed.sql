-- IAM Phase 2: roles / permissions / role_permissions のマスタシード(冪等)。
-- system role(member/manager/hr/admin)と全 permission、現行許可集合を固定投入する。

INSERT OR IGNORE INTO roles (key, name, is_system, created_at) VALUES
  ('member', 'メンバー', 1, 0),
  ('manager', 'マネージャー', 1, 0),
  ('hr', '人事', 1, 0),
  ('admin', '管理者', 1, 0);

INSERT OR IGNORE INTO permissions (key, description, category) VALUES
  ('dashboard:view', 'ダッシュボードを閲覧する', 'general'),
  ('employee:read', '従業員を閲覧する', 'employee'),
  ('employee:create', '従業員を登録する', 'employee'),
  ('employee:update', '従業員を更新する', 'employee'),
  ('employee:delete', '従業員を削除する', 'employee'),
  ('employee:assign_role', '従業員のロールを割り当てる', 'employee'),
  ('org:manage', '組織・部署を管理する', 'org'),
  ('application:approve', '申請を承認・却下する', 'application'),
  ('application_template:manage', '申請テンプレートを管理する', 'application'),
  ('expense:approve', '経費申請を承認・却下する', 'expense'),
  ('leave:approve', '休暇申請を承認・却下する', 'leave'),
  ('notification:send', '通知を送信する', 'notification'),
  ('oneonone:create', '1on1 を作成する', 'oneonone'),
  ('review:administer', '評価サイクルを運営する', 'review'),
  ('career_posting:manage', '社内公募を管理する', 'career'),
  ('room:manage', '会議室を管理する', 'room'),
  ('asset:manage', '資産を管理する', 'asset'),
  ('training:manage', '研修コースを管理する', 'training'),
  ('shift:manage', 'シフトを管理する', 'shift'),
  ('shift_swap:approve', 'シフト交代を承認する', 'shift'),
  ('survey:manage', 'アンケートを管理する', 'survey'),
  ('antisocial_check:manage', '反社チェックを管理する', 'antisocial-check'),
  ('batch:view', 'バッチジョブを閲覧する', 'batch'),
  ('onboarding:manage', 'オンボーディングを管理する', 'onboarding'),
  ('onboarding:view:all', '全従業員のオンボーディングを閲覧する', 'onboarding'),
  ('thanks_reward:manage', 'サンクスの交換景品を管理する', 'thanks'),
  ('thanks_redemption:approve', 'サンクスの交換申請を承認する', 'thanks'),
  ('goal:read:all', '他者の目標を閲覧する', 'goal'),
  ('goal:evaluate', '目標を評価する(上長)', 'goal'),
  ('attendance:read:all', '全従業員の勤怠を閲覧する', 'attendance'),
  ('iam:manage_roles', 'ロールと権限を管理する', 'iam'),
  ('iam:assign_roles', 'アカウントにロールを割り当てる', 'iam'),
  ('account:manage', 'アカウントを管理する(作成・停止・失効・identity)', 'iam');

-- role_permissions: 各 system role に現行の許可集合を付与。
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key = 'manager' AND p.key IN ('dashboard:view', 'employee:read', 'employee:create', 'employee:update', 'application:approve', 'application_template:manage', 'expense:approve', 'leave:approve', 'notification:send', 'oneonone:create', 'review:administer', 'career_posting:manage', 'room:manage', 'asset:manage', 'training:manage', 'shift:manage', 'shift_swap:approve', 'survey:manage', 'antisocial_check:manage', 'batch:view', 'onboarding:manage', 'onboarding:view:all', 'goal:read:all', 'goal:evaluate', 'attendance:read:all');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key = 'hr' AND p.key IN ('dashboard:view', 'employee:read', 'employee:create', 'employee:update', 'application:approve', 'application_template:manage', 'expense:approve', 'leave:approve', 'notification:send', 'oneonone:create', 'review:administer', 'career_posting:manage', 'room:manage', 'asset:manage', 'training:manage', 'shift:manage', 'shift_swap:approve', 'survey:manage', 'antisocial_check:manage', 'batch:view', 'onboarding:manage', 'onboarding:view:all', 'goal:read:all', 'goal:evaluate', 'attendance:read:all', 'org:manage', 'employee:delete', 'thanks_reward:manage', 'thanks_redemption:approve');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key = 'admin' AND p.key IN ('dashboard:view', 'employee:read', 'employee:create', 'employee:update', 'application:approve', 'application_template:manage', 'expense:approve', 'leave:approve', 'notification:send', 'oneonone:create', 'review:administer', 'career_posting:manage', 'room:manage', 'asset:manage', 'training:manage', 'shift:manage', 'shift_swap:approve', 'survey:manage', 'antisocial_check:manage', 'batch:view', 'onboarding:manage', 'onboarding:view:all', 'goal:read:all', 'goal:evaluate', 'attendance:read:all', 'org:manage', 'employee:delete', 'thanks_reward:manage', 'thanks_redemption:approve', 'employee:assign_role', 'iam:manage_roles', 'iam:assign_roles', 'account:manage');
