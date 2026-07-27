-- 人事変更申請は固定 binding と固定 completion handler を持ち、表示と宣言的 workflow だけを変更可能にする。
INSERT OR IGNORE INTO application_templates
  (id, code, name, category, description, schema_json, approver_roles,
   system_binding, completion_handler_key)
VALUES
  (900000001, 'personnel_action_request', 'Personnel Action Request', 'employee',
   'Request an effective-dated employee lifecycle change.',
   '{"type":"object","additionalProperties":false}', '["hr"]',
   'personnel_action', 'personnel_action');

INSERT OR IGNORE INTO application_workflows
  (template_id, definition_json, updated_at, revision, updated_by_account_id)
SELECT id,
       '{"version":1,"steps":[{"key":"hr_approval","name":"HR approval","approvers":[{"type":"role","role_key":"hr"}],"approval_mode":"any","condition_mode":"all","conditions":[],"due_days":null,"escalation_approvers":[],"rejection_behavior":"reject","allow_delegation":true}]}',
       '2026-01-01T00:00:00.000Z', 1, NULL
FROM application_templates WHERE system_binding = 'personnel_action';

INSERT OR IGNORE INTO application_workflow_revisions
  (template_id, revision, definition_json, updated_by_account_id, created_at)
SELECT template_id, revision, definition_json, updated_by_account_id, updated_at
FROM application_workflows
WHERE template_id = (
  SELECT id FROM application_templates WHERE system_binding = 'personnel_action'
);
