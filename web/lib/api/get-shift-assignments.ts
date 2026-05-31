import { createClient } from "@/lib/api/hc-client"
import type { ShiftAssignmentResponse } from "@/lib/api/types/shift-types"

type Props = {
  from: string | null
  to: string | null
  deptCode: string | null
}

// GET /shift/assignments。特権ロールが部署単位でシフトを横断検索する。
export async function getShiftAssignments(
  props: Props,
): Promise<Array<ShiftAssignmentResponse> | Error> {
  const client = await createClient()

  const response = await client.shift.assignments.$get({
    query: {
      from: props.from ?? undefined,
      to: props.to ?? undefined,
      dept_code: props.deptCode ?? undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load shift assignments")
  }

  return response.json()
}
