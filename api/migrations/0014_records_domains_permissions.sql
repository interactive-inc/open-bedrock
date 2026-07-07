-- ウェーブ3の permission 追加(情報・文書、記録系、人事系の残りドメイン)。
-- 機微度による付与の設計:
--   健診実施記録と給与改定と懲戒は hr / admin のみ(監査にも見せない。要配慮・最機微)
--   文書・資格・労災・勤務形態・ライセンス・インシデント・予算・人員計画は監査も閲覧可
--   アナウンス・規程集・カレンダーは総務も管理可
-- 0004_iam_seed.sql と同じく INSERT OR IGNORE で冪等に追加する。

INSERT OR IGNORE INTO permissions (key, description, category) VALUES
  ('announcement:manage', '社内アナウンスを管理する', 'announcement'),
  ('regulation:manage', '規程集を管理する', 'regulation'),
  ('document:manage', '文書台帳を管理する', 'document'),
  ('document:read:all', '文書台帳を閲覧する', 'document'),
  ('calendar:manage', '会社カレンダーを管理する', 'calendar'),
  ('work_style:manage', '勤務形態の属性を管理する', 'attendance'),
  ('work_style:read:all', '全社の勤務形態の属性を閲覧する', 'attendance'),
  ('certification:manage', '資格・免許の台帳を管理する', 'certification'),
  ('certification:read:all', '全社の資格・免許を閲覧する', 'certification'),
  ('health_checkup:manage', '健康診断の実施記録を管理する', 'health'),
  ('health_checkup:read:all', '全社の健康診断の実施記録を閲覧する', 'health'),
  ('work_accident:manage', '労災・事故の発生記録を管理する', 'health'),
  ('work_accident:read:all', '全社の労災・事故記録を閲覧する', 'health'),
  ('license:manage', 'ライセンス・SaaS台帳を管理する', 'license'),
  ('license:read:all', 'ライセンス・SaaS台帳を閲覧する', 'license'),
  ('it_incident:manage', 'インシデント記録を管理する', 'license'),
  ('it_incident:read:all', '全社のインシデント記録を閲覧する', 'license'),
  ('budget:manage', '予算枠の記録を管理する', 'budget'),
  ('budget:read:all', '予算枠の記録を閲覧する', 'budget'),
  ('salary_revision:manage', '給与改定の事実記録を管理する', 'salary'),
  ('salary_revision:read:all', '全社の給与改定記録を閲覧する', 'salary'),
  ('recruitment:manage', '採用(応募者管理)を扱う', 'recruitment'),
  ('commendation:manage', '表彰の記録を管理する', 'employee'),
  ('disciplinary_action:manage', '懲戒の記録を管理する', 'employee'),
  ('disciplinary_action:read:all', '懲戒の記録を閲覧する', 'employee'),
  ('headcount_plan:manage', '人員計画を管理する', 'headcount'),
  ('headcount_plan:read:all', '人員計画を閲覧する', 'headcount');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key IN ('hr', 'admin') AND p.key IN (
    'announcement:manage',
    'regulation:manage',
    'calendar:manage',
    'work_style:manage',
    'work_style:read:all',
    'certification:manage',
    'certification:read:all',
    'health_checkup:manage',
    'health_checkup:read:all',
    'work_accident:manage',
    'work_accident:read:all',
    'salary_revision:manage',
    'salary_revision:read:all',
    'recruitment:manage',
    'commendation:manage',
    'disciplinary_action:manage',
    'disciplinary_action:read:all',
    'headcount_plan:manage',
    'headcount_plan:read:all'
  );

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key = 'admin' AND p.key IN (
    'document:manage',
    'document:read:all',
    'license:manage',
    'license:read:all',
    'it_incident:manage',
    'it_incident:read:all',
    'budget:manage',
    'budget:read:all'
  );

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key = 'general_affairs' AND p.key IN (
    'announcement:manage',
    'regulation:manage',
    'calendar:manage',
    'document:manage',
    'document:read:all',
    'budget:read:all'
  );

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key = 'it_admin' AND p.key IN (
    'license:manage',
    'license:read:all',
    'it_incident:manage',
    'it_incident:read:all'
  );

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key = 'executive' AND p.key IN (
    'budget:manage',
    'budget:read:all',
    'headcount_plan:manage',
    'headcount_plan:read:all'
  );

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key = 'auditor' AND p.key IN (
    'document:read:all',
    'work_style:read:all',
    'certification:read:all',
    'work_accident:read:all',
    'license:read:all',
    'it_incident:read:all',
    'budget:read:all',
    'headcount_plan:read:all'
  );
