-- application ドメインの seed
-- 対象テーブル: application_templates, applications, application_approvals
-- employees / departments は他ドメイン（employee / org）が seed するため含めない。

INSERT INTO application_templates (id, code, name, category, description, schema_json, approver_roles) VALUES
  (1, 'paid_leave', 'Paid Leave Request', 'attendance', 'Request for paid leave', '{"type":"object","properties":{"start_date":{"type":"string","format":"date"},"end_date":{"type":"string","format":"date"},"reason":{"type":"string"}},"required":["start_date","end_date"]}', '["manager","root"]'),
  (2, 'expense', 'Expense Reimbursement', 'accounting', 'Request for reimbursement of paid expenses', '{"type":"object","properties":{"amount":{"type":"number"},"category":{"type":"string"},"note":{"type":"string"}},"required":["amount","category"]}', '["manager","root"]'),
  (3, 'remote_work', 'Remote Work Request', 'attendance', 'Advance request for remote work', '{"type":"object","properties":{"date":{"type":"string","format":"date"},"reason":{"type":"string"}},"required":["date"]}', '["manager"]'),
  (4, 'equipment', 'Equipment Purchase Request', 'general_affairs', 'Request to purchase work equipment', '{"type":"object","properties":{"item":{"type":"string"},"amount":{"type":"number"},"reason":{"type":"string"}},"required":["item","amount"]}', '["manager","root"]');

INSERT INTO application_requests (id, template_id, applicant_id, status, current_step, payload, created_at) VALUES
  (1, 1, 5, 'pending', 'manager_approval', '{"start_date":"2026-06-10","end_date":"2026-06-12","reason":"personal"}', '2026-05-20T01:00:00Z'),
  (2, 2, 9, 'pending', 'manager_approval', '{"amount":12000,"category":"transport","note":"client visit"}', '2026-05-22T02:30:00Z'),
  (3, 3, 10, 'approved', NULL, '{"date":"2026-05-15","reason":"focus work"}', '2026-05-10T00:00:00Z'),
  (4, 4, 13, 'rejected', NULL, '{"item":"monitor","amount":45000,"reason":"dual monitor setup"}', '2026-05-05T05:00:00Z'),
  (5, 1, 5, 'pending', 'manager_approval', '{"start_date":"2026-07-01","end_date":"2026-07-01","reason":"appointment"}', '2026-05-25T03:00:00Z');

INSERT INTO application_approvals (id, application_id, approver_id, action, comment, created_at) VALUES
  (1, 3, 4, 'approve', 'no issues', '2026-05-11T00:00:00Z'),
  (2, 4, 13, 'reject', 'over budget for this term', '2026-05-06T00:00:00Z');
