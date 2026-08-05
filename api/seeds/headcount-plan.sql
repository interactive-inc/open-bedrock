-- headcount-plan ドメインの seed
-- 対象テーブル: headcount_plans
-- 年度・部署ごとの計画人数。実在籍数との比較は API 側で active 数を添える。

INSERT INTO headcount_plans (id, fiscal_year, department_code, planned_count, note, created_at) VALUES
  (1, 2026, 'D003', 6, '基盤強化のため 2 名増員予定', '2026-02-01T00:00:00Z'),
  (2, 2026, 'D004', 5, NULL, '2026-02-01T00:00:00Z'),
  (3, 2026, 'D005', 3, 'サポート体制の維持', '2026-02-01T00:00:00Z'),
  (4, 2027, 'D003', 8, '新規プロダクトライン立ち上げ', '2026-07-01T00:00:00Z');
