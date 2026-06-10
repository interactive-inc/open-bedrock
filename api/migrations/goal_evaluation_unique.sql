CREATE UNIQUE INDEX IF NOT EXISTS idx_goal_evaluations_goal_final
ON goal_evaluations (goal_id)
WHERE kind = 'final';
