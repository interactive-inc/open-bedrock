-- 職能別ロールのプリセットを投入する。is_system=0 なので管理画面から編集・削除できる。
-- 狙いは職能ごとの最小権限: 評価管理者(評価の確定を人事から分離) / 総務(物と場所のみ) /
-- 情シス(IAM のみ、人事データ不可視) / 監査(横断閲覧のみ、変更不可)。
-- 0004_iam_seed.sql と同じく INSERT OR IGNORE で冪等に追加する。

INSERT OR IGNORE INTO roles (key, name, description, is_system, created_at) VALUES
  ('review_admin', '評価管理者', '評価サイクルの運営と目標評価の専任。従業員台帳の管理権限は持たない', 0, 0),
  ('general_affairs', '総務', '会議室・備品・通知・反社チェックを扱う。評価・勤怠などの人事データは見えない', 0, 0),
  ('it_admin', '情シス', 'アカウント・ロール・権限の管理のみ。評価・勤怠などの人事データは見えない', 0, 0),
  ('auditor', '監査', '全ドメインの横断閲覧のみ。承認・変更はできない', 0, 0);

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key = 'review_admin' AND p.key IN (
    'dashboard:view',
    'employee:read',
    'review:administer',
    'goal:read:all',
    'goal:evaluate'
  );

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key = 'general_affairs' AND p.key IN (
    'dashboard:view',
    'employee:read',
    'room:manage',
    'asset:manage',
    'notification:send',
    'antisocial_check:manage'
  );

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key = 'it_admin' AND p.key IN (
    'dashboard:view',
    'employee:read',
    'employee:assign_role',
    'iam:manage_roles',
    'iam:assign_roles',
    'account:manage',
    'batch:view'
  );

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key = 'auditor' AND p.key IN (
    'dashboard:view',
    'employee:read',
    'application:read:all',
    'expense:read:all',
    'leave:read:all',
    'thanks_redemption:read:all',
    'shift_swap:read:all',
    'attendance:read:all',
    'goal:read:all',
    'onboarding:view:all',
    'batch:view'
  );
