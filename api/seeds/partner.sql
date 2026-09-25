-- partner ドメインの seed
-- 対象テーブル: partners, contracts
-- 値は src/infrastructure/seed/seed-partners.ts / seed-contracts.ts と一致させる（テスト期待値と整合）。

INSERT INTO partners (id, code, name, category, corporate_number, note, status, created_at) VALUES
  ('0190001d-0000-7000-8000-000000000001', 'P0001', '株式会社サンプル物産', 'supplier', '1234567890123', NULL, 'active', '2026-01-05T09:00:00Z'),
  ('0190001d-0000-7000-8000-000000000002', 'P0002', 'サンプル商事株式会社', 'customer', NULL, NULL, 'active', '2026-01-06T09:00:00Z'),
  ('0190001d-0000-7000-8000-000000000003', 'P0003', '合同会社サンプルレガシー', 'other', NULL, '取引終了済み', 'archived', '2025-06-01T09:00:00Z');

INSERT INTO partner_contracts (id, partner_id, title, contract_date, starts_on, ends_on, renewal_deadline, note, created_at) VALUES
  ('0190001e-0000-7000-8000-000000000001', '0190001d-0000-7000-8000-000000000001', '供給契約', '2026-01-10', '2026-02-01', '2027-01-31', '2026-12-01', NULL, '2026-01-10T09:00:00Z'),
  ('0190001e-0000-7000-8000-000000000002', '0190001d-0000-7000-8000-000000000002', '基本売買契約', '2026-01-12', '2026-01-12', NULL, NULL, NULL, '2026-01-12T09:00:00Z');
