-- career ドメインの seed
-- 対象テーブル: career_postings, career_applications, career_sheets
-- migration: migrations/career.sql / 値: src/infrastructure/seed/seed-career-postings.ts, seed-career-applications.ts, seed-career-sheets.ts

INSERT INTO career_postings (id, title, dept_id, dept_name, required_skills, status) VALUES
  (1, 'プロダクト開発リード', 3, '開発部', 'typescript,project_mgmt', 'open'),
  (2, 'カスタマーサクセスマネージャー', 5, 'カスタマーサクセス部', 'customer_success,english', 'open'),
  (3, '経営企画スペシャリスト', 1, '経営企画部', 'accounting,project_mgmt', 'closed');

INSERT INTO career_applications (id, posting_id, applicant_id, message, status) VALUES
  (1, 1, 6, '開発リード職に挑戦したいです', 'applied'),
  (2, 2, 15, 'カスタマーサクセスの経験を活かしたいです', 'accepted');

INSERT INTO career_sheets (employee_id, goals_text, strengths_text, updated_at) VALUES
  (5, 'テックリードとして全体アーキテクチャを牽引したい', '設計力とコードレビューによる品質向上', '2026-04-01T00:00:00Z'),
  (6, 'フルスタックエンジニアとして担当領域を広げたい', 'フロントエンド開発とテスト自動化', '2026-04-05T00:00:00Z'),
  (10, '営業マネージャーを目指したい', '顧客交渉と提案力', '2026-04-10T00:00:00Z');
