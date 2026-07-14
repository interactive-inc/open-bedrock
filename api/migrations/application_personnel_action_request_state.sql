ALTER TABLE personnel_action_requests ADD COLUMN withdrawn_at INTEGER;
ALTER TABLE personnel_action_requests ADD COLUMN withdrawn_by_employee_id INTEGER;

CREATE INDEX idx_personnel_action_requests_target_created
  ON personnel_action_requests (target_employee_id, created_at DESC, id DESC);
