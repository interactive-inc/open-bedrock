-- Move reusable procedure definitions into System without inventing a human author.
-- The credential-less migration account is a technical actor and cannot sign in.

INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
VALUES ('system:migration', 'active', 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO system_procedure_definitions
  (key, current_revision, status, created_at, updated_at)
SELECT
  template.code,
  coalesce(workflow.revision, 1),
  'active',
  coalesce(CAST(strftime('%s', workflow.updated_at) AS INTEGER) * 1000, 0),
  coalesce(CAST(strftime('%s', workflow.updated_at) AS INTEGER) * 1000, 0)
FROM application_templates AS template
LEFT JOIN application_workflows AS workflow ON workflow.template_id = template.id;

INSERT INTO system_procedure_numbers (number, procedure_key)
SELECT id, code FROM application_templates;

INSERT INTO system_procedure_definition_revisions
  (procedure_key, revision, title, category, description, input_schema_json,
   decision_policy_json, completion_operation_key, created_by_account_id, created_at)
SELECT
  template.code,
  coalesce(workflow.revision, 1),
  template.name,
  template.category,
  template.description,
  template.schema_json,
  json_object(
    'schemaVersion', 1,
    'qualificationContext', 'company',
    'approverRoles', json(template.approver_roles),
    'workflow', CASE
      WHEN workflow.definition_json IS NULL THEN NULL
      ELSE json(workflow.definition_json)
    END,
    'workflowRevision', coalesce(workflow.revision, 0)
  ),
  CASE template.completion_handler_key
    WHEN 'personnel_action' THEN 'company.personnel-action.apply'
    ELSE NULL
  END,
  coalesce(workflow.updated_by_account_id, 'system:migration'),
  coalesce(CAST(strftime('%s', workflow.updated_at) AS INTEGER) * 1000, 0)
FROM application_templates AS template
LEFT JOIN application_workflows AS workflow ON workflow.template_id = template.id;

CREATE TABLE system_procedure_definition_backfill_guard (
  incomplete_count INTEGER NOT NULL CHECK (incomplete_count = 0)
);

INSERT INTO system_procedure_definition_backfill_guard (incomplete_count)
SELECT
  ((SELECT count(*) FROM application_templates)
    <> (SELECT count(*) FROM system_procedure_definitions))
  + ((SELECT count(*) FROM application_templates)
    <> (SELECT count(*) FROM system_procedure_definition_revisions))
  + ((SELECT count(*) FROM application_templates)
    <> (SELECT count(*) FROM system_procedure_numbers));

DROP TABLE system_procedure_definition_backfill_guard;
