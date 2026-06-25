import { ListMyShiftSwapRequests } from "@/application/shift/list-my-shift-swap-requests"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppShiftSwapRequestList } from "@/lib/app-schemas"
import { factory } from "@/lib/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"
import { shiftSwapRequests } from "@/schema"
import { count, eq } from "drizzle-orm"

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

  if (swapRequests instanceof ApplicationError) {
    throw toHttpException(swapRequests)
  }

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(shiftSwapRequests)
    .where(eq(shiftSwapRequests.requesterEmployeeId, session.employeeId))

  const responseBody = zAppShiftSwapRequestList.parse({
    data: swapRequests.map((swapRequest) => ({
      id: swapRequest.id,
      requester_employee_id: swapRequest.requesterEmployeeId,
      target_employee_id: swapRequest.targetEmployeeId,
      date: swapRequest.date,
      note: swapRequest.note,
      status: swapRequest.status,
      approved_at: swapRequest.approvedAt,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
