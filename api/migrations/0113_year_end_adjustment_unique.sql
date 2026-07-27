-- 同一社員・同一年度の年末調整二重申告を防ぐ UNIQUE 制約を追加する。
CREATE UNIQUE INDEX IF NOT EXISTS uq_yea_employee_year ON year_end_adjustments (employee_id, target_year);
