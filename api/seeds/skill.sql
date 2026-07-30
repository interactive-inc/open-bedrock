-- skill ドメインの seed
-- スキルマスタと従業員ごとの登録スキル。
-- 値は src/infrastructure/seed/seed-skills.ts と src/infrastructure/seed/seed-employee-skills.ts に一致させること。

INSERT INTO skill_definitions (code, name, category) VALUES
('typescript', 'TypeScript', 'プログラミング'),
('react', 'React', 'フロントエンド'),
('nodejs', 'Node.js', 'バックエンド'),
('cloudflare', 'Cloudflare Workers', 'インフラ'),
('sql', 'SQL', 'データベース'),
('ui_design', 'UIデザイン', 'デザイン'),
('project_mgmt', 'プロジェクトマネジメント', 'マネジメント'),
('sales', '法人営業', 'ビジネス'),
('customer_success', 'カスタマーサクセス', 'ビジネス'),
('recruiting', '採用', '人事'),
('accounting', '経理', '総務'),
('english', 'ビジネス英語', '語学');

INSERT INTO employee_skills (employee_id, skill_code, level, years, note) VALUES
(5, 'typescript', 5, 8, 'テックリード'),
(5, 'cloudflare', 4, 3, NULL),
(6, 'typescript', 4, 4, NULL),
(6, 'react', 4, 4, NULL),
(7, 'nodejs', 3, 2, NULL),
(8, 'ui_design', 5, 7, 'デザインシステムオーナー'),
(4, 'project_mgmt', 5, 10, NULL),
(10, 'sales', 4, 6, NULL),
(14, 'customer_success', 4, 5, NULL),
(3, 'recruiting', 3, 3, NULL),
(17, 'accounting', 4, 9, NULL),
(19, 'typescript', 3, 2, NULL);
