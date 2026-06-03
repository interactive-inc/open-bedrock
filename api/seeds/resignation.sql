-- resignation ドメインの seed
-- 退職申請。employees は他ドメインが seed するためここでは扱わない。

INSERT INTO resignations (id, employee_id, resignation_date, last_working_date, reason, status, created_at) VALUES
  ('20000000-0000-0000-0000-000000000001', 2, '2026-09-30', '2026-09-20', 'Career change', 'requested', '2026-06-01T00:00:00.000Z'),
  ('20000000-0000-0000-0000-000000000002', 4, '2026-10-31', NULL, NULL, 'requested', '2026-06-01T00:00:00.000Z'),
  ('20000000-0000-0000-0000-000000000003', 9, '2026-08-15', '2026-08-08', 'Relocation', 'requested', '2026-06-01T00:00:00.000Z');
