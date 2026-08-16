import { reassignSystemApplicationTask } from "@/api/routes/application-requests/lib/system-application-operation"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { validateIntParam } from "@/contexts/company/interface/utils/validate-int-param"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { factory } from "@/contexts/company/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      candidate_employee_ids: z.array(z.number().int().positive()).min(1).max(20),
      required_approvals: z.number().int().positive().max(20).optional(),
      reason: z.string().trim().min(1).max(1_000),
    }),
  ),
  async (c) => {
    const session = c.var.session
    if (session === null) throw new UnauthorizedError()

    const body = c.req.valid("json")
    const result = await reassignSystemApplicationTask(c, {
      number: validateIntParam(c.req.param("id"), "application"),
      candidateEmployeeIds: body.candidate_employee_ids,
      requiredApprovals: body.required_approvals,
      reason: body.reason,
      reassignedAt: new Date(c.env.NOW ?? Date.now()),
    })

    if (result instanceof ApplicationError) throw toHttpException(result)

    return c.json(
      {
        status: result.status,
        step_key: result.stepKey,
        round: result.round,
        candidate_employee_ids: result.candidateEmployeeIds,
      },
      200,
    )
  },
)
