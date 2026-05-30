-- 研修コース（コード・タイトル・カテゴリ・必須フラグ・状態）
CREATE TABLE IF NOT EXISTS training_courses (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER,
  category TEXT NOT NULL,
  is_required INTEGER NOT NULL,
  status TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_training_courses_code ON training_courses (code);

CREATE INDEX IF NOT EXISTS idx_training_courses_category ON training_courses (category);

-- 受講登録（社員ごとのコース受講状況・スコア・期限）
CREATE TABLE IF NOT EXISTS training_enrollments (
  id INTEGER PRIMARY KEY,
  course_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  completed_at TEXT,
  score INTEGER,
  due_date TEXT
);

CREATE INDEX IF NOT EXISTS idx_training_enrollments_employee ON training_enrollments (employee_id);

CREATE INDEX IF NOT EXISTS idx_training_enrollments_course ON training_enrollments (course_id);
