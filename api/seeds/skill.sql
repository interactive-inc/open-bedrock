-- skill ドメインの seed
-- スキルマスタと従業員ごとの登録スキル。
-- 値は src/infrastructure/seed/seed-skills.ts と src/infrastructure/seed/seed-employee-skills.ts に一致させること。

INSERT INTO skill_definitions (code, name, category) VALUES
('typescript', 'TypeScript', 'Programming'),
('react', 'React', 'Frontend'),
('nodejs', 'Node.js', 'Backend'),
('cloudflare', 'Cloudflare Workers', 'Infrastructure'),
('sql', 'SQL', 'Database'),
('ui_design', 'UI Design', 'Design'),
('project_mgmt', 'Project Management', 'Management'),
('sales', 'Corporate Sales', 'Business'),
('customer_success', 'Customer Success', 'Business'),
('recruiting', 'Recruiting', 'Human Resources'),
('accounting', 'Accounting', 'Administration'),
('english', 'Business English', 'Language');

INSERT INTO employee_skills (employee_id, skill_code, level, years, note) VALUES
(5, 'typescript', 5, 8, 'Tech Lead'),
(5, 'cloudflare', 4, 3, NULL),
(6, 'typescript', 4, 4, NULL),
(6, 'react', 4, 4, NULL),
(7, 'nodejs', 3, 2, NULL),
(8, 'ui_design', 5, 7, 'Design System Owner'),
(4, 'project_mgmt', 5, 10, NULL),
(10, 'sales', 4, 6, NULL),
(14, 'customer_success', 4, 5, NULL),
(3, 'recruiting', 3, 3, NULL),
(17, 'accounting', 4, 9, NULL),
(19, 'typescript', 3, 2, NULL);
