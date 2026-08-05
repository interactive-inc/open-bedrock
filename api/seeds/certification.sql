-- certification ドメインの seed
-- 対象テーブル: certification_definitions, employee_certifications
-- employees は他ドメイン（employee）が seed するため含めない。

INSERT INTO certification_definitions (id, code, name, issuer, description, created_at) VALUES
  (1, 'CERT-IPA-FE', '基本情報技術者', '情報処理推進機構', 'IT エンジニアの登竜門となる国家試験', '2026-01-10T00:00:00Z'),
  (2, 'CERT-IPA-AP', '応用情報技術者', '情報処理推進機構', 'ワンランク上の IT 人材を対象とする国家試験', '2026-01-10T00:00:00Z'),
  (3, 'CERT-EIKEN-2', '実用英語技能検定 2級', '日本英語検定協会', '高校卒業程度の英語力の検定', '2026-01-10T00:00:00Z'),
  (4, 'CERT-BOOKKEEPING-2', '日商簿記 2級', '日本商工会議所', '商業簿記・工業簿記の検定', '2026-01-10T00:00:00Z');

-- 有効期限つき（E005 の応用情報は期限なし、E003 の英検は期限あり）。
INSERT INTO employee_certifications (id, employee_id, certification_id, acquired_on, expires_on, note, created_at) VALUES
  (1, 5, 1, '2024-11-20', NULL, NULL, '2026-01-15T00:00:00Z'),
  (2, 5, 2, '2025-06-15', NULL, '午前免除で受験', '2026-01-15T00:00:00Z'),
  (3, 3, 3, '2023-07-01', '2028-06-30', NULL, '2026-01-15T00:00:00Z'),
  (4, 16, 4, '2022-02-27', NULL, NULL, '2026-01-15T00:00:00Z'),
  (5, 9, 3, '2024-01-21', '2029-01-20', NULL, '2026-01-15T00:00:00Z');
