-- approval-delegation ドメインの seed
-- 対象テーブル: approval_delegations
-- employees / accounts は他ドメイン（employee / iam）が seed するため含めない。

-- 一覧 API は自分が委任者か受任者の行しか返さないため、
-- 既定のログインユーザー E001（id=1）が当事者になる行を必ず含める。
-- 1 件は全テンプレート対象で有効中、1 件は経費のみ対象で終了済み、1 件は取消済み。
INSERT INTO approval_delegations (id, delegator_employee_id, delegate_employee_id, template_code, starts_at, ends_at, created_by_account_id, cancelled_at, created_at) VALUES
  (1, 1, 2, NULL, '2026-08-10T00:00:00Z', '2026-08-20T23:59:59Z', 1, NULL, '2026-08-01T02:00:00Z'),
  (2, 4, 1, 'expense', '2026-05-01T00:00:00Z', '2026-05-31T23:59:59Z', 4, NULL, '2026-04-25T02:00:00Z'),
  (3, 1, 16, NULL, '2026-09-01T00:00:00Z', '2026-09-30T23:59:59Z', 1, '2026-07-30T05:00:00Z', '2026-07-28T02:00:00Z');
