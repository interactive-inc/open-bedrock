-- family-care-leave ドメインの seed
-- 産休・育休・介護休業の申出。employees は他ドメインが seed するためここでは扱わない。

INSERT INTO family_care_leaves (id, employee_id, leave_kind, start_date, end_date, note, status, created_at) VALUES
  ('20000000-0000-0000-0000-000000000001', 2, 'maternity', '2026-07-01', '2026-09-30', '産前産後の休業を申し出ます', 'requested', '2026-06-01T00:00:00.000Z'),
  ('20000000-0000-0000-0000-000000000002', 4, 'childcare', '2026-10-01', '2027-03-31', NULL, 'requested', '2026-06-01T00:00:00.000Z'),
  ('20000000-0000-0000-0000-000000000003', 9, 'family_care', '2026-08-01', '2026-08-31', '家族の介護のため休業を申し出ます', 'requested', '2026-06-01T00:00:00.000Z');
