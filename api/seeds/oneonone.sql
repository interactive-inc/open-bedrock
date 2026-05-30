-- oneonone ドメインの seed
-- 対象テーブル: one_on_ones
-- migration: migrations/oneonone.sql / 値: src/infrastructure/seed/seed-one-on-ones.ts

INSERT INTO one_on_ones (id, member_id, manager_id, held_at, topics, manager_note, next_action) VALUES
  ('00000000-0000-0000-0000-000000000001', 5, 4, '2026-05-01T05:00:00Z', 'Goal progress and career direction', 'Promising candidate for a lead role', 'Assign ownership of the next design review'),
  ('00000000-0000-0000-0000-000000000002', 3, 4, '2026-05-08T05:00:00Z', 'Test coverage targets', 'On track; keep monitoring workload', 'Share progress weekly'),
  ('00000000-0000-0000-0000-000000000003', 10, 9, '2026-05-12T06:00:00Z', 'New customer acquisition strategy', 'Agreed to narrow the target accounts', 'Draft a priority account list');
