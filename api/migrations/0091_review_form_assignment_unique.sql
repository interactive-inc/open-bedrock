-- 評価サイクル開始処理の再実行や競合でも、同じ割当を重複作成しない。
CREATE UNIQUE INDEX IF NOT EXISTS uq_review_form_assignment
  ON review_forms (cycle_id, subject_employee_id, reviewer_employee_id, reviewer_type);
