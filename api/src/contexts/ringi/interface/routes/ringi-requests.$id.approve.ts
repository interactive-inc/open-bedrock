import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { UnauthorizedError } from "@/lib/http/errors"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { RecordRingiDecision } from "@/contexts/ringi/application/record-ringi-decision"
import { CompleteApprovedRingiProcedure } from "@/contexts/ringi/application/complete-approved-ringi-procedure"

// @authorization service - 表示した判断対象と現在の会社資格・技術権限を照合する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z
      .object({
        decision_target: z
          .object({
            proposal_version: z.number().int().positive(),
            proposal_digest: z.string().regex(/^[a-f0-9]{64}$/),
            task_key: z.string().min(1).max(100),
            task_round: z.number().int().positive(),
          })
          .strict(),
        comment: z.string().max(3000).nullable().optional(),
      })
      .strict(),
  ),
  async (c) => {
    const session = c.var.session
    if (session === null || c.var.accountTokenVersion === null) throw new UnauthorizedError()
    const body = c.req.valid("json")
    const ringiId = validateIntParam(c.req.param("id"), "ringi")
    const at = new Date(c.env.NOW ?? Date.now())
    const saved = await new RecordRingiDecision(c).run({
      ringiId,
      session,
      tokenVersion: c.var.accountTokenVersion,
      decisionTarget: {
        proposalVersion: body.decision_target.proposal_version,
        proposalDigest: body.decision_target.proposal_digest,
        taskKey: body.decision_target.task_key,
        taskRound: body.decision_target.task_round,
      },
      action: "approve",
      comment: body.comment ?? null,
      decidedAt: at,
    })
    if (saved instanceof ApplicationError) throw toHttpException(saved)
    if (saved.needsExecution) {
      const completed = await new CompleteApprovedRingiProcedure(c).run({
        ringiId,
        session,
        tokenVersion: c.var.accountTokenVersion,
        completedAt: at,
      })
      if (completed instanceof ApplicationError) throw toHttpException(completed)
    }
    return c.json({ status: saved.status, replayed: saved.replayed }, 200)
  },
)
