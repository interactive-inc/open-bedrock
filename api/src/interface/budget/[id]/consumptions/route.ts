import { RecordBudgetConsumption } from "@/application/budget/record-budget-consumption"
import { factory } from "@/lib/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppBudgetConsumption } from "@/lib/app-schemas"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { validateIntParam } from "@/interface/shared/validate-int-param"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"
import { isoDate } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// POST /budgets/:id/consumptions — 予算枠の消化を手動記録（budget:manage）
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      amount: z.number().int().nonnegative(),
      recorded_on: isoDate,
      note: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const created = await new RecordBudgetConsumption(c).run({
      session,
      budgetId: validateIntParam(c.req.param("id"), "budget"),
      amount: json.amount,
      note: json.note ?? null,
      recordedOn: json.recorded_on,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppBudgetConsumption.parse({
      id: created.id,
      budget_id: created.budgetId,
      amount: created.amount,
      note: created.note,
      recorded_on: created.recordedOn,
      created_at: created.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
