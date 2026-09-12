-- 移行元の人事注記を保全するローカル検証用データ。確定した発令とは区別する。

INSERT INTO company_personnel_annotations
  (id, employee_id, kind, effective_date, from_department_code, to_department_code, note, created_at)
VALUES
  (1, 5, 'join', '2024-04-01', NULL, 'D003', '新卒入社', '2024-04-01T00:00:00.000Z'),
  (2, 5, 'transfer', '2025-10-01', 'D003', 'D003', 'チーム異動', '2025-10-01T00:00:00.000Z'),
  (3, 9, 'join', '2023-04-01', NULL, 'D004', NULL, '2023-04-01T00:00:00.000Z');
