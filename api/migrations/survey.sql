-- アンケート（公開中/終了の調査と設問定義）
CREATE TABLE IF NOT EXISTS surveys (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  questions_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_surveys_status ON surveys (status);

-- アンケートへの回答（回答者ごとの提出と回答内容）
CREATE TABLE IF NOT EXISTS survey_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  survey_id INTEGER NOT NULL,
  respondent_id INTEGER NOT NULL,
  answers_json TEXT NOT NULL,
  submitted_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON survey_responses (survey_id);

CREATE INDEX IF NOT EXISTS idx_survey_responses_respondent ON survey_responses (respondent_id);
