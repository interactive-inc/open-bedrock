-- survey ドメインの seed
-- 対象テーブル: surveys, survey_responses
-- 値は src/infrastructure/seed/seed-surveys.ts / seed-survey-responses.ts と一致させる（テスト期待値と整合）。
-- employees / departments は他ドメイン（employee / org）が seed するため含めない。

INSERT INTO surveys (id, title, status, questions_json) VALUES
  (1, '2026年度 従業員エンゲージメント調査', 'open', '[{"id":"q1","type":"scale","text":"仕事にやりがいを感じている","min":1,"max":5},{"id":"q2","type":"scale","text":"上司と良好な関係を築けている","min":1,"max":5},{"id":"q3","type":"text","text":"改善してほしい点があれば教えてください"}]'),
  (2, 'リモートワーク満足度調査', 'open', '[{"id":"q1","type":"scale","text":"自宅の労働環境に満足している","min":1,"max":5},{"id":"q2","type":"choice","text":"希望する出社頻度","options":["週0日","週1日","週2日以上"]}]'),
  (3, '2025年度下期 振り返り調査', 'closed', '[{"id":"q1","type":"scale","text":"目標を達成できた","min":1,"max":5}]');

INSERT INTO survey_responses (id, survey_id, respondent_id, answers_json, submitted_at) VALUES
  (1, 1, 5, '{"q1":4,"q2":5,"q3":"特にありません"}', '2026-05-10T01:00:00Z'),
  (2, 1, 9, '{"q1":5,"q2":4,"q3":"リモートワーク手当を拡充してほしい"}', '2026-05-11T02:00:00Z'),
  (3, 1, 10, '{"q1":3,"q2":3,"q3":""}', '2026-05-12T03:00:00Z');
