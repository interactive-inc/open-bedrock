-- company-calendar ドメインの seed
-- 対象テーブル: company_calendar_days
-- 会社休日と振替出勤日のみ行を持つ（通常営業日は行を持たない）。

INSERT INTO company_calendar_days (id, calendar_date, kind, name, created_at) VALUES
  (1, '2026-08-13', 'holiday', '夏季休業', '2026-01-05T00:00:00Z'),
  (2, '2026-08-14', 'holiday', '夏季休業', '2026-01-05T00:00:00Z'),
  (3, '2026-08-15', 'holiday', '夏季休業', '2026-01-05T00:00:00Z'),
  (4, '2026-10-10', 'workday', '全社イベントに伴う振替出勤', '2026-01-05T00:00:00Z'),
  (5, '2026-12-29', 'holiday', '年末休業', '2026-01-05T00:00:00Z'),
  (6, '2026-12-30', 'holiday', '年末休業', '2026-01-05T00:00:00Z');
