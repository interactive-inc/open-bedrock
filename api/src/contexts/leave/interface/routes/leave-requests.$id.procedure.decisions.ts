import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { leaveProcedureDecisionTargetSchema } from "@/contexts/leave/domain/definitions/leave-procedure-decision-target.definition"
import { RecordLeaveDecision } from "@/contexts/leave/application/record-leave-decision"
import { CompleteApprovedLeaveProcedure } from "@/contexts/leave/application/complete-approved-leave-procedure"
import { CompleteRejectedLeaveProcedure } from "@/contexts/leave/application/complete-rejected-leave-procedure"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { UnauthorizedError } from "@/lib/http/errors"

// @authorization service - 確認した案件と現在の判断資格を照合し、最終判断を業務へ反映する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z
      .object({
        decision_target: leaveProcedureDecisionTargetSchema,
        action: z.enum(["approve", "reject"]),
        comment: z.string().max(3000).nullable(),
      })
      .strict(),
  ),
  async (c) => {
    const session = c.var.session
    if (session === null || c.var.accountTokenVersion === null) throw new UnauthorizedError()
    const body = c.req.valid("json")
    const leaveRequestId = validateIntParam(c.req.param("id"), "leave request")
    const at = new Date(c.env.NOW ?? Date.now())
    const saved = await new RecordLeaveDecision(c).run({
      leaveRequestId,
      session,
      tokenVersion: c.var.accountTokenVersion,
      decisionTarget: {
        proposalVersion: body.decision_target.proposal_version,
        proposalDigest: body.decision_target.proposal_digest,
        taskKey: body.decision_target.task_key,
        taskRound: body.decision_target.task_round,
      },
      action: body.action,
      comment: body.comment,
      decidedAt: at,
    })
    if (saved instanceof ApplicationError) throw toHttpException(saved)
    const completion = {
      leaveRequestId,
      session,
      tokenVersion: c.var.accountTokenVersion,
      completedAt: at,
    }
    if (saved.needsExecution && saved.status === "approved") {
      const completed = await new CompleteApprovedLeaveProcedure(c).run(completion)
      if (completed instanceof ApplicationError) throw toHttpException(completed)
    }
    if (saved.needsExecution && saved.status === "rejected") {
      const completed = await new CompleteRejectedLeaveProcedure(c).run(completion)
      if (completed instanceof ApplicationError) throw toHttpException(completed)
    }
    return c.json({ status: saved.status, replayed: saved.replayed }, 200)
  },
)
