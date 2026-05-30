-- batch ドメインの seed
-- バッチジョブの実行状況（夜間同期・通知送信などの記録）。
-- 値は src/infrastructure/seed/seed-batch-jobs.ts に一致させること。

INSERT INTO batch_jobs (id, name, status, started_at, finished_at, message) VALUES
(1, 'Nightly employee data sync', 'completed', '2026-05-29T18:00:00Z', '2026-05-29T18:05:00Z', 'Synced 20 records'),
(2, 'Goal reminder notifications', 'completed', '2026-05-29T00:00:00Z', '2026-05-29T00:01:00Z', 'Sent 8 notifications'),
(3, 'Survey aggregation batch', 'running', '2026-05-29T09:00:00Z', NULL, NULL),
(4, 'Attendance data import', 'failed', '2026-05-28T20:00:00Z', '2026-05-28T20:02:00Z', 'Source file not found');
