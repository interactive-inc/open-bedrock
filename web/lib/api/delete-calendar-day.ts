import { createClient } from "@/lib/api/hc-client"

// DELETE /calendar/days/:id。会社カレンダーから 1 日を削除する（calendar:manage）。
export async function deleteCalendarDay(id: number) {
  const client = await createClient()

  const response = await client.calendar.days[":id"].$delete({
    param: { id: String(id) },
  })

  if (response.status !== 204) {
    return new Error("failed to delete calendar day")
  }

  return null
}
