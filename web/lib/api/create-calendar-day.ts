import { createClient } from "@/lib/api/hc-client"
import type { CalendarDayCreateRequest } from "@/lib/api/types/calendar-types"

/** POST /company-calendar-days。会社休日・振替出勤日を記録する（calendar:manage）。 */
export async function createCalendarDay(request: CalendarDayCreateRequest) {
  const client = await createClient()

  const response = await client["company-calendar"]["company-calendar-days"].$post({
    json: {
      calendar_date: request.calendar_date,
      kind: request.kind,
      name: request.name,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to create calendar day")
  }

  return response.json()
}
