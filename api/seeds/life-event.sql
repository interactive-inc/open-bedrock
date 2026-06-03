-- life-event ドメインの seed
-- ライフイベント届出。employees は他ドメインが seed するためここでは扱わない。

INSERT INTO life_events (id, employee_id, event_type, event_date, detail, status, created_at) VALUES
  ('20000000-0000-0000-0000-000000000001', 2, 'marriage', '2026-05-10', '氏名変更の手続きを予定', 'submitted', '2026-06-01T00:00:00.000Z'),
  ('20000000-0000-0000-0000-000000000002', 4, 'relocation', '2026-05-20', NULL, 'submitted', '2026-06-01T00:00:00.000Z'),
  ('20000000-0000-0000-0000-000000000003', 9, 'childbirth', '2026-06-01', '扶養変更の届出を予定', 'submitted', '2026-06-01T00:00:00.000Z');
