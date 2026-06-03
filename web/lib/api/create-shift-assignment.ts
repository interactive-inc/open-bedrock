import { createClient } from "@/lib/api/hc-client"
import type {
  ShiftAssignmentCreateRequest,
  ShiftAssignmentResponse,
} from "@/lib/api/types/shift-types"

// POST /shift/assignments。特権ロールが社員にシフトを割り当てる。
export async function createShiftAssignment(
  request: ShiftAssignmentCreateRequest,
): Promise<ShiftAssignmentResponse | Error> {
  const client = await createClient()

  const response = await client.shift.assignments.$post({
    json: {
      employee_code: request.employee_code,
      pattern_code: request.pattern_code,
      date: request.date,
      note: request.note ?? undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to create shift assignment")
  }

  return response.json()
}
