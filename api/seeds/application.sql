-- application ドメインの seed
-- 対象テーブル: application_templates, applications, application_approvals
-- employees / departments は他ドメイン（employee / org）が seed するため含めない。

INSERT INTO application_templates (id, code, name, category, description, schema_json, approver_roles) VALUES
  (1, 'paid_leave', '有給休暇申請', 'attendance', '有給休暇の取得を申請します', '{"fields":[{"id":"start_date","label":"開始日","type":"date","required":true,"description":null,"options":null},{"id":"end_date","label":"終了日","type":"date","required":true,"description":null,"options":null},{"id":"reason","label":"理由","type":"text","required":false,"description":null,"options":null}]}', '["manager","root"]'),
  (2, 'expense', '経費精算申請', 'accounting', '立て替えた経費の精算を申請します', '{"fields":[{"id":"amount","label":"金額","type":"number","required":true,"description":null,"options":null},{"id":"category","label":"内訳","type":"text","required":true,"description":null,"options":null},{"id":"note","label":"備考","type":"text","required":false,"description":null,"options":null}]}', '["manager","root"]'),
  (3, 'remote_work', '在宅勤務申請', 'attendance', '在宅勤務の事前申請をします', '{"fields":[{"id":"date","label":"対象日","type":"date","required":true,"description":null,"options":null},{"id":"reason","label":"理由","type":"text","required":false,"description":null,"options":null}]}', '["manager"]'),
  (4, 'equipment', '備品購入申請', 'general_affairs', '業務用備品の購入を申請します', '{"fields":[{"id":"item","label":"品目","type":"text","required":true,"description":null,"options":null},{"id":"amount","label":"金額","type":"number","required":true,"description":null,"options":null},{"id":"reason","label":"理由","type":"text","required":false,"description":null,"options":null}]}', '["manager","root"]');

INSERT INTO application_requests (id, template_id, applicant_id, status, current_step, payload, created_at) VALUES
  (1, 1, 5, 'pending', 'manager_approval', '{"start_date":"2026-06-10","end_date":"2026-06-12","reason":"私用"}', '2026-05-20T01:00:00Z'),
  (2, 2, 9, 'pending', 'manager_approval', '{"amount":12000,"category":"transport","note":"取引先訪問"}', '2026-05-22T02:30:00Z'),
  (3, 3, 10, 'approved', NULL, '{"date":"2026-05-15","reason":"集中作業"}', '2026-05-10T00:00:00Z'),
  (4, 4, 13, 'rejected', NULL, '{"item":"モニター","amount":45000,"reason":"デュアルモニター環境構築"}', '2026-05-05T05:00:00Z'),
  (5, 1, 5, 'pending', 'manager_approval', '{"start_date":"2026-07-01","end_date":"2026-07-01","reason":"通院"}', '2026-05-25T03:00:00Z');

INSERT INTO application_approvals (id, application_id, approver_id, action, comment, created_at) VALUES
  (1, 3, 4, 'approve', '問題なし', '2026-05-11T00:00:00Z'),
  (2, 4, 13, 'reject', '今期の予算を超過しているため', '2026-05-06T00:00:00Z');
