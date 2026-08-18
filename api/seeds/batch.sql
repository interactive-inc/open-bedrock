-- batch ドメインの seed
-- バッチジョブの実行状況（夜間同期・通知送信などの記録）。
-- 値は src/infrastructure/seed/seed-batch-jobs.ts に一致させること。

INSERT INTO system_batch_jobs (id, name, status, started_at, finished_at, message) VALUES
(1, '従業員データ夜間同期', 'completed', 1780077600000, 1780077900000, '20件のレコードを同期しました'),
(2, '目標リマインド通知', 'completed', 1780012800000, 1780012860000, '8件の通知を送信しました'),
(3, 'サーベイ集計バッチ', 'running', 1780045200000, NULL, NULL),
(4, '勤怠データ取込', 'failed', 1779998400000, 1779998520000, '元ファイルが見つかりません');
