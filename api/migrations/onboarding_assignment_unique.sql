CREATE UNIQUE INDEX IF NOT EXISTS uq_onboarding_assignments_employee_template
ON onboarding_assignments (employee_id, template_code)
WHERE status != 'completed';
