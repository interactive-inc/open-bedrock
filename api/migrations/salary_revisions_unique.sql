CREATE UNIQUE INDEX IF NOT EXISTS uq_salary_revisions_employee_date ON salary_revisions (employee_id, effective_date);
