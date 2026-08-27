/** アナウンスの状態。draft=下書き, published=公開, archived=アーカイブ。 */
export type AnnouncementStatus = "draft" | "published" | "archived"

/** GET /announcements の各要素（API は snake_case で返す）。 */
export type AnnouncementListItem = {
  id: number
  title: string
  status: string
  published_on: string | null
  author_employee_id: string
  created_at: string
}

/** GET /announcements/:id の詳細（本文を含む）。 */
export type AnnouncementResponse = {
  id: number
  title: string
  body_md: string
  status: string
  published_on: string | null
  author_employee_id: string
  created_at: string
}

/** POST /announcements のリクエスト body。 */
export type AnnouncementCreateRequest = {
  title: string
  body_md: string
}
