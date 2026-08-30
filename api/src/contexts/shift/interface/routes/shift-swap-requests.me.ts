import { UnexpectedError } from "@/lib/errors"
import { ShiftSwapRequestRepository } from "@/contexts/shift/infrastructure/repositories/shift-swap-request.repository"

import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { zAppMyShiftSwapRequestList } from "@/contexts/shift/interface/http/response-schemas"
import { factory } from "@/api/http/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { verifyBearer } from "@/api/http/verify-bearer"
import { UnauthorizedError } from "@/lib/http/errors"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import { shiftSwapRequests } from "@/contexts/shift/infrastructure/schema/shift"
import { count, eq, inArray } from "drizzle-orm"

// @authorization owner - 本人のリソースに限定する
/**
 * GET /shift-swap-requests/me — 申請者本人が出したシフト交代申請の一覧。
 * member は社員 ID から氏名を引けないため、交代相手の氏名を埋めて返す。
 */
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

  const swapRequests = await (async () => {
    const input = {
      requesterEmployeeId: session.employeeId,
      limit,
      offset,
    }

    const swapRequestRepository = new ShiftSwapRequestRepository(c)

    const swapRequests = await swapRequestRepository.findByRequesterId({
      requesterEmployeeId: input.requesterEmployeeId,
      limit: input.limit,
      offset: input.offset,
    })

    if (swapRequests instanceof Error) {
      return new UnexpectedError("failed to find shift swap requests", { cause: swapRequests })
    }

    return swapRequests
  })()

  if (swapRequests instanceof ApplicationError) {
    throw toHttpException(swapRequests)
  }

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(shiftSwapRequests)
    .where(eq(shiftSwapRequests.requesterEmployeeId, session.employeeId))

  const targetEmployeeIds = swapRequests.map((swapRequest) => swapRequest.targetEmployeeId)

  const employeeRows =
    targetEmployeeIds.length === 0
      ? []
      : await c.var.database
          .select({ id: employees.id, name: employees.officialName })
          .from(employees)
          .where(inArray(employees.id, targetEmployeeIds))

  const nameById = new Map(employeeRows.map((employee) => [employee.id, employee.name]))

  const responseBody = zAppMyShiftSwapRequestList.parse({
    data: swapRequests.map((swapRequest) => ({
      id: swapRequest.id,
      requester_employee_id: swapRequest.requesterEmployeeId,
      target_employee_id: swapRequest.targetEmployeeId,
      target_employee_name: nameById.get(swapRequest.targetEmployeeId) ?? null,
      date: swapRequest.date,
      note: swapRequest.note,
      status: swapRequest.status,
      approved_at: swapRequest.approvedAt,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
