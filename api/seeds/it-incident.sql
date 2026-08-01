-- it-incident ドメインの seed
-- IT インシデント記録（解決済みと未解決の両方）
-- 値は src/infrastructure/seed/seed-it-incidents.ts と一致させること。

INSERT INTO it_incidents (id, occurred_at, title, summary, severity, status, resolved_at, created_at) VALUES
  (1, '2026-01-20T09:00:00Z', 'ログイン障害', '30分間ログインできない状態が発生した。', 'high', 'resolved', '2026-01-20T09:30:00Z', '2026-01-20T09:35:00Z'),
  (2, '2026-02-01T14:00:00Z', 'レポート生成の遅延', '月次レポートの生成が通常より遅かった。', 'low', 'open', NULL, '2026-02-01T14:10:00Z');
