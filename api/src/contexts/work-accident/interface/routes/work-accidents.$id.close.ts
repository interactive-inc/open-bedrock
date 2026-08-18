import { CloseWorkAccident } from "@/contexts/work-accident/application/close-work-accident"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { zAppWorkAccident } from "@/lib/app-schemas"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import {
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
} from "@/contexts/company-compatibility/interface/lib/errors"

// @authorization permission - 権限キーで判定する
/** POST /work-accidents/:id/close — 発生記録を closed にする。work_accident:manage が必要。 */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (session.hasPermission("work_accident:manage") === false) {
    throw new ForbiddenError()
  }

  const id = Number(c.req.param("id"))

  if (Number.isInteger(id) === false) {
    throw new BadRequestError("invalid parameter")
  }

  const record = await new CloseWorkAccident(c).run({ id })

  if (record instanceof Error) {
    throw toHttpException(record)
  }

  const responseBody = zAppWorkAccident.parse({
    id: record.id,
    occurred_on: record.occurredOn,
    employee_id: record.employeeId,
    location: record.location,
    summary: record.summary,
    severity: record.severity,
    status: record.status,
    created_at: record.createdAt,
  })

  return c.json(responseBody, 200)
})
