-- ナレッジ記事（社内手続き・規程などの記事）
CREATE TABLE IF NOT EXISTS knowledge_articles (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT,
  body_md TEXT NOT NULL,
  author_id INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_articles_category ON knowledge_articles (category);
