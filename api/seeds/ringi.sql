-- ringi ドメインの seed
-- 稟議（未決2件・承認済み1件。未決は承認者の inbox に出る）
-- 値は src/infrastructure/seed/seed-ringi-requests.ts と一致させること。

INSERT INTO ringi_requests (id, applicant_id, approver_id, title, amount, reason, status, decided_at, decision_comment, created_at) VALUES
  (1, 5, 4, '新しいCIベンダーとの契約', 240000, 'チームのビルド高速化のため', 'pending', NULL, NULL, '2026-05-11T01:00:00Z'),
  (2, 5, 4, 'カンファレンス協賛', 500000, 'ブランド露出のため', 'approved', '2026-05-13T02:00:00Z', '予算内のため承認', '2026-05-12T02:00:00Z'),
  (3, 10, 9, 'CRMの追加ライセンス', 120000, '営業チームの増員のため', 'pending', NULL, NULL, '2026-05-14T03:00:00Z');
