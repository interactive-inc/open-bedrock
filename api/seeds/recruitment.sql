-- recruitment ドメインの seed
-- 対象テーブル: job_openings, recruitment_candidates
-- 候補者は社外の個人情報のため、氏名・メールは汎用のサンプル値のみを使う。

INSERT INTO job_openings (id, title, department_code, status, note, created_at) VALUES
  (1, 'バックエンドエンジニア', 'D003', 'open', '基盤強化のための増員', '2026-05-01T00:00:00Z'),
  (2, 'カスタマーサクセス', 'D005', 'open', NULL, '2026-06-01T00:00:00Z'),
  (3, '経理担当', 'D006', 'closed', '採用決定によりクローズ', '2025-11-01T00:00:00Z');

INSERT INTO recruitment_candidates (id, position_id, name, email, source, stage, note, created_at) VALUES
  (1, 1, '候補者 A', 'candidate-a@example.com', 'referral', 'interview', '一次面接通過。二次面接調整中', '2026-06-20T00:00:00Z'),
  (2, 1, '候補者 B', 'candidate-b@example.com', 'agent', 'screening', NULL, '2026-07-10T00:00:00Z'),
  (3, 1, '候補者 C', 'candidate-c@example.com', 'job_board', 'rejected', '経験領域が合わず見送り', '2026-06-01T00:00:00Z'),
  (4, 2, '候補者 D', 'candidate-d@example.com', 'referral', 'applied', NULL, '2026-07-28T00:00:00Z'),
  (5, 3, '候補者 E', 'candidate-e@example.com', 'agent', 'hired', '2026-01 入社で確定', '2025-11-15T00:00:00Z');
