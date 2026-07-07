-- 予算枠（会計年度・部署ごとの予算の事実記録）。金額は整数円で持つ。
-- 稟議・経費との自動連動はせず、消化は budget_consumptions への手動記録で表す。
-- 残額は「枠 amount − 消化合計」の単純減算で、会計計算や支払処理は持たない。
CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fiscal_year INTEGER NOT NULL,
  department_code TEXT,
  title TEXT NOT NULL,
  amount INTEGER NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_budgets_fiscal_year ON budgets (fiscal_year);

-- 予算枠の消化記録（枠に対して、いついくら使ったかの手動記録）。
CREATE TABLE IF NOT EXISTS budget_consumptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  budget_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  note TEXT,
  recorded_on TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_budget_consumptions_budget ON budget_consumptions (budget_id);
