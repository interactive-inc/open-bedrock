import { createClient } from "@/lib/api/hc-client"

/** GET /company-calendar-days。指定年の会社カレンダー（会社休日・振替出勤日）一覧を取得する。誰でも参照できる。 */
export async function getCalendar(year: string | null) {
  const client = await createClient()

  const response = await client["company-calendar-days"].$get({
    query: { year: year ?? undefined },
  })

  if (response.status >= 400) {
    return new Error("failed to load calendar")
  }

  const body = await response.json()

  return body.data
}
