-- サンクスポイント制度。月次の贈与原資・交換カタログ・交換申請の3テーブル。
-- 受領残高は専用列を持たず「受領 thanks.points 合計 − 確定交換 point_cost 合計」で算出する。

-- 月次の贈与原資。employee_id + period(YYYY-MM) で一意。残量は保存せず算出する。
CREATE TABLE IF NOT EXISTS thanks_point_budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  period TEXT NOT NULL,
  granted_points INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_thanks_point_budgets_employee_period
  ON thanks_point_budgets (employee_id, period);

-- 交換カタログ。stock が NULL は在庫無制限。is_active は 0/1。
CREATE TABLE IF NOT EXISTS thanks_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  point_cost INTEGER NOT NULL,
  is_active INTEGER NOT NULL,
  stock INTEGER,
  created_at TEXT NOT NULL
);

-- 交換申請。申請→承認→確定の状態遷移を status で持つ。
CREATE TABLE IF NOT EXISTS thanks_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  reward_id INTEGER NOT NULL,
  point_cost INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  decided_at TEXT,
  decider_id INTEGER
);

CREATE INDEX IF NOT EXISTS idx_thanks_redemptions_employee ON thanks_redemptions (employee_id);

CREATE INDEX IF NOT EXISTS idx_thanks_redemptions_status ON thanks_redemptions (status);
