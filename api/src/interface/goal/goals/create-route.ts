import { CreateGoal } from "@/application/goal/create-goal"
import { factory } from "@/lib/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppGoal } from "@/lib/app-schemas"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { UnauthorizedError } from "@/interface/lib/errors"
import { z } from "zod"

// POST /goals — 認証された本人に紐づく目標を新規作成する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      period: z.string().min(1).max(100),
      title: z.string().min(1).max(500),
      weight: z.number().int().min(1).max(100).default(10),
      kpi: z.string().max(3_000).optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const goal = await new CreateGoal(c).run({
      employeeId: session.employeeId,
      period: json.period,
      title: json.title,
      kpi: json.kpi ?? null,
      weight: json.weight,
    })

    if (goal instanceof ApplicationError) {
      throw toHttpException(goal)
    }

    const responseBody = zAppGoal.parse({
      id: goal.id,
      employee_id: goal.employeeId,
      period: goal.period,
      title: goal.title,
      kpi: goal.kpi,
      weight: goal.weight,
      status: goal.status,
    })

    return c.json(responseBody, 201)
  },
)
