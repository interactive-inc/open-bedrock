-- 評価サイクル（多面評価の実施単位・期間・状態）
CREATE TABLE IF NOT EXISTS review_cycles (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  period TEXT NOT NULL,
  status TEXT NOT NULL,
  due_date TEXT
);

CREATE INDEX IF NOT EXISTS idx_review_cycles_status ON review_cycles (status);

-- 評価フォーム（サイクル・被評価者・評価者ごとの回答とスコア・状態）
CREATE TABLE IF NOT EXISTS review_forms (
  id INTEGER PRIMARY KEY,
  cycle_id INTEGER NOT NULL,
  subject_employee_id INTEGER NOT NULL,
  reviewer_employee_id INTEGER NOT NULL,
  reviewer_type TEXT NOT NULL,
  answers TEXT NOT NULL,
  score INTEGER,
  status TEXT NOT NULL,
  submitted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_review_forms_reviewer ON review_forms (reviewer_employee_id);

CREATE INDEX IF NOT EXISTS idx_review_forms_cycle_subject ON review_forms (cycle_id, subject_employee_id);
