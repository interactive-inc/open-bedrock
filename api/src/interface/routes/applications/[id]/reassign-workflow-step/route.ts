import { ReassignWorkflowStep } from "@/application/application/reassign-workflow-step"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { validateIntParam } from "@/interface/utils/validate-int-param"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { factory } from "@/lib/factory"
import { ApplicationError } from "@/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

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
    const result = await new ReassignWorkflowStep(c).run({
      session,
      applicationId: validateIntParam(c.req.param("id"), "application"),
      candidateEmployeeIds: body.candidate_employee_ids,
      requiredApprovals: body.required_approvals,
      reason: body.reason,
      reassignedAt: c.env.NOW ?? new Date().toISOString(),
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
