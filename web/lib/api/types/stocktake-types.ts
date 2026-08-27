/** 棚卸しセッションの状態。open=実施中, closed=締め済み。 */
export type StocktakeStatus = "open" | "closed"

/** 棚卸し対象資産 1 件の確認状況。checked_at が null なら未確認。 */
export type StocktakeItemResponse = {
  asset_code: string
  asset_name: string
  kind: string
  checked_at: string | null
  checker_employee_id: string | null
  location_note: string | null
}

/** GET /stocktakes/:id の詳細（items を含む）。 */
export type StocktakeResponse = {
  id: string
  name: string
  target_date: string
  status: StocktakeStatus
  created_at: string
  closed_at: string | null
  checked_count: number
  total_count: number
  items: ReadonlyArray<StocktakeItemResponse>
}
