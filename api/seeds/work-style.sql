-- work-style ドメインの seed
-- 対象テーブル: employee_work_styles
-- 勤務形態の期間つき記録。E005 は通常勤務からフレックスへ切り替えた履歴を持つ。

INSERT INTO employee_work_styles (id, employee_id, style, starts_on, ends_on, note, created_at) VALUES
  (1, 5, 'regular', '2020-04-01', '2025-03-31', NULL, '2026-01-05T00:00:00Z'),
  (2, 5, 'flextime', '2025-04-01', NULL, 'コアタイム 11:00-15:00', '2026-01-05T00:00:00Z'),
  (3, 4, 'discretionary', '2023-04-01', NULL, '専門業務型裁量労働制', '2026-01-05T00:00:00Z'),
  (4, 13, 'shift', '2024-10-01', NULL, 'サポート窓口のシフト勤務', '2026-01-05T00:00:00Z');
