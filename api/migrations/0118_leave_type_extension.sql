-- 休暇種別を拡張し、有休の取得単位（全休/半休/時間休）を記録できるようにする。
ALTER TABLE leave_requests ADD COLUMN unit TEXT NOT NULL DEFAULT 'full_day';
ALTER TABLE leave_requests ADD COLUMN hours REAL;
