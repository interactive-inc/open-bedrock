import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { UnauthorizedError } from "@/lib/http/errors"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { CancelExpenseProcedure } from "@/contexts/expense/application/cancel-expense-procedure"

// @authorization service - 確認した判断対象と現在の資格を保存時にも照合する
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
      })
      .strict(),
  ),
  async (c) => {
    const session = c.var.session
    if (session === null || c.var.accountTokenVersion === null) throw new UnauthorizedError()
    const target = c.req.valid("json").decision_target
    const expenseId = validateIntParam(c.req.param("id"), "expense")
    const at = new Date(c.env.NOW ?? Date.now())
    const saved = await new CancelExpenseProcedure(c).run({
      expenseId,
      session,
      tokenVersion: c.var.accountTokenVersion,
      decisionTarget: {
        proposalVersion: target.proposal_version,
        proposalDigest: target.proposal_digest,
        taskKey: target.task_key,
        taskRound: target.task_round,
      },
      cancelledAt: at,
    })
    if (saved instanceof ApplicationError) throw toHttpException(saved)
    return c.json(saved, 200)
  },
)
