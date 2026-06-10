CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_swap_requests_pending
ON shift_swap_requests (requester_employee_id, target_employee_id, date)
WHERE status = 'pending';
