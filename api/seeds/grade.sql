-- grade ドメインの seed
-- 等級マスタと、従業員への等級付与履歴（昇格を含む）
-- 値は src/infrastructure/seed/seed-grades.ts / seed-employee-grades.ts と一致させること。

INSERT INTO company_grade_definitions (id, code, name, rank, description, created_at) VALUES
  (1, 'G1', '一般職', 1, '初級', '2026-01-01T00:00:00.000Z'),
  (2, 'G2', '中堅職', 2, '中級', '2026-01-01T00:00:00.000Z'),
  (3, 'G3', '上級職', 3, NULL, '2026-01-01T00:00:00.000Z');

INSERT INTO company_employee_grades
  (id, employee_id, grade_id, effective_date, reason, created_at)
VALUES
  (1, '5', 2, '2025-04-01', '初回設定', '2025-04-01T00:00:00.000Z'),
  (2, '5', 3, '2026-04-01', '昇格', '2026-04-01T00:00:00.000Z'),
  (3, '9', 1, '2025-04-01', NULL, '2025-04-01T00:00:00.000Z');
