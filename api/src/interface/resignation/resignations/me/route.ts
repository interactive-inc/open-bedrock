import { ListMyResignations } from "@/application/resignation/list-my-resignations"
import { factory } from "@/lib/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppResignationList } from "@/lib/app-schemas"
import { resignations } from "@/schema"
import { count, eq } from "drizzle-orm"

// GET /resignations/me — 申請者本人の退職申請一覧
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

  const resignationRows = await new ListMyResignations(c).run({
    employeeId: viewer.employeeId,
    limit,
    offset,
  })

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
      employee_id: String(resignation.employeeId),
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
