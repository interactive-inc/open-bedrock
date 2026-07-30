-- batch ドメインの seed
-- バッチジョブの実行状況（夜間同期・通知送信などの記録）。
-- 値は src/infrastructure/seed/seed-batch-jobs.ts に一致させること。

INSERT INTO batch_jobs (id, name, status, started_at, finished_at, message) VALUES
(1, '従業員データ夜間同期', 'completed', '2026-05-29T18:00:00Z', '2026-05-29T18:05:00Z', '20件のレコードを同期しました'),
(2, '目標リマインド通知', 'completed', '2026-05-29T00:00:00Z', '2026-05-29T00:01:00Z', '8件の通知を送信しました'),
(3, 'サーベイ集計バッチ', 'running', '2026-05-29T09:00:00Z', NULL, NULL),
(4, '勤怠データ取込', 'failed', '2026-05-28T20:00:00Z', '2026-05-28T20:02:00Z', '元ファイルが見つかりません');
