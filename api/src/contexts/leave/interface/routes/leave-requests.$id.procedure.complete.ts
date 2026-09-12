import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { leaveProcedureDecisionTargetSchema } from "@/contexts/leave/domain/definitions/leave-procedure-decision-target.definition"
import { LeaveProcedureReadAdapter } from "@/contexts/leave/infrastructure/adapters/leave-procedure-read.adapter"
import { CompleteApprovedLeaveProcedure } from "@/contexts/leave/application/complete-approved-leave-procedure"
import { CompleteRejectedLeaveProcedure } from "@/contexts/leave/application/complete-rejected-leave-procedure"
import { ApplicationError, ConflictError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { UnauthorizedError } from "@/lib/http/errors"

// @authorization service - 確認済みの最終判断と現在の確定資格を照合する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator("json", z.object({ decision_target: leaveProcedureDecisionTargetSchema }).strict()),
  async (c) => {
    const session = c.var.session
    if (session === null || c.var.accountTokenVersion === null) throw new UnauthorizedError()
    const leaveRequestId = validateIntParam(c.req.param("id"), "leave request")
    const at = new Date(c.env.NOW ?? Date.now())
    const view = await new LeaveProcedureReadAdapter(c).find({
      leaveRequestId,
      session,
      tokenVersion: c.var.accountTokenVersion,
      at,
    })
    if (view instanceof ApplicationError) throw toHttpException(view)
    const target = c.req.valid("json").decision_target
    if (
      view.decision_target === null ||
      view.decision_target.proposal_version !== target.proposal_version ||
      view.decision_target.proposal_digest !== target.proposal_digest ||
      view.decision_target.task_key !== target.task_key ||
      view.decision_target.task_round !== target.task_round
    )
      throw toHttpException(
        new ConflictError("確認した判断対象が変わりました", "decision_target_changed"),
      )
    const command = {
      leaveRequestId,
      session,
      tokenVersion: c.var.accountTokenVersion,
      completedAt: at,
    }
    if (view.workflow_status === "approved" || view.workflow_status === "executed") {
      const saved = await new CompleteApprovedLeaveProcedure(c).run(command)
      if (saved instanceof ApplicationError) throw toHttpException(saved)
      return c.json(saved, 200)
    }
    if (view.workflow_status === "rejected") {
      const saved = await new CompleteRejectedLeaveProcedure(c).run(command)
      if (saved instanceof ApplicationError) throw toHttpException(saved)
      return c.json(saved, 200)
    }
    throw toHttpException(new ConflictError("判断が確定していません", "decision_pending"))
  },
)
