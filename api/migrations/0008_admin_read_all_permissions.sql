-- 各申請ワークフローに横断監査用の read:all 権限を追加し、hr / admin に付与する。
-- 対称に /admin エンドポイント(GET /expenses/admin など)を新設するための土台。
-- 0004_iam_seed.sql と同じく INSERT OR IGNORE で冪等に追加する。

INSERT OR IGNORE INTO permissions (key, description, category) VALUES
  ('expense:read:all', '全社の経費申請を横断で閲覧する', 'expense'),
  ('leave:read:all', '全社の休暇申請を横断で閲覧する', 'leave'),
  ('thanks_redemption:read:all', '全社のサンクス交換申請を横断で閲覧する', 'thanks'),
  ('shift_swap:read:all', '全社のシフト交代申請を横断で閲覧する', 'shift');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key IN ('hr', 'admin')
    AND p.key IN (
      'expense:read:all',
      'leave:read:all',
      'thanks_redemption:read:all',
      'shift_swap:read:all'
    );
