-- document ドメインの seed
-- 文書台帳（保管場所・取引先・有効期限つき）
-- 値は src/infrastructure/seed/seed-documents.ts と一致させること。

INSERT INTO document_ledger_entries (id, title, category, location, partner_code, expires_on, note, created_at) VALUES
  (1, 'オフィス賃貸借契約書', 'contract', 'cabinet-A/lease', 'P0001', '2027-03-31', NULL, '2026-01-05T09:00:00Z'),
  (2, '事業許可証', 'license', 'https://example.com/docs/license', NULL, '2026-09-30', '期限前に更新すること', '2026-01-06T09:00:00Z'),
  (3, '従業員ハンドブック', NULL, 'cabinet-B/handbook', NULL, NULL, NULL, '2026-01-07T09:00:00Z');
