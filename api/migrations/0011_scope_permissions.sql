-- スコープ権限の導入(第1弾: 目標・評価・勤怠)。
-- reports = レポートライン配下(org_memberships の manager チェーン)、department = 同じ部署。
-- manager の全社スコープ(:all)を意図的に剥奪し、:reports に置き換える
-- (「manager の権限が全社に効いてしまう」問題の解消)。
-- hr / admin / auditor / review_admin は 0004〜0009 で各自に付与済みの :all を維持する。

INSERT OR IGNORE INTO permissions (key, description, category) VALUES
  ('goal:read:reports', 'レポートライン配下の目標を閲覧する', 'goal'),
  ('goal:read:department', '同じ部署の目標を閲覧する', 'goal'),
  ('goal:evaluate:reports', 'レポートライン配下の目標を評価する', 'goal'),
  ('attendance:read:reports', 'レポートライン配下の勤怠を閲覧する', 'attendance'),
  ('attendance:read:department', '同じ部署の勤怠を閲覧する', 'attendance');

-- :reports は manager に加え hr / admin にも付与する。hr / admin は :all を持つため実効上は
-- 冗長だが、ロール付与の escalation guard（付与するロールの権限 ⊆ 付与者の権限）が
-- manager ロールを付与できなくなるのを防ぐため、明示的に持たせる。
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key IN ('manager', 'hr', 'admin') AND p.key IN (
    'goal:read:reports',
    'goal:evaluate:reports',
    'attendance:read:reports'
  );

-- :department は現時点でどのプリセットにも実務付与しないが、admin が保持していないと
-- escalation guard により department スコープのカスタムロールを作成・付与できないため
-- admin にのみ付与する。
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key = 'admin' AND p.key IN (
    'goal:read:department',
    'attendance:read:department'
  );

DELETE FROM role_permissions
  WHERE role_id IN (SELECT id FROM roles WHERE key = 'manager')
    AND permission_id IN (
      SELECT id FROM permissions
      WHERE key IN ('goal:read:all', 'goal:evaluate', 'attendance:read:all')
    );
