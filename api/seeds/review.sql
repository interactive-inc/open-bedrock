-- review ドメインの seed
-- 対象テーブル: review_cycles, review_forms
-- migration: migrations/review.sql / 値: src/infrastructure/seed/seed-review-cycles.ts, seed-review-forms.ts

INSERT INTO review_cycles (id, title, period, status, due_date) VALUES
  ('01900032-0000-7000-8000-000000000001', '2026年上期 多面評価', '2026-H1', 'open', '2026-06-30'),
  ('01900032-0000-7000-8000-000000000002', '2025年下期 多面評価', '2025-H2', 'closed', '2025-12-31'),
  ('01900032-0000-7000-8000-000000000003', '2026年下期 多面評価', '2026-H2', 'draft', NULL);

INSERT INTO review_forms (id, cycle_id, subject_employee_id, reviewer_employee_id, reviewer_type, answers, score, status, submitted_at) VALUES
  ('01900033-0000-7000-8000-000000000001', '01900032-0000-7000-8000-000000000001', '01900062-0000-7000-8000-000000000005', '01900062-0000-7000-8000-000000000005', 'self', '[]', NULL, 'pending', NULL),
  ('01900033-0000-7000-8000-000000000002', '01900032-0000-7000-8000-000000000001', '01900062-0000-7000-8000-000000000005', '01900062-0000-7000-8000-000000000004', 'manager', '[]', NULL, 'pending', NULL),
  ('01900033-0000-7000-8000-000000000003', '01900032-0000-7000-8000-000000000002', '01900062-0000-7000-8000-000000000005', '01900062-0000-7000-8000-000000000004', 'manager', '["優れた協調性"]', 80, 'submitted', '2025-12-20T00:00:00Z');

-- 評価サイクルのポリシー（zReviewCyclePolicy の JSON）。open 中のサイクル 1 に設定する。
INSERT INTO review_cycle_policies (cycle_id, policy_json) VALUES
  ('01900032-0000-7000-8000-000000000001', '{"include_self":true,"include_manager":true,"include_peers":true,"include_subordinates":false,"peer_count":2}');
