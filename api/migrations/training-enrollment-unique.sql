-- 同一研修コースに対する同一従業員の二重登録を DB レベルで防ぐ。
CREATE UNIQUE INDEX IF NOT EXISTS idx_training_enrollments_course_employee
  ON training_enrollments (course_id, employee_id);
