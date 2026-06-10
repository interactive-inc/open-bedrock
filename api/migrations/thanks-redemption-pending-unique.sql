-- 同一社員に対して pending 状態の交換申請が複数存在しないことを DB レベルで保証する。
-- SQLite の部分インデックスを利用し、status = 'pending' の行に限って employee_id を一意にする。
CREATE UNIQUE INDEX IF NOT EXISTS idx_thanks_redemptions_employee_pending
  ON thanks_redemptions (employee_id) WHERE status = 'pending';
