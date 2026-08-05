-- thanks ドメインの seed
-- 対象テーブル: thanks_messages, thanks_point_budgets, thanks_rewards, thanks_redemptions
-- 交換申請は pending を 1 件含め、inbox（/inbox/thanks-redemptions）に件数が出る状態を作る。

INSERT INTO thanks_messages (id, sender_employee_id, recipient_employee_id, message, points, created_at) VALUES
  (1, 4, 5, 'リリース前の追い込み、本当に助かりました。ありがとう！', 50, '2026-07-15T09:00:00Z'),
  (2, 13, 5, '問い合わせの技術調査に即日対応してくれてありがとうございます', 30, '2026-07-22T05:00:00Z'),
  (3, 5, 3, '入社手続きの案内が丁寧で安心できました', 20, '2026-07-01T03:00:00Z'),
  (4, 2, 16, '会議室のダブルブッキングをすぐ調整してくれてありがとうございます', 10, '2026-07-30T02:00:00Z'),
  (5, 9, 13, '顧客対応の引き継ぎが完璧でした。ありがとう！', 30, '2026-08-03T08:00:00Z');

-- 今月分の贈与原資（granted − consumed が残量）。
INSERT INTO thanks_point_budgets (id, employee_id, period, granted_points, consumed_points, created_at) VALUES
  (1, 2, '2026-08', 100, 0, '2026-08-01T00:00:00Z'),
  (2, 4, '2026-08', 100, 0, '2026-08-01T00:00:00Z'),
  (3, 5, '2026-08', 100, 0, '2026-08-01T00:00:00Z'),
  (4, 9, '2026-08', 100, 30, '2026-08-01T00:00:00Z'),
  (5, 13, '2026-08', 100, 0, '2026-08-01T00:00:00Z');

INSERT INTO thanks_rewards (id, name, point_cost, is_active, stock, created_at) VALUES
  (1, 'コーヒーチケット', 30, 1, NULL, '2026-01-05T00:00:00Z'),
  (2, '書籍購入補助（1冊）', 60, 1, 20, '2026-01-05T00:00:00Z'),
  (3, 'ランチ補助券', 80, 1, 10, '2026-01-05T00:00:00Z'),
  (4, '旧・ノベルティセット', 40, 0, 0, '2026-01-05T00:00:00Z');

-- E005 は受領 80pt に対し 30pt の交換を申請中（pending。inbox で未決裁 1 件になる）。
INSERT INTO thanks_redemptions (id, employee_id, reward_id, point_cost, status, created_at, decided_at, decider_id) VALUES
  (1, 5, 1, 30, 'pending', '2026-08-04T01:00:00Z', NULL, NULL),
  (2, 3, 1, 30, 'fulfilled', '2026-07-10T01:00:00Z', '2026-07-11T01:00:00Z', 16),
  (3, 16, 3, 80, 'rejected', '2026-07-20T01:00:00Z', '2026-07-21T01:00:00Z', 2);
