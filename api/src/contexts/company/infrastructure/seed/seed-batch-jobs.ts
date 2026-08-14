type SeedBatchJob = {
  id: number
  name: string
  status: "running" | "completed" | "failed"
  startedAt: string | null
  finishedAt: string | null
  message: string | null
}

export const seedBatchJobs: ReadonlyArray<SeedBatchJob> = [
  {
    id: 1,
    name: "従業員データ夜間同期",
    status: "completed",
    startedAt: "2026-05-29T18:00:00Z",
    finishedAt: "2026-05-29T18:05:00Z",
    message: "20件のレコードを同期しました",
  },
  {
    id: 2,
    name: "目標リマインド通知",
    status: "completed",
    startedAt: "2026-05-29T00:00:00Z",
    finishedAt: "2026-05-29T00:01:00Z",
    message: "8件の通知を送信しました",
  },
  {
    id: 3,
    name: "サーベイ集計バッチ",
    status: "running",
    startedAt: "2026-05-29T09:00:00Z",
    finishedAt: null,
    message: null,
  },
  {
    id: 4,
    name: "勤怠データ取込",
    status: "failed",
    startedAt: "2026-05-28T20:00:00Z",
    finishedAt: "2026-05-28T20:02:00Z",
    message: "元ファイルが見つかりません",
  },
]
