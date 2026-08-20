-- 経費と添付の対応。添付本体と復号鍵は system_attachments が持つ。
CREATE TABLE IF NOT EXISTS expense_attachments (
  expense_id INTEGER NOT NULL,
  attachment_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (expense_id, attachment_id)
);

CREATE INDEX IF NOT EXISTS idx_expense_attachments_expense
  ON expense_attachments (expense_id);
