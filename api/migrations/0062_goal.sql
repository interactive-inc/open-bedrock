-- 目標（社員ごと・評価期間ごとの目標と重み・状態）
CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  period TEXT NOT NULL,
  title TEXT NOT NULL,
  kpi TEXT,
  weight INTEGER NOT NULL,
  status TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_goals_employee ON goals (employee_id);

CREATE INDEX IF NOT EXISTS idx_goals_period ON goals (period);

-- 目標への評価（自己・上長・最終）
CREATE TABLE IF NOT EXISTS goal_evaluations (
  id INTEGER PRIMARY KEY,
  goal_id INTEGER NOT NULL,
  evaluator_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  score INTEGER,
  comment TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_goal_evaluations_goal ON goal_evaluations (goal_id);
