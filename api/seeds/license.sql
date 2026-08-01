-- license ドメインの seed
-- ソフトウェアライセンス台帳（更新期限つき）
-- 値は src/infrastructure/seed/seed-licenses.ts と一致させること。

INSERT INTO software_licenses (id, name, vendor, category, seats, renewal_deadline, owner_employee_id, note, status, created_at) VALUES
  (1, 'プロジェクト管理ツール', 'サンプルSaaS株式会社', 'saas', 50, '2026-03-31', 1, NULL, 'active', '2026-01-05T00:00:00Z'),
  (2, 'デザイン制作ソフト', NULL, 'software', 10, '2026-06-30', NULL, NULL, 'active', '2026-01-06T00:00:00Z');
