import { ListMyShiftSwapRequests } from "@/application/shift/list-my-shift-swap-requests"
import { factory } from "@/lib/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"

// GET /shift/swap-requests/me — 申請者本人が出したシフト交代申請の一覧
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const limit = toBoundedInt({
    raw: c.req.query("limit"),
    fallback: DEFAULT_LIST_LIMIT,
    min: 1,
    max: MAX_LIST_LIMIT,
  })

  const offset = toBoundedInt({
    raw: c.req.query("offset"),
    fallback: 0,
    min: 0,
    max: MAX_LIST_OFFSET,
  })

  const swapRequests = await new ListMyShiftSwapRequests(c).run({
    requesterEmployeeId: session.employeeId,
    limit,
    offset,
  })

  if (swapRequests instanceof Error) {
    throw new InternalError("failed to load swap requests")
  }

  const responseBody = swapRequests.map((swapRequest) => ({
    id: swapRequest.id,
    requester_employee_id: swapRequest.requesterEmployeeId,
    target_employee_id: swapRequest.targetEmployeeId,
    date: swapRequest.date,
    note: swapRequest.note,
    status: swapRequest.status,
    approved_at: swapRequest.approvedAt,
  }))

  return c.json(responseBody, 200)
})
