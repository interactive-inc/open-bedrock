-- disciplinary ドメインの seed
-- 対象テーブル: disciplinary_actions
-- 非公開の記録（本人にも見せない設計）。判定は持たず事実の記録のみ。

INSERT INTO disciplinary_actions (id, employee_id, kind, summary, decided_on, created_at) VALUES
  (1, 18, '譴責', '経費の私的流用が確認されたため譴責処分とした', '2025-11-20', '2025-11-20T05:00:00Z'),
  (2, 10, '厳重注意', '社用データの私用端末への保存について厳重注意を行った', '2026-02-12', '2026-02-12T05:00:00Z');
