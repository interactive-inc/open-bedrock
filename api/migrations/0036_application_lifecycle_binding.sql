-- application.sql より後に適用し、既存の申請テンプレートを壊さず system binding を追加する。
ALTER TABLE application_templates ADD COLUMN system_binding TEXT
  CHECK (system_binding IS NULL OR length(system_binding) BETWEEN 1 AND 100);
ALTER TABLE application_templates ADD COLUMN completion_handler_key TEXT
  CHECK (completion_handler_key IS NULL OR completion_handler_key = 'personnel_action');

CREATE UNIQUE INDEX uq_application_templates_system_binding
  ON application_templates (system_binding)
  WHERE system_binding IS NOT NULL;
