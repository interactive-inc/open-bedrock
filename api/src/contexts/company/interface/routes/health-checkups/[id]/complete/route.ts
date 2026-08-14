import { CompleteHealthCheckup } from "@/contexts/company/application/health-checkup/complete-health-checkup"
import { factory } from "@/contexts/company/interface/utils/factory"
import { isoDate } from "@/lib/schemas"
import { zAppHealthCheckup } from "@/lib/app-schemas"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import {
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
} from "@/contexts/company/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission - 権限キーで判定する
/** POST /health-checkups/:id/complete — 実施記録を完了にし実施日を記録する。health_checkup:manage が必要。 */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator("json", z.object({ conducted_on: isoDate })),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (session.hasPermission("health_checkup:manage") === false) {
      throw new ForbiddenError()
    }

    const id = Number(c.req.param("id"))

    if (Number.isInteger(id) === false) {
      throw new BadRequestError("invalid parameter")
    }

    const json = c.req.valid("json")

    const record = await new CompleteHealthCheckup(c).run({ id, conductedOn: json.conducted_on })

    if (record instanceof Error) {
      throw toHttpException(record)
    }

    const responseBody = zAppHealthCheckup.parse({
      id: record.id,
      employee_id: record.employeeId,
      fiscal_year: record.fiscalYear,
      checkup_kind: record.checkupKind,
      conducted_on: record.conductedOn,
      status: record.status,
      note: record.note,
      created_at: record.createdAt,
    })

    return c.json(responseBody, 200)
  },
)
