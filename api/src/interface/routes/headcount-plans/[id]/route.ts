import { UpdateHeadcountPlan } from "@/application/headcount-plan/update-headcount-plan"
import { factory } from "@/interface/utils/factory"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppHeadcountPlan } from "@/lib/app-schemas"
import { validateIntParam } from "@/interface/utils/validate-int-param"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/** PUT /headcount-plans/:id — 計画人数・備考を更新（headcount_plan:manage）。年度・部署は変えない。 */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      planned_count: z.number().int().min(0),
      note: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const updated = await new UpdateHeadcountPlan(c).run({
      session,
      id: validateIntParam(c.req.param("id"), "headcount plan"),
      plannedCount: json.planned_count,
      note: json.note ?? null,
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    const responseBody = zAppHeadcountPlan.parse({
      id: updated.id,
      fiscal_year: updated.fiscalYear,
      department_code: updated.departmentCode,
      planned_count: updated.plannedCount,
      actual_count: 0,
      note: updated.note,
      created_at: updated.createdAt,
    })

    return c.json(responseBody, 200)
  },
)
