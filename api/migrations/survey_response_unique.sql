-- 同一アンケートに対する同一回答者の二重回答を DB レベルで防ぐ。
CREATE UNIQUE INDEX IF NOT EXISTS idx_survey_responses_survey_respondent
  ON survey_responses (survey_id, respondent_id);
