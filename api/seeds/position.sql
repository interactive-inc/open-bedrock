-- position ドメインの seed（役職マスタ）。
-- canonical Company position definitions へ INSERT する。
-- 値は src/infrastructure/seed/seed-positions.ts と一致させる（テスト期待値と整合）。
-- name は organization seed の position_title と一致させる。

INSERT INTO company_position_definitions (id, code, name, rank, description, created_at) VALUES
  (1, 'CTO', '最高技術責任者', 1, 'CTO（Chief Technology Officer）', '2026-01-01T00:00:00.000Z'),
  (2, 'HR_MANAGER', '人事マネージャー', 2, NULL, '2026-01-01T00:00:00.000Z'),
  (3, 'ENGINEERING_MANAGER', '開発マネージャー', 3, NULL, '2026-01-01T00:00:00.000Z'),
  (4, 'SALES_MANAGER', '営業マネージャー', 4, NULL, '2026-01-01T00:00:00.000Z'),
  (5, 'CS_MANAGER', 'カスタマーサクセスマネージャー', 5, NULL, '2026-01-01T00:00:00.000Z'),
  (6, 'ADMIN_MANAGER', '総務マネージャー', 6, NULL, '2026-01-01T00:00:00.000Z'),
  (7, 'SENIOR_ENGINEER', 'シニアエンジニア', 7, NULL, '2026-01-01T00:00:00.000Z'),
  (8, 'ENGINEER', 'エンジニア', 8, NULL, '2026-01-01T00:00:00.000Z'),
  (9, 'HR_STAFF', '人事担当', 9, NULL, '2026-01-01T00:00:00.000Z'),
  (10, 'SALES_STAFF', '営業担当', 10, NULL, '2026-01-01T00:00:00.000Z'),
  (11, 'CS_STAFF', 'カスタマーサクセス担当', 11, NULL, '2026-01-01T00:00:00.000Z'),
  (12, 'ADMIN_STAFF', '総務担当', 12, NULL, '2026-01-01T00:00:00.000Z');
