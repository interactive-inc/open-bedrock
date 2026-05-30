-- career ドメインの seed
-- 対象テーブル: career_postings, career_applications, career_sheets
-- migration: migrations/career.sql / 値: src/infrastructure/seed/seed-career-postings.ts, seed-career-applications.ts, seed-career-sheets.ts

INSERT INTO career_postings (id, title, dept_id, dept_name, required_skills, status) VALUES
  (1, 'Product Development Lead', 3, 'Engineering', 'typescript,project_mgmt', 'open'),
  (2, 'Customer Success Manager', 5, 'Customer Success', 'customer_success,english', 'open'),
  (3, 'Corporate Planning Specialist', 1, 'Corporate Planning', 'accounting,project_mgmt', 'closed');

INSERT INTO career_applications (id, posting_id, applicant_id, message, status) VALUES
  (1, 1, 6, 'I would like to take on the development lead role', 'applied'),
  (2, 2, 15, 'I would like to make use of my customer success experience', 'accepted');

INSERT INTO career_sheets (employee_id, goals_text, strengths_text, updated_at) VALUES
  (5, 'Lead the overall architecture as a tech lead', 'Strong design skills and quality improvement through code review', '2026-04-01T00:00:00Z'),
  (6, 'Broaden my scope as a full-stack engineer', 'Frontend development and test automation', '2026-04-05T00:00:00Z'),
  (10, 'Aim to become a sales manager', 'Customer negotiation and proposal skills', '2026-04-10T00:00:00Z');
