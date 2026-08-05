-- work-accident ドメインの seed
-- 対象テーブル: work_accidents
-- 対象者不特定の事故もあるため employee_id は NULL の行を含める。

INSERT INTO work_accidents (id, occurred_on, employee_id, location, summary, severity, status, created_at) VALUES
  (1, '2026-06-18', 10, '本社 3F 階段', '階段で転倒し足首を捻挫。通院 2 回で完治', 'minor', 'closed', '2026-06-18T08:00:00Z'),
  (2, '2026-07-29', NULL, '本社 1F エントランス', '雨天時の床滑りによるヒヤリハット。負傷者なし', NULL, 'reported', '2026-07-29T09:00:00Z'),
  (3, '2026-08-01', 5, '在宅勤務中', '長時間作業による腰痛の申告。産業医面談を調整中', 'minor', 'reported', '2026-08-01T06:00:00Z');
