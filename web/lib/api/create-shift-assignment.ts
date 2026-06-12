import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
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
    return toResponseError(response, {
      fallback: "シフトの割り当てに失敗しました",
      conflictMessages: {
        "shift assignment already exists for this employee and date":
          "この社員・日付のシフトは既に割り当てられています",
      },
    })
  }

  return response.json()
}
