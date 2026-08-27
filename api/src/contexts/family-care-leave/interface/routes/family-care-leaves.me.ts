import { UnexpectedError } from "@/lib/errors"
import { FamilyCareLeaveRepository } from "@/contexts/family-care-leave/infrastructure/repositories/family-care-leave.repository"

import { factory } from "@/api/http/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { verifyBearer } from "@/api/http/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { zAppFamilyCareLeaveList } from "@/lib/app-schemas"
import { familyCareLeaves } from "@/contexts/family-care-leave/infrastructure/schema/family-care-leave"
import { count, eq } from "drizzle-orm"

// @authorization owner - 本人のリソースに限定する
/** GET /family-care-leaves/me — 申出者本人の休業申出一覧 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
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

  const familyCareLeaveRows = await (async () => {
    const command = {
      employeeId: viewer.employeeId,
      limit,
      offset,
    }

    const familyCareLeaveRepository = new FamilyCareLeaveRepository(c)

    const familyCareLeaves = await familyCareLeaveRepository.findByEmployeeId({
      employeeId: command.employeeId,
      limit: command.limit,
      offset: command.offset,
    })

    if (familyCareLeaves instanceof Error) {
      return new UnexpectedError("failed to find family care leaves", { cause: familyCareLeaves })
    }

    return familyCareLeaves
  })()

  if (familyCareLeaveRows instanceof ApplicationError) {
    throw toHttpException(familyCareLeaveRows)
  }

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(familyCareLeaves)
    .where(eq(familyCareLeaves.employeeId, viewer.employeeId))

  const responseBody = zAppFamilyCareLeaveList.parse({
    data: familyCareLeaveRows.map((familyCareLeave) => ({
      id: familyCareLeave.id,
      employee_id: familyCareLeave.employeeId,
      leave_kind: familyCareLeave.leaveKind,
      start_date: familyCareLeave.startDate,
      end_date: familyCareLeave.endDate,
      note: familyCareLeave.note,
      status: familyCareLeave.status,
      created_at: familyCareLeave.createdAt,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
