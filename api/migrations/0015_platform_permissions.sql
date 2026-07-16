-- ウェーブ4(基盤)の permission 追加。
-- 機械用トークンとエクスポートは admin 限定(データ持ち出し・なりすましのリスクが大きい)。
-- アクセス権の棚卸は情シスと監査も閲覧できる。年末調整の進捗記録は hr の職掌。
-- 0004_iam_seed.sql と同じく INSERT OR IGNORE で冪等に追加する。

INSERT OR IGNORE INTO permissions (key, description, category) VALUES
  ('api_token:manage', '機械用トークン(サービスアカウント)を管理する', 'iam'),
  ('access_review:view', 'アクセス権の棚卸(アカウント×権限の一覧)を閲覧する', 'iam'),
  ('export:run', '全データのエクスポートを実行する', 'iam'),
  ('year_end_adjustment:manage', '年末調整の提出状況を管理する', 'year-end'),
  ('year_end_adjustment:read:all', '全社の年末調整の提出状況を閲覧する', 'year-end');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key = 'admin' AND p.key IN (
    'api_token:manage',
    'access_review:view',
    'export:run'
  );

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key IN ('it_admin', 'auditor') AND p.key = 'access_review:view';

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key IN ('hr', 'admin') AND p.key IN (
    'year_end_adjustment:manage',
    'year_end_adjustment:read:all'
  );
