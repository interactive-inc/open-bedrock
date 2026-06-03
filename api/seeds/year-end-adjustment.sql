-- year-end-adjustment ドメインの seed
-- 年末調整の申告受付。employees は他ドメインが seed するためここでは扱わない。

INSERT INTO year_end_adjustments (id, employee_id, target_year, note, status, created_at) VALUES
  ('20000000-0000-0000-0000-000000000001', 2, 2025, 'Submitted with dependent deduction documents', 'submitted', '2026-06-01T00:00:00.000Z'),
  ('20000000-0000-0000-0000-000000000002', 4, 2025, NULL, 'submitted', '2026-06-01T00:00:00.000Z'),
  ('20000000-0000-0000-0000-000000000003', 9, 2024, 'Resubmission after address change', 'submitted', '2026-06-01T00:00:00.000Z');
