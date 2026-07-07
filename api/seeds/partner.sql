-- partner ドメインの seed
-- 対象テーブル: partners, contracts
-- 値は src/infrastructure/seed/seed-partners.ts / seed-contracts.ts と一致させる（テスト期待値と整合）。

INSERT INTO partners (id, code, name, category, corporate_number, note, status, created_at) VALUES
  (1, 'P0001', 'Acme Supplies', 'supplier', '1234567890123', NULL, 'active', '2026-01-05T09:00:00Z'),
  (2, 'P0002', 'Beta Trading', 'customer', NULL, NULL, 'active', '2026-01-06T09:00:00Z'),
  (3, 'P0003', 'Gamma Legacy', 'other', NULL, 'past partner', 'archived', '2025-06-01T09:00:00Z');

INSERT INTO contracts (id, partner_id, title, contract_date, starts_on, ends_on, renewal_deadline, note, created_at) VALUES
  (1, 1, 'Supply Agreement', '2026-01-10', '2026-02-01', '2027-01-31', '2026-12-01', NULL, '2026-01-10T09:00:00Z'),
  (2, 2, 'Master Sales Contract', '2026-01-12', '2026-01-12', NULL, NULL, NULL, '2026-01-12T09:00:00Z');
