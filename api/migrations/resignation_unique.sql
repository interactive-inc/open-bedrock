CREATE UNIQUE INDEX IF NOT EXISTS idx_resignations_employee_requested
ON resignations (employee_id)
WHERE status = 'requested';
