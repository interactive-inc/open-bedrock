-- commendation ドメインの seed
-- 対象テーブル: commendations
-- employees は他ドメイン（employee）が seed するため含めない。

INSERT INTO commendations (id, employee_id, title, reason, awarded_on, created_at) VALUES
  (1, 5, '2025年度 下期 MVP', '新機能の立ち上げを主導し、リリースを予定より 2 週間前倒しした', '2026-04-01', '2026-04-01T01:00:00Z'),
  (2, 13, '顧客満足賞', '大口顧客の解約危機に対応し、継続契約に結びつけた', '2026-04-01', '2026-04-01T01:00:00Z'),
  (3, 3, '業務改善賞', '入社手続きのチェックリスト化で対応時間を半減させた', '2025-10-01', '2025-10-01T01:00:00Z');
