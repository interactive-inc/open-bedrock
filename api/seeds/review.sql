-- review ドメインの seed
-- 対象テーブル: review_cycles, review_forms
-- migration: migrations/review.sql / 値: src/infrastructure/seed/seed-review-cycles.ts, seed-review-forms.ts

INSERT INTO review_cycles (id, title, period, status, due_date) VALUES
  (1, '2026 H1 Multi-rater Review', '2026-H1', 'open', '2026-06-30'),
  (2, '2025 H2 Multi-rater Review', '2025-H2', 'closed', '2025-12-31'),
  (3, '2026 H2 Multi-rater Review', '2026-H2', 'draft', NULL);

INSERT INTO review_forms (id, cycle_id, subject_employee_id, reviewer_employee_id, reviewer_type, answers, score, status, submitted_at) VALUES
  (1, 1, 5, 5, 'self', '[]', NULL, 'pending', NULL),
  (2, 1, 5, 4, 'manager', '[]', NULL, 'pending', NULL),
  (3, 2, 5, 4, 'manager', '["Strong collaboration"]', 80, 'submitted', '2025-12-20T00:00:00Z');
