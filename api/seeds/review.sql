-- review ドメインの seed
-- 対象テーブル: review_cycles, review_forms
-- migration: migrations/review.sql / 値: src/infrastructure/seed/seed-review-cycles.ts, seed-review-forms.ts

INSERT INTO review_cycles (id, title, period, status, due_date) VALUES
  (1, '2026年上期 多面評価', '2026-H1', 'open', '2026-06-30'),
  (2, '2025年下期 多面評価', '2025-H2', 'closed', '2025-12-31'),
  (3, '2026年下期 多面評価', '2026-H2', 'draft', NULL);

INSERT INTO review_forms (id, cycle_id, subject_employee_id, reviewer_employee_id, reviewer_type, answers, score, status, submitted_at) VALUES
  (1, 1, 5, 5, 'self', '[]', NULL, 'pending', NULL),
  (2, 1, 5, 4, 'manager', '[]', NULL, 'pending', NULL),
  (3, 2, 5, 4, 'manager', '["優れた協調性"]', 80, 'submitted', '2025-12-20T00:00:00Z');

-- 評価サイクルのポリシー（zReviewCyclePolicy の JSON）。open 中のサイクル 1 に設定する。
INSERT INTO review_cycle_policies (cycle_id, policy_json) VALUES
  (1, '{"include_self":true,"include_manager":true,"include_peers":true,"include_subordinates":false,"peer_count":2}');
