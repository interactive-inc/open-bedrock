-- 会議室マスタ（定員・所在地）
CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  location TEXT
);

CREATE INDEX IF NOT EXISTS idx_rooms_capacity ON rooms (capacity);

-- 会議室予約（重複判定は start_at/end_at の範囲で行う）
CREATE TABLE IF NOT EXISTS room_reservations (
  id TEXT PRIMARY KEY,
  room_id INTEGER NOT NULL,
  reserver_id INTEGER NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  purpose TEXT
);

CREATE INDEX IF NOT EXISTS idx_room_reservations_room ON room_reservations (room_id);
