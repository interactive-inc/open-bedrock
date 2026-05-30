-- survey ドメインの seed
-- 対象テーブル: surveys, survey_responses
-- 値は src/infrastructure/seed/seed-surveys.ts / seed-survey-responses.ts と一致させる（テスト期待値と整合）。
-- employees / departments は他ドメイン（employee / org）が seed するため含めない。

INSERT INTO surveys (id, title, status, questions_json) VALUES
  (1, 'FY2026 Employee Engagement Survey', 'open', '[{"id":"q1","type":"scale","text":"I find my work rewarding","min":1,"max":5},{"id":"q2","type":"scale","text":"I have a good relationship with my manager","min":1,"max":5},{"id":"q3","type":"text","text":"Please share anything you would like us to improve"}]'),
  (2, 'Remote Work Satisfaction Survey', 'open', '[{"id":"q1","type":"scale","text":"I am satisfied with my home work environment","min":1,"max":5},{"id":"q2","type":"choice","text":"Preferred office attendance frequency","options":["0 days/week","1 day/week","2+ days/week"]}]'),
  (3, 'H2 FY2025 Retrospective Survey', 'closed', '[{"id":"q1","type":"scale","text":"I achieved my goals","min":1,"max":5}]');

INSERT INTO survey_responses (id, survey_id, respondent_id, answers_json, submitted_at) VALUES
  (1, 1, 5, '{"q1":4,"q2":5,"q3":"Nothing in particular"}', '2026-05-10T01:00:00Z'),
  (2, 1, 9, '{"q1":5,"q2":4,"q3":"Expand the remote work allowance"}', '2026-05-11T02:00:00Z'),
  (3, 1, 10, '{"q1":3,"q2":3,"q3":""}', '2026-05-12T03:00:00Z');
