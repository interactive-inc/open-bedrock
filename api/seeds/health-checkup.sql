-- health-checkup ドメインの seed
-- 対象テーブル: health_checkups
-- 実施記録のみ。要配慮個人情報である「結果」は絶対に持たない。

INSERT INTO health_checkups (id, employee_id, fiscal_year, checkup_kind, conducted_on, status, note, created_at) VALUES
  (1, 1, 2026, 'regular', '2026-06-10', 'completed', NULL, '2026-04-01T00:00:00Z'),
  (2, 2, 2026, 'regular', '2026-06-10', 'completed', NULL, '2026-04-01T00:00:00Z'),
  (3, 5, 2026, 'regular', NULL, 'scheduled', '7月の集団健診で受診予定', '2026-04-01T00:00:00Z'),
  (4, 9, 2026, 'regular', '2026-06-11', 'declined', '人間ドックを個人で受診済みのため辞退', '2026-04-01T00:00:00Z'),
  (5, 5, 2026, 'stress_check', '2026-07-01', 'completed', NULL, '2026-06-01T00:00:00Z'),
  (6, 13, 2026, 'stress_check', NULL, 'scheduled', NULL, '2026-06-01T00:00:00Z'),
  (7, 5, 2025, 'regular', '2025-06-12', 'completed', NULL, '2025-04-01T00:00:00Z');
