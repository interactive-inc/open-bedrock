-- #330 頻出クエリ向けインデックスの追加

-- room_reservations.reserver_id（GET /rooms/reservations/me で使用）
CREATE INDEX IF NOT EXISTS idx_room_reservations_reserver ON room_reservations (reserver_id);

-- notifications (recipient_employee_id) WHERE is_read = 0（未読カウントのポーリングで使用）
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread ON notifications (recipient_employee_id) WHERE is_read = 0;

-- shift_assignments.pattern_id（パターン削除時の参照チェックで使用）
CREATE INDEX IF NOT EXISTS idx_shift_assignments_pattern ON shift_assignments (pattern_id);
