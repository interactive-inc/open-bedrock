-- 休暇残数の消費量（按分計算後の日数）を記録する。半休=0.5、時間休=時間数/8、全休=days と同じ。
-- 既存行は全休のみのため、暦日数 days をそのまま初期値として引き継ぐ。
ALTER TABLE leave_requests ADD COLUMN consumed_days REAL;
UPDATE leave_requests SET consumed_days = days WHERE consumed_days IS NULL;
