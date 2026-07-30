-- goal ドメインの seed
-- 対象テーブル: goals, goal_evaluations
-- migration: migrations/goal.sql / 値: src/infrastructure/seed/seed-goals.ts, seed-goal-evaluations.ts

INSERT INTO performance_goals (id, employee_id, period, title, kpi, weight, status) VALUES
  (1, 5, '2026-H1', '新ダッシュボード機能をリリースする', '重大バグゼロでリリース', 40, 'in_progress'),
  (2, 5, '2026-H1', 'コードレビューの折り返し時間を短縮する', '平均応答時間4時間以内', 20, 'in_progress'),
  (3, 9, '2026-H1', 'テストカバレッジを改善する', 'カバレッジ80%以上', 30, 'in_progress'),
  (4, 9, '2025-H2', 'CI/CDパイプラインを構築する', 'デプロイの完全自動化', 50, 'completed'),
  (5, 10, '2026-H1', '新規顧客を10件獲得する', '契約成立10件', 60, 'in_progress'),
  (6, 10, '2026-H1', '既存顧客の解約率を下げる', '解約率5%未満', 20, 'draft'),
  (7, 13, '2026-H1', 'オンボーディング資料を刷新する', '資料刷新完了', 30, 'in_progress'),
  (8, 3, '2026-H1', '採用プロセスを改善する', '選考リードタイム30%短縮', 40, 'draft');

INSERT INTO goal_evaluations (id, goal_id, evaluator_id, kind, score, comment, created_at) VALUES
  (1, 4, 9, 'self', 90, '計画通り自動化を完了した', '2026-01-10T09:00:00Z'),
  (2, 4, 4, 'manager', 85, '品質が安定しており良い成果', '2026-01-15T09:00:00Z'),
  (3, 4, 4, 'final', 88, '最終評価A', '2026-01-20T09:00:00Z');
