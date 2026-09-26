-- career ドメインの seed
-- 対象テーブル: career_postings, career_applications, career_sheets
-- migration: migrations/career.sql / 値: src/infrastructure/seed/seed-career-postings.ts, seed-career-applications.ts, seed-career-sheets.ts

INSERT INTO career_postings (id, title, organization_unit_id, required_skills, status) VALUES
  ('01900017-0000-7000-8000-000000000001', 'プロダクト開発リード', '0190005e-0000-7000-8000-000044303033', 'typescript,project_mgmt', 'open'),
  ('01900017-0000-7000-8000-000000000002', 'カスタマーサクセスマネージャー', '0190005e-0000-7000-8000-000044303035', 'customer_success,english', 'open'),
  ('01900017-0000-7000-8000-000000000003', '経営企画スペシャリスト', '0190005e-0000-7000-8000-000044303031', 'accounting,project_mgmt', 'closed');

INSERT INTO career_applications (id, posting_id, applicant_id, message, status) VALUES
  ('01900018-0000-7000-8000-000000000001', '01900017-0000-7000-8000-000000000001', '01900062-0000-7000-8000-000000000006', '開発リード職に挑戦したいです', 'applied'),
  ('01900018-0000-7000-8000-000000000002', '01900017-0000-7000-8000-000000000002', '01900062-0000-7000-8000-00000000000f', 'カスタマーサクセスの経験を活かしたいです', 'accepted');

INSERT INTO career_sheets (employee_id, goals_text, strengths_text, updated_at) VALUES
  ('01900062-0000-7000-8000-000000000005', 'テックリードとして全体アーキテクチャを牽引したい', '設計力とコードレビューによる品質向上', '2026-04-01T00:00:00Z'),
  ('01900062-0000-7000-8000-000000000006', 'フルスタックエンジニアとして担当領域を広げたい', 'フロントエンド開発とテスト自動化', '2026-04-05T00:00:00Z'),
  ('01900062-0000-7000-8000-00000000000a', '営業マネージャーを目指したい', '顧客交渉と提案力', '2026-04-10T00:00:00Z');
