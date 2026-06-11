CREATE INDEX IF NOT EXISTS idx_room_reservations_room_time ON room_reservations (room_id, start_at, end_at);
