// GET /inbox/counts のレスポンス（受信箱ごとの未処理件数）。
export type InboxCounts = {
  applications: number
  expenses: number
  leaves: number
  shifts: number
  thanks: number
}
