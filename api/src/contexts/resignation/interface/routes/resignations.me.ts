import { ResignationRepository } from "@/contexts/resignation/infrastructure/repositories/resignation.repository"
import { UnexpectedError } from "@/lib/errors"

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
import { zAppResignationList } from "@/lib/app-schemas"
import { resignations } from "@/contexts/resignation/infrastructure/schema/resignation"
import { count, eq } from "drizzle-orm"

// @authorization owner - 本人のリソースに限定する
/** GET /resignations/me — 申請者本人の退職申請一覧 */
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

  const resignationRows = await (async () => {
    const command = {
      employeeId: viewer.employeeId,
      limit,
      offset,
    }

    const resignationRepository = new ResignationRepository(c)

    const resignations = await resignationRepository.findByEmployeeId({
      employeeId: command.employeeId,
      limit: command.limit,
      offset: command.offset,
    })

    if (resignations instanceof Error) {
      return new UnexpectedError("failed to find resignations", { cause: resignations })
    }

    return resignations
  })()

  if (resignationRows instanceof ApplicationError) {
    throw toHttpException(resignationRows)
  }

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(resignations)
    .where(eq(resignations.employeeId, viewer.employeeId))

  const responseBody = zAppResignationList.parse({
    data: resignationRows.map((resignation) => ({
      id: resignation.id,
      employee_id: resignation.employeeId,
      resignation_date: resignation.resignationDate,
      last_working_date: resignation.lastWorkingDate,
      reason: resignation.reason,
      status: resignation.status,
      created_at: resignation.createdAt,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
