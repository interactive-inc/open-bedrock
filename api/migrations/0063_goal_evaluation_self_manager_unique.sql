-- self/manager 評価は同一目標に対して同一評価者が 1 回のみ。
-- final は既存の idx_goal_evaluations_goal_final で (goal_id) 単位のユニーク制約がある。
CREATE UNIQUE INDEX IF NOT EXISTS idx_goal_evaluations_evaluator_kind
ON goal_evaluations (goal_id, evaluator_id, kind)
WHERE kind IN ('self', 'manager');
